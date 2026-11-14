#!/usr/bin/env bash
# LOCAL TEST DATABASE ONLY. Rebuilds the throwaway database stage7c_local on a local PostgreSQL 16
# cluster that the tester started. Never point this at Supabase or at the live project.
#
# Loads, in order: the local Supabase shims, migration 0015 (unchanged), migration 0016, and
# migration 0017 (the admin read RPCs). Numbers per D-MIG Option B (docs/STAGE7_MIGRATION_MAP.md).
# Usage: supabase/tests/licence_7c/reset_local.sh [socket_dir] [port]
set -euo pipefail

SOCK="${1:-${STAGE7C_SOCK:-}}"
if [ -z "$SOCK" ]; then
  echo "Give the socket directory as the first argument, or set STAGE7C_SOCK." >&2
  exit 2
fi
PORT="${2:-55433}"
DB="stage7c_local"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres

psql -X -d postgres -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB};" -c "create database ${DB} encoding 'UTF8' template template0;"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/licence_7c/00_local_shims.sql"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/migrations/0015_licence_foundation.sql"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/migrations/0016_licence_admin_rpcs.sql"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/migrations/0017_licence_admin_read_rpcs.sql"
# LOCAL HARNESS ONLY. Stands in for the staging operator, who inserts this row in staging only.
# Production has no such row, so every backdate is refused there (fail closed; decision 5 is OPEN).
psql -X -d "$DB" -v ON_ERROR_STOP=1 -q -c "insert into public.licence_config (key, value) values ('staging_backdate_window_days', '31');"
echo "reset ok: ${DB} (shims, 0015, 0016, 0017, staging window row 31 days)"
