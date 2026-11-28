#!/usr/bin/env bash
# LOCAL OR CI THROWAWAY DATABASE ONLY. Never point this at Supabase or any hosted project.
#
# Rehearses the WHOLE pending migration chain on a disposable copy that has the shape of production:
# 0001-0009 applied, three legacy email owners (two with no password), their shops, services, orders and files.
#   1. Baseline, row digests, and a pg_dump backup.
#   2. Apply 0010, 0015, 0016, 0017, 0018 ... 0025, each in its own transaction. After EACH one the row digests of
#      the eight data tables and the user list must equal the baseline.
#   3. Access probes (19 checks): owners, staff and visitors, as the real roles with real JWT claims.
#   4. Claim path (0024): issue a code, claim one legacy owner. The auth user id, shop, memberships, services,
#      orders and files stay identical. The other two legacy owners are untouched.
#   5. Rollback of 0025, 0024, 0023: the structure fingerprint equals the one taken after 0022.
#   6. Recovery: the pg_dump backup is restored into a new database and equals the baseline; the chain then applies
#      to it again.
# Usage: rehearse_chain.sh <host-or-socket-dir> [port]   (output in $REHEARSAL_OUT or a temp dir)
set -euo pipefail
HOST="${1:?usage: rehearse_chain.sh <host-or-socket-dir> [port]}"
PORT="${2:-5432}"
case "$HOST" in 127.0.0.1|localhost|/*) ;; *) echo "refusing: host must be local" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"; TESTS="$ROOT/supabase/tests"; CU="$ROOT/supabase/deploy/owner_catch_up"
OUT="${REHEARSAL_OUT:-$(mktemp -d)}"; mkdir -p "$OUT"
export PGHOST="$HOST" PGPORT="$PORT" PGUSER=postgres
DB=chain_rehearsal; RESTORED=chain_restored
fail() { echo "FAIL: $*" >&2; exit 1; }
say()  { echo "== $*"; }
admin(){ psql -X -d postgres -v ON_ERROR_STOP=1 -q -c "$1" >/dev/null; }
q()    { local db="$1"; shift; psql -X -d "$db" -v ON_ERROR_STOP=1 -q "$@"; }
snap() { q "$1" -At -f "$CU/digests.sql" > "$OUT/$2.digests"; q "$1" -At -c "select id, email, coalesce(encrypted_password is not null,false), raw_app_meta_data::text from auth.users order by id" > "$OUT/$2.users"; }
struct(){ q "$1" -At -f "$CU/fingerprint.sql" > "$OUT/$2.fingerprint"; q "$1" -At -f "$CU/functions.sql" > "$OUT/$2.functions"; }
same() { for k in digests users; do cmp -s "$OUT/$1.$k" "$OUT/$2.$k" || { diff "$OUT/$1.$k" "$OUT/$2.$k" | head; fail "$k differ: $1 vs $2"; }; done; }
CHAIN="0010_print_agents 0015_licence_foundation 0016_licence_admin_rpcs 0017_licence_admin_read_rpcs 0018_auto_print 0019_advisor_fixes 0020_upi_order_and_print_hardening 0021_owner_username_auth 0022_owner_guard_at_commit 0023_owner_write_policies_and_indexes 0024_owner_legacy_claim 0025_security_hardening"
# the chain must be exactly the migrations on the branch after 0009 (no Chain A files, nothing forgotten)
[ "$(ls "$MIG" | sed 's/\.sql$//' | awk '$0 > "0009_zzz"' | xargs)" = "$CHAIN" ] || fail "migration list on disk differs from the rehearsal chain"
check_rows() { awk -F'|' -v want="$2" 'NF>=3{ if($2=="t")o++; else b++; print "   " $0 > "/dev/stderr" } END{ if (o!=want||b>0){print "checks ok=" o+0 " bad=" b+0 > "/dev/stderr"; exit 1} }' "$1"; }

say "1. baseline (production shape on 0001-0009) and backup"
admin "drop database if exists $DB"; admin "drop database if exists $RESTORED"; admin "create database $DB"
q "$DB" -f "$TESTS/base/00_base_platform_shims.sql"
q "$DB" -c "alter table auth.users add column if not exists encrypted_password text, add column if not exists last_sign_in_at timestamptz"
q "$DB" -c "grant usage on schema public to service_role, authenticated, anon" -c "alter default privileges in schema public grant all on tables to service_role" -c "alter default privileges in schema public grant select on tables to authenticated"
for f in "$MIG"/000[1-9]_*.sql; do q "$DB" -f "$f" >/dev/null; done
q "$DB" -f "$HERE/production_shape.sql"
q "$DB" -c "grant select on all tables in schema public to authenticated" -c "grant select on public.services, public.shops to anon"
snap "$DB" baseline; struct "$DB" s0009
pg_dump -Fc -d "$DB" -f "$OUT/baseline.dump"
echo "   rows: $(awk -F'|' '{printf "%s=%s ", $1, $2}' "$OUT/baseline.digests")"
echo "   users: $(wc -l < "$OUT/baseline.users") (legacy owners without password: $(awk -F'|' '$3=="f" && $2!="staff@example.com"' "$OUT/baseline.users" | wc -l))"
echo "   backup written: baseline.dump ($(stat -c %s "$OUT/baseline.dump") bytes)"

say "2. apply the chain, each migration in its own transaction; data digests must match the baseline after each"
for m in $CHAIN; do
  q "$DB" -1 -f "$MIG/$m.sql" >/dev/null 2>"$OUT/$m.err" || { cat "$OUT/$m.err"; fail "$m failed"; }
  snap "$DB" "after_$m"; same baseline "after_$m"
  echo "   $m: applied; rows and users identical to baseline"
  [ "$m" = 0022_owner_guard_at_commit ] && struct "$DB" s0022
done
struct "$DB" s0025

say "3. access probes on the migrated copy"
psql -X -d "$DB" -v ON_ERROR_STOP=1 -A -t -F'|' -f "$HERE/access_probe.sql" > "$OUT/probe.txt"
check_rows "$OUT/probe.txt" 19 || fail "access probe (see $OUT/probe.txt)"
echo "   access probe: 19 ok, 0 not ok"
snap "$DB" after_probe; same baseline after_probe

say "4. claim path for one legacy owner (ravi); sita and mohan stay legacy"
RAVI=a0000000-0000-0000-0000-000000000001
q "$DB" -At -c "select string_agg(u.email, ', ' order by u.email) from auth.users u where public.owner_is_legacy(u.id)" > "$OUT/legacy_list.txt"
echo "   legacy owners found: $(cat "$OUT/legacy_list.txt")"
CODE="$(q "$DB" -At -c "select public.owner_issue_claim_code('$RAVI')")"
COMPACT="${CODE//-/}"
[ "$(q "$DB" -At -c "select public.owner_consume_claim_code('$RAVI', '$COMPACT')")" = t ] || fail "claim code was not accepted"
q "$DB" -1 <<SQL
select public.owner_claim_apply('$RAVI', 'ravi_prints', '2026-11-22.1', '2026-11-22.1',
  array['AAAA-BBBB-CCCC-DDDD','EEEE-FFFF-GGGG-HHHH','JJJJ-KKKK-MMMM-NNNN','PPPP-QQQQ-RRRR-SSSS','TTTT-UUUU-VVVV-WWWW','XXXX-YYYY-ZZZZ-2222','3333-4444-5555-6666','7777-8888-9999-AAAB','BBBC-CCCD-DDDE-EEEF','FFFG-GGGH-HHHJ-JJJK']);
update auth.users set email = 'ravi_prints@accounts.qrquick.invalid', raw_app_meta_data = raw_app_meta_data || '{"owner_flow":"username-v1"}', encrypted_password = extensions.crypt('NewPassword2026x', extensions.gen_salt('bf', 4)) where id = '$RAVI';
select public.owner_claim_sync_identity('$RAVI', 'ravi_prints@accounts.qrquick.invalid');
SQL
q "$DB" -At -c "select count(*) from public.owner_usernames where user_id = '$RAVI' and username = 'ravi_prints'" | grep -qx 1 || fail "username not reserved"
q "$DB" -At -c "select public.owner_is_legacy(id)::text from auth.users where id = '$RAVI'" | grep -qx false || fail "ravi still legacy"
q "$DB" -At -c "select count(*) from auth.users where public.owner_is_legacy(id)" | grep -qx 2 || fail "the other two should stay legacy"
snap "$DB" after_claim
cmp -s "$OUT/baseline.digests" "$OUT/after_claim.digests" || fail "data digests changed by the claim"
diff <(cut -d'|' -f1 "$OUT/baseline.users") <(cut -d'|' -f1 "$OUT/after_claim.users") >/dev/null || fail "user ids changed"
{ diff "$OUT/baseline.users" "$OUT/after_claim.users" || true; } | grep '^[<>]' | cut -c1-90 | sed 's/^/   /' || true
echo "   shops, memberships, services, orders, order items and files byte-identical; same user ids; only ravi's address and flag changed"
# as ravi (new account, same id) the shop is still his
psql -X -d "$DB" -v ON_ERROR_STOP=1 -A -t -F'|' -f "$HERE/access_probe.sql" > "$OUT/probe_after_claim.txt"
check_rows "$OUT/probe_after_claim.txt" 19 || fail "access probe after the claim"
echo "   access probe after the claim: 19 ok, 0 not ok (ravi still owns ravi-prints)"
q "$DB" -At -c "select count(*) from public.owner_recovery_codes where user_id = '$RAVI'" | grep -qx 10 || fail "recovery codes missing"

say "5. rollback of 0025, 0024 and 0023 on a copy taken after the claim-free state"
admin "drop database if exists chain_rollback"
# rollback demo runs on a fresh chain without the claim so the structure comparison is exact
admin "create database chain_rollback"
q chain_rollback -f "$TESTS/base/00_base_platform_shims.sql"
q chain_rollback -c "alter table auth.users add column if not exists encrypted_password text, add column if not exists last_sign_in_at timestamptz"
q chain_rollback -c "grant usage on schema public to service_role, authenticated, anon" -c "alter default privileges in schema public grant all on tables to service_role"
for f in "$MIG"/000[1-9]_*.sql; do q chain_rollback -f "$f" >/dev/null; done
for m in $CHAIN; do q chain_rollback -1 -f "$MIG/$m.sql" >/dev/null; [ "$m" = 0022_owner_guard_at_commit ] && struct chain_rollback r0022; done
q chain_rollback -1 -f "$HERE/rollback_0023_0025.sql" >/dev/null
struct chain_rollback r_after_rollback
# A re-granted default privilege prints as {owner=X/owner,=X/owner} instead of (default); they mean the same.
norm() { sed 's/{postgres=X\/postgres,=X\/postgres}/(default)/' "$1"; }
for k in fingerprint functions; do
  diff <(norm "$OUT/r0022.$k") <(norm "$OUT/r_after_rollback.$k") >/dev/null || { diff <(norm "$OUT/r0022.$k") <(norm "$OUT/r_after_rollback.$k") | head -12; fail "$k after rollback differs from the state after 0022"; }
done
echo "   after rollback_0023_0025.sql the schema fingerprint and every function definition equal the state after 0022"
q chain_rollback -1 -f "$MIG/0023_owner_write_policies_and_indexes.sql" >/dev/null
q chain_rollback -1 -f "$MIG/0024_owner_legacy_claim.sql" >/dev/null
q chain_rollback -1 -f "$MIG/0025_security_hardening.sql" >/dev/null
struct chain_rollback r_reapplied
for k in fingerprint functions; do diff <(norm "$OUT/s0025.$k") <(norm "$OUT/r_reapplied.$k") >/dev/null || fail "re-applying 0023-0025 after a rollback differs from the first application ($k)"; done
echo "   re-applying 0023, 0024, 0025 after the rollback gives the same state as the first application"
admin "drop database chain_rollback"

say "6. recovery: restore the backup taken before the chain"
admin "create database $RESTORED"
pg_restore -d "$RESTORED" --no-owner "$OUT/baseline.dump" 2>"$OUT/restore.err" || true
snap "$RESTORED" restored; same baseline restored
struct "$RESTORED" s_restored; cmp -s "$OUT/s0009.fingerprint" "$OUT/s_restored.fingerprint" || fail "restored structure differs from the 0009 baseline"
echo "   restored copy equals the baseline (rows, users, structure)"
for m in $CHAIN; do q "$RESTORED" -1 -f "$MIG/$m.sql" >/dev/null || fail "$m failed on the restored copy"; done
snap "$RESTORED" restored_chain; same baseline restored_chain
echo "   the chain applies again to the restored copy with data unchanged"

admin "drop database $RESTORED"
echo "== full-chain rehearsal PASSED (output: $OUT)"
