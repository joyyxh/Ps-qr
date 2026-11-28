#!/usr/bin/env bash
# Takes a logical backup of the hosted project before any live migration, then checks that it can be read.
#
# Run this yourself, from a machine you control, with your own connection string. Use pg_dump and
# pg_restore version 17: the hosted server reports PostgreSQL 17.11, and pg_dump refuses an older major.
# The connection string is read from the environment only. Never write it into a file, a commit or a chat.
#
#   export SUPABASE_DB_URL='postgresql://<user>:<password>@<host>:5432/postgres'   # from your dashboard
#   export SCRATCH_DB_URL='postgresql://<user>:<password>@<host>:5432/<empty-scratch-db>'  # optional
#   ./backup_and_verify.sh /secure/location/printnest-backups
#
# On the free plan there are no platform backups to fall back on. Keep this dump until the owner confirms
# the catch-up, and do not delete it afterwards without the owner's say-so.
set -euo pipefail

: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL in your shell; do not store it in a file}"
OUT_DIR="${1:?usage: backup_and_verify.sh <output-directory>}"

major="$(pg_dump --version | grep -oE '[0-9]+' | head -n1)"
[ "$major" = "17" ] || { echo "pg_dump must be version 17 for a PostgreSQL 17 server (found $major)" >&2; exit 1; }

mkdir -p "$OUT_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$OUT_DIR/printnest-before-owner-catch-up-$stamp.dump"

pg_dump --format=custom --no-owner --file="$dump" "$SUPABASE_DB_URL"
pg_restore --list "$dump" > "$dump.toc"             # the archive must be readable end to end
sha256sum "$dump" "$dump.toc" > "$dump.sha256"
echo "backup written: $dump"

if [ -n "${SCRATCH_DB_URL:-}" ]; then
  # Restore into an empty scratch database and count the rows that must survive the catch-up.
  pg_restore --no-owner --dbname="$SCRATCH_DB_URL" "$dump"
  for table in shops shop_memberships services orders order_items customer_files; do
    psql -X -At "$SCRATCH_DB_URL" -c "select '$table', count(*) from public.$table"
  done
  echo "restore check done: compare these counts with 00 pre-check on the live project"
else
  echo "no SCRATCH_DB_URL set: restore check skipped (run it before the live apply)"
fi
