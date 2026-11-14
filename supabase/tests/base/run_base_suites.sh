#!/usr/bin/env bash
# LOCAL OR CI THROWAWAY DATABASE ONLY. Runs the base SQL suites (supabase/tests/stage*_tests.sql)
# against a PostgreSQL 16 server that the caller started. Never point this at Supabase, at a
# staging project, or at any hosted database. Only 127.0.0.1, localhost or a socket directory is
# accepted as the host.
#
# What it does:
#   1. builds one template database: the test-only platform stand-ins (00_base_platform_shims.sql),
#      migrations 0001 to 0010 and 0015 to 0017 in order, then the development seed. Chain A
#      migrations 0011 to 0014 are not on this branch, and the script refuses to run if they appear.
#   2. runs each suite in its own fresh database copied from the template. Each suite is one
#      transaction that ends with rollback, and it prints name, ok, detail.
#   3. checks each suite's rows with check_results.py. A suite that aborts, a row with ok = f, or
#      fewer rows than the minimum fails the run. Nothing is skipped or relabelled.
#
# Usage: run_base_suites.sh <host-or-socket-dir> [port]
# Password: export PGPASSWORD for a server that requires one (CI uses a throwaway password).
set -euo pipefail

HOST_ARG="${1:?usage: run_base_suites.sh <host-or-socket-dir> [port]}"
PORT_ARG="${2:-5432}"
case "$HOST_ARG" in
  127.0.0.1|localhost|/*) ;;
  *) echo "refusing: host must be 127.0.0.1, localhost or a socket directory" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
OUT="${BASE_SUITE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"

export PGHOST="$HOST_ARG" PGPORT="$PORT_ARG" PGUSER=postgres
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
TEMPLATE=base_template

if compgen -G "$ROOT/supabase/migrations/001[1-4]_*.sql" >/dev/null; then
  echo "refusing: Chain A migrations 0011 to 0014 are present; this harness covers the branch chain only" >&2
  exit 2
fi

cleanup() {
  local db
  for db in $(psql -X -At -d postgres -c "select datname from pg_database where datname like 'base\_run\_%' or datname = '$TEMPLATE'" 2>/dev/null); do
    "${PSQL[@]}" -d postgres -c "drop database if exists \"$db\"" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

cleanup
"${PSQL[@]}" -d postgres -c "create database $TEMPLATE encoding 'UTF8' template template0"
"${PSQL[@]}" -d "$TEMPLATE" -f "$HERE/00_base_platform_shims.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  case "$(basename "$migration")" in
    0011_*|0012_*|0013_*|0014_*) echo "refusing: unexpected Chain A file $(basename "$migration")" >&2; exit 2 ;;
    0015_*|0016_*|0017_*|0001_*|0002_*|0003_*|0004_*|0005_*|0006_*|0007_*|0008_*|0009_*|0010_*) ;;
    *) echo "refusing: unexpected migration file $(basename "$migration")" >&2; exit 2 ;;
  esac
  "${PSQL[@]}" -d "$TEMPLATE" -f "$migration" >/dev/null
done
"${PSQL[@]}" -d "$TEMPLATE" -f "$ROOT/supabase/seed/demo_seed.sql"
echo "== template ready: shims, migrations 0001-0010 and 0015-0017, dev seed"

# Suite name and the minimum number of checks it had when this harness was written.
SUITES=(stage1_isolation stage3_owner stage4_files stage5_orders stage6_features stage7_stats stage8_print)
MINIMUM=(30 30 23 23 42 54 48)

overall=0
for index in "${!SUITES[@]}"; do
  suite="${SUITES[$index]}"
  db="base_run_$suite"
  echo "== $suite"
  "${PSQL[@]}" -d postgres -c "drop database if exists \"$db\"" -c "create database \"$db\" template \"$TEMPLATE\""
  set +e
  psql -X -q --csv -v ON_ERROR_STOP=1 -d "$db" -f "$ROOT/supabase/tests/${suite}_tests.sql" \
    > "$OUT/$suite.csv" 2> "$OUT/$suite.err"
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    echo "$suite: psql exit $rc, the suite aborted"
    cat "$OUT/$suite.err"
    overall=1
  elif ! python3 "$HERE/check_results.py" "$OUT/$suite.csv" "$suite" "${MINIMUM[$index]}"; then
    overall=1
  fi
  "${PSQL[@]}" -d postgres -c "drop database if exists \"$db\""
done

if [ "$overall" -eq 0 ]; then
  echo "== base SQL suites: all seven passed"
else
  echo "== base SQL suites: at least one suite failed" >&2
fi
exit "$overall"
