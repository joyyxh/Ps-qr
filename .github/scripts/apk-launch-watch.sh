#!/usr/bin/env bash
# Diagnostic: start the installed app and watch it for five minutes WITHOUT any DevTools access.
# Prints one line every 15 seconds and stops early on a renderer crash or when the process exits.
set -uo pipefail
OUT="${1:?usage: apk-launch-watch.sh <out-dir>}"
mkdir -p "$OUT"
adb logcat -c || true
adb shell monkey -p com.printnest.app -c android.intent.category.LAUNCHER 1 > "$OUT/monkey.txt" 2>&1 || true
cat "$OUT/monkey.txt"
start=$(date +%s)
crashed=no
while [ $(( $(date +%s) - start )) -lt 300 ]; do
  sleep 15
  pid="$(adb shell pidof com.printnest.app 2>/dev/null | tr -d '\r')"
  echo "t=$(( $(date +%s) - start ))s pid=${pid:-none}"
  if adb logcat -d 2>/dev/null | grep -q 'crash detected'; then crashed=yes; echo 'RENDERER CRASH SEEN'; break; fi
  if [ -z "$pid" ]; then echo 'app process gone'; break; fi
done
adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
echo "crashed=$crashed"
grep -E 'crash detected|wasn.t handled|Force finishing|has died|ANR in|PackageUpdatedTask' "$OUT/logcat.txt" | head -60 || true
