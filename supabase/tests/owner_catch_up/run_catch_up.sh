#!/usr/bin/env bash
# LOCAL OR CI THROWAWAY DATABASE ONLY. Never point this at Supabase or any hosted project.
#
# Reproduces the owner sign-in failure "column shops_1.auto_print_enabled does not exist" and checks
# the catch-up that fixes it, on a clean PostgreSQL 16 database:
#   1. Hosted state: migrations 0001 to 0009 only (the live project stopped at 0009).
#   2. The owner's sign-in query must FAIL with "auto_print_enabled does not exist".
#   3. Apply the catch-up, in order: 0010 (print tables), 0018 (the switch), 0019 (advisor fixes).
#   4. The same query must now succeed.
#   5. The auto-print RPCs and the browser-role rules must behave as the migrations say.
#
# Usage: run_catch_up.sh <host-or-socket-dir> [port]
# Password: export PGPASSWORD for a server that requires one (CI uses a throwaway password).
set -euo pipefail

HOST_ARG="${1:?usage: run_catch_up.sh <host-or-socket-dir> [port]}"
PORT_ARG="${2:-55433}"
DB="${OWNER_CATCH_UP_DB:-owner_catch_up}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"

OWNER_ID="11111111-1111-1111-1111-111111111111"
STRANGER_ID="22222222-2222-2222-2222-222222222222"
SHOP_ID="33333333-3333-3333-3333-333333333333"

export PGHOST="$HOST_ARG" PGPORT="$PORT_ARG" PGUSER=postgres

fail() { echo "FAIL: $*" >&2; exit 1; }
run_sql() { psql -X -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

echo "== setup: fresh database $DB"
psql -X -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists ${DB};" \
  -c "create database ${DB} encoding 'UTF8' template template0;"
run_sql -f "$HERE/../licence_7c/combined/00_platform_shims.sql"

echo "== 1. hosted state: migrations 0001 to 0009"
for f in "$MIG"/000[1-9]_*.sql; do
  run_sql -f "$f"
done
run_sql -v owner_id="$OWNER_ID" -v stranger_id="$STRANGER_ID" -v shop_id="$SHOP_ID" -f "$HERE/01_seed.sql"

echo "== 2. the owner's sign-in query must fail on the hosted state"
set +e
out="$(run_sql -v owner_id="$OWNER_ID" -f "$HERE/02_owner_shops_probe.sql" 2>&1)"
status=$?
set -e
[ "$status" -ne 0 ] || fail "the owner query succeeded before the catch-up; the reproduction is wrong"
grep -q "auto_print_enabled does not exist" <<<"$out" \
  || fail "the owner query failed, but not with the reported error: $out"
echo "   reproduced: $(grep -m1 'does not exist' <<<"$out")"

echo "== 3. apply the catch-up: 0010, 0018, 0019"
for name in 0010_print_agents 0018_auto_print 0019_advisor_fixes; do
  run_sql -f "$MIG/${name}.sql"
  echo "   applied $name"
done

echo "== 4. the owner's sign-in query must now succeed"
out="$(run_sql -v owner_id="$OWNER_ID" -f "$HERE/02_owner_shops_probe.sql" 2>&1)" \
  || fail "the owner query still fails after the catch-up: $out"
grep -q "catch-up-shop" <<<"$out" || fail "the owner query returned no shop: $out"
echo "   owner query returns the shop"

echo "== 5. auto-print RPCs and browser-role rules"
run_sql -v owner_id="$OWNER_ID" -v stranger_id="$STRANGER_ID" -v shop_id="$SHOP_ID" -f "$HERE/03_auto_print_rpc.sql" \
  || fail "auto-print checks failed"

echo "== catch-up check passed on a clean database"
