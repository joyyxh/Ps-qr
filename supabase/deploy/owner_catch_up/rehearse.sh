#!/usr/bin/env bash
# LOCAL OR CI THROWAWAY DATABASE ONLY. Never point this at Supabase or any hosted project.
#
# Rehearses the owner catch-up on a clean PostgreSQL server. The hosted project runs PostgreSQL 17.11;
# run this on 17 as well before any live apply (RUNBOOK.md, gate G5).
#
#   1. Baseline: migrations 0001-0009, the owner and demo seeds, and one order with a claimed file.
#   2. Reproduction: the owner's sign-in query fails with the reported error.
#   3. Apply 0010, 0018, 0019, each in its own transaction. Existing rows must be unchanged.
#   4. Owner query succeeds; auto-print checks pass; Stage 8 suite reports 48 ok and 0 not ok, and
#      leaves no rows behind.
#   5. Idempotency: re-running 0018 and 0019 changes nothing; re-running 0010 is refused, changes nothing.
#   6. Failure drill: a 0010 that stops part-way is undone exactly by rollback.sql.
#   7. Full rollback restores the 0009 state exactly; the catch-up then re-applies to the same state.
#   8. Rollback guard: refuses while automatic printing is on, and changes nothing.
#
# Usage: rehearse.sh <host-or-socket-dir> [port]
# Snapshots, diffs and logs are written to $REHEARSAL_OUT (default: a new temporary directory).
set -euo pipefail

HOST="${1:?usage: rehearse.sh <host-or-socket-dir> [port]}"
PORT="${2:-55433}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
OUT="${REHEARSAL_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
export PGHOST="$HOST" PGPORT="$PORT" PGUSER=postgres

OWNER_ID="11111111-1111-1111-1111-111111111111"
STRANGER_ID="22222222-2222-2222-2222-222222222222"
SHOP_ID="33333333-3333-3333-3333-333333333333"
DEMO_SHOP_ID="bbbbbbbb-0000-0000-0000-000000000001"
DB=deploy_rehearsal
BASE=deploy_baseline
DRILL=deploy_drill
FULL=deploy_full

fail() { echo "FAIL: $*" >&2; exit 1; }
say()  { echo "== $*"; }
admin() { psql -X -d postgres -v ON_ERROR_STOP=1 -q -c "$1"; }
recreate() { # $1 = database to (re)create, $2 = template database (empty: template0)
  admin "drop database if exists $1"
  admin "create database $1 template ${2:-template0}"
}
q() { local db="$1"; shift; psql -X -d "$db" -v ON_ERROR_STOP=1 -q "$@"; }
snap() { # $1 = database, $2 = label: write the three comparable snapshots
  q "$1" -At -f "$HERE/functions.sql"   > "$OUT/$2.functions"
  q "$1" -At -f "$HERE/fingerprint.sql" > "$OUT/$2.fingerprint"
  q "$1" -At -f "$HERE/digests.sql"     > "$OUT/$2.digests"
}
same() { # $1, $2 = labels: every snapshot must be identical
  for k in functions fingerprint digests; do
    cmp -s "$OUT/$1.$k" "$OUT/$2.$k" || fail "$k differs between $1 and $2 (see $OUT)"
  done
}
apply_catch_up() { # $1 = database: 0010, 0018, 0019, each in its own transaction
  for name in 0010_print_agents 0018_auto_print 0019_advisor_fixes; do
    q "$1" -1 -f "$MIG/$name.sql"
  done
}

say "output: $OUT"

say "1. baseline: migrations 0001-0009, seeds, rehearsal rows"
recreate "$DB"
q "$DB" -f "$TESTS/licence_7c/combined/00_platform_shims.sql"
q "$DB" -c "alter table auth.users
            add column if not exists aud text, add column if not exists role text,
            add column if not exists created_at timestamptz default now(),
            add column if not exists updated_at timestamptz default now(),
            add column if not exists raw_app_meta_data jsonb, add column if not exists raw_user_meta_data jsonb"
# Supabase grants service_role table privileges on new public tables by default; a plain cluster does not.
# Test-only, so the service-role steps of the Stage 8 suite can run. Migrations still set their own grants.
q "$DB" -c "grant usage on schema public to service_role" \
        -c "alter default privileges in schema public grant all on tables to service_role"
for f in "$MIG"/000[1-9]_*.sql; do q "$DB" -f "$f"; done
q "$DB" -v owner_id="$OWNER_ID" -v stranger_id="$STRANGER_ID" -v shop_id="$SHOP_ID" -f "$TESTS/owner_catch_up/01_seed.sql"
q "$DB" -f "$ROOT/supabase/seed/demo_seed.sql"
q "$DB" -f "$HERE/rehearsal_data.sql"
q "$DB" -At -f "$HERE/gen_digests.sql" | diff -q - "$HERE/digests.sql" >/dev/null \
  || fail "digests.sql is stale: regenerate it with gen_digests.sql on a 0009 database"
snap "$DB" baseline
recreate "$BASE" "$DB"

say "2. reproduction: the owner's sign-in query fails on 0001-0009"
set +e
out="$(q "$DB" -v owner_id="$OWNER_ID" -f "$TESTS/owner_catch_up/02_owner_shops_probe.sql" 2>&1)"; st=$?
set -e
[ "$st" -ne 0 ] || fail "the owner query succeeded before the catch-up"
grep -q "auto_print_enabled does not exist" <<<"$out" || fail "wrong error: $out"
echo "   reproduced: $(grep -m1 'does not exist' <<<"$out")"

