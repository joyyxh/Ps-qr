#!/usr/bin/env bash
# Runs the mocked-backend browser checks in this folder against local static servers.
# Each script replaces Supabase with an in-memory mock (Playwright page.route), so nothing here
# reaches a hosted backend, a real customer record or a printer.
#
# Servers: web/ on 127.0.0.1:5173 (owner, qr, features, stats) and web/ on 127.0.0.1:5174 (licence).
# Usage: run_smokes.sh <script.cjs> [<script.cjs> ...]
# Environment:
#   PLAYWRIGHT_MODULE   module or path that provides Playwright (default: playwright)
#   QRQUICK_SMOKE_OUT   folder for screenshots and PNG files (default: a temp folder)
#   PYTHON              Python 3 that starts the two static servers (default: python3).
#                       qr-smoke.cjs calls python3 from PATH, which needs opencv-python-headless.
#
# Every script is run even if an earlier one fails. The exit status is non-zero if any script
# failed. A failing script is reported as failing; nothing is skipped or relabelled here.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: run_smokes.sh <script.cjs> [...]" >&2
  exit 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/../.." && pwd)"
OUT="${QRQUICK_SMOKE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
export QRQUICK_SMOKE_OUT="$OUT"
export PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-playwright}"

PY_BIN="${PYTHON:-python3}"
PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT

start_server() {
  local port="$1"
  (cd "$WEB" && exec "$PY_BIN" -m http.server "$port" --bind 127.0.0.1 >"$OUT/server-$port.log" 2>&1) &
  PIDS+=("$!")
  for _ in $(seq 1 50); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$port/"; then return 0; fi
    sleep 0.2
  done
  echo "server on port $port did not answer" >&2
  return 1
}

start_server 5173 || exit 1
start_server 5174 || exit 1

overall=0
: > "$OUT/summary.txt"
for script in "$@"; do
  echo "== $script"
  node "$HERE/$script"
  rc=$?
  echo "$script exit $rc" | tee -a "$OUT/summary.txt"
  if [ "$rc" -ne 0 ]; then overall=1; fi
done

echo "== summary"
cat "$OUT/summary.txt"
exit "$overall"
