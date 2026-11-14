#!/usr/bin/env bash
# LOCAL OR CI THROWAWAY DATABASE ONLY. Runs the licence PostgreSQL suites against one clean
# database (stage7c_local) on a PostgreSQL 16 server that the caller started. Never point this at
# Supabase, at a staging project, or at any hosted database.
#
# Order (each suite needs a fresh database, see require_fresh_database in rpc_tests.py):
#   1. combined reset: platform stand-ins, every migration in supabase/migrations in order
#      (0001 to 0010, then 0015 to 0017), licence test defaults, staging backdate row (31 days)
#   2. rpc_tests.py       (licence RPCs)
#   3. reset
#   4. read_api_tests.py  (admin read RPCs, migration 0017)
#   5. reset
#   6. hash_vectors.py    (canonical hash oracle, pinned in hash_vectors.json; never --update here)
#
# Usage: run_suites.sh <host-or-socket-dir> [port]
# Password: export PGPASSWORD for a server that requires one (CI uses a throwaway password).
set -euo pipefail

HOST_ARG="${1:?usage: run_suites.sh <host-or-socket-dir> [port]}"
PORT_ARG="${2:-55433}"
HERE="$(cd "$(dirname "$0")" && pwd)"

export PGHOST="$HOST_ARG" PGPORT="$PORT_ARG" PGUSER=postgres
export STAGE7C_SOCK="$HOST_ARG" STAGE7C_PORT="$PORT_ARG" STAGE7C_DB=stage7c_local

cd "$HERE"

echo "== 1. combined reset"
./combined/reset_combined_local.sh "$HOST_ARG" "$PORT_ARG"

echo "== 2. rpc_tests.py"
python3 rpc_tests.py

echo "== 3. reset"
./combined/reset_combined_local.sh "$HOST_ARG" "$PORT_ARG"

echo "== 4. read_api_tests.py"
python3 read_api_tests.py

echo "== 5. reset"
./combined/reset_combined_local.sh "$HOST_ARG" "$PORT_ARG"

echo "== 6. hash_vectors.py"
python3 hash_vectors.py --db stage7c_local --socket "$HOST_ARG" --port "$PORT_ARG"

echo "== licence PostgreSQL suites: all four steps passed"