say "3. apply 0010, 0018, 0019, each in its own transaction"
apply_catch_up "$DB"
snap "$DB" caught_up
cmp -s "$OUT/baseline.digests" "$OUT/caught_up.digests" || fail "existing rows changed during the catch-up"
echo "   existing rows unchanged (8 tables, 0009 columns)"
changed="$({ diff "$OUT/baseline.functions" "$OUT/caught_up.functions" || true; } | sed -n 's/^< \([^|]*\)|.*/\1/p' | sort -u | xargs)"
[ "$changed" = "expired_customer_file_paths track_order" ] || fail "unexpected functions changed: '$changed'"
echo "   functions replaced: $changed; all others new"

say "4. owner query, auto-print checks, Stage 8 suite"
q "$DB" -v owner_id="$OWNER_ID" -f "$TESTS/owner_catch_up/02_owner_shops_probe.sql" > "$OUT/owner_probe.txt"
grep -q "catch-up-shop" "$OUT/owner_probe.txt" || fail "the owner query returned no shop"
q "$DB" -v owner_id="$OWNER_ID" -v stranger_id="$STRANGER_ID" -v shop_id="$SHOP_ID" \
  -f "$TESTS/owner_catch_up/03_auto_print_rpc.sql" >/dev/null
psql -X -d "$DB" -v ON_ERROR_STOP=1 -A -t -F'|' -f "$TESTS/stage8_print_tests.sql" > "$OUT/stage8.txt"
read -r ok bad < <(awk -F'|' 'NF>=3 && $2=="t"{o++} NF>=3 && $2=="f"{b++} END{print o+0, b+0}' "$OUT/stage8.txt")
[ "$ok" -eq 48 ] && [ "$bad" -eq 0 ] || fail "Stage 8: $ok ok, $bad not ok (see $OUT/stage8.txt)"
echo "   Stage 8: $ok ok, $bad not ok"
snap "$DB" after_stage8
same caught_up after_stage8
echo "   Stage 8 left no rows behind"

say "5. idempotency"
q "$DB" -1 -f "$MIG/0018_auto_print.sql"
q "$DB" -1 -f "$MIG/0019_advisor_fixes.sql"
snap "$DB" rerun_018_019
same caught_up rerun_018_019
set +e
q "$DB" -1 -f "$MIG/0010_print_agents.sql" 2> "$OUT/rerun_0010.err"; st=$?
set -e
[ "$st" -ne 0 ] || fail "0010 re-ran without an error"
grep -q "already exists" "$OUT/rerun_0010.err" || fail "0010 re-run failed for another reason: $(cat "$OUT/rerun_0010.err")"
snap "$DB" rerun_0010
same caught_up rerun_0010
echo "   0018 and 0019 re-run: no change. 0010 re-run: refused at its first statement, no change"

say "6. failure drill: 0010 stops part-way; rollback.sql undoes exactly that"
recreate "$DRILL" "$BASE"
cut_line="$(grep -n 'create or replace function public.request_client_key' "$MIG/0010_print_agents.sql" | cut -d: -f1)"
{ head -n "$((cut_line - 1))" "$MIG/0010_print_agents.sql"; echo "select 1/0; -- simulated failure"; } > "$OUT/0010_partial.sql"
set +e
q "$DRILL" -f "$OUT/0010_partial.sql" 2> "$OUT/drill.err"; st=$?
set -e
[ "$st" -ne 0 ] || fail "the drill did not fail"
q "$DRILL" -At -c "select to_regclass('public.print_agents') is not null" | grep -qx t \
  || fail "the drill left no partial state to undo"
q "$DRILL" -f "$HERE/rollback.sql"
snap "$DRILL" drill_undone
same baseline drill_undone
echo "   partial 0010 (stopped before request_client_key) undone exactly"

say "7. full rollback restores 0009 exactly; the catch-up re-applies to the same state"
recreate "$FULL" "$BASE"
apply_catch_up "$FULL"
snap "$FULL" full_applied
same caught_up full_applied
q "$FULL" -f "$HERE/rollback.sql"
snap "$FULL" full_rolled_back
same baseline full_rolled_back
apply_catch_up "$FULL"
snap "$FULL" reapplied
same caught_up reapplied
echo "   rollback restores the 0009 state exactly; re-apply gives the catch-up state again"

say "8. rollback guard: refuses while automatic printing is on, and changes nothing"
q "$FULL" -c "update public.shops set auto_print_enabled = true where id = '$DEMO_SHOP_ID'"
snap "$FULL" guard_before
set +e
q "$FULL" -f "$HERE/rollback.sql" 2> "$OUT/guard.err"; st=$?
set -e
[ "$st" -ne 0 ] || fail "rollback ran while automatic printing was on"
grep -q "ROLLBACK REFUSED" "$OUT/guard.err" || fail "rollback failed, but not through the guard: $(cat "$OUT/guard.err")"
snap "$FULL" guard_after
same guard_before guard_after
q "$FULL" -c "update public.shops set auto_print_enabled = false where id = '$DEMO_SHOP_ID'"
echo "   guard refused: $(grep -m1 'ROLLBACK REFUSED' "$OUT/guard.err")"

say "PASS: all rehearsal checks passed. Snapshots and logs: $OUT"
