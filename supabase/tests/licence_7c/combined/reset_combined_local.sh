#!/usr/bin/env bash
# LOCAL THROWAWAY CLUSTER ONLY. Rebuilds stage7c_local with the combined chain:
#   platform stand-ins, every migration in supabase/migrations in order, the licence test defaults,
#   then the staging backdate window row (31 days, local harness only).
# Usage: supabase/tests/licence_7c/combined/reset_combined_local.sh <socket_dir> [port]
# Never point this at Supabase or at any hosted project.
set -euo pipefail
SOCK="${1:-${STAGE7C_SOCK:-}}"
if [ -z "$SOCK" ]; then
  echo "Give the socket directory as the first argument, or set STAGE7C_SOCK." >&2
  exit 2
fi
PORT="${2:-55433}"
DB="stage7c_local"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres
psql -X -d postgres -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB};" -c "create database ${DB} encoding 'UTF8' template template0;"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/00_platform_shims.sql"
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
  n=$((n+1))
done
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/00b_shop_defaults_for_licence_tests.sql"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -c "insert into public.licence_config (key, value) values ('staging_backdate_window_days', '31');"
echo "combined reset ok: ${DB} (platform stand-ins, ${n} migrations, licence test defaults, staging row 31 days)"
