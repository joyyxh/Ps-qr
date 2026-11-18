#!/usr/bin/env bash
# Diagnostic only: does the Back key reach the app, and what does the WebView history do?
set -uo pipefail
OUT="${1:?usage: apk-back-probe.sh <out-dir>}"; mkdir -p "$OUT"
HERE=.github/scripts
top() { adb shell dumpsys activity activities 2>/dev/null | tr -d '\r' | grep -m1 -o 'topResumedActivity=ActivityRecord{[^}]*}' || echo none; }
pidnow() { adb shell pidof com.printnest.app 2>/dev/null | tr -d '\r'; }
forward() { adb forward --remove tcp:9222 >/dev/null 2>&1 || true; adb forward tcp:9222 "localabstract:webview_devtools_remote_$1" >/dev/null 2>&1; }
text() { node "$HERE/webview-page.mjs" 9222 text 2>/dev/null || echo '{"error":"no text"}'; }
eval_js() { node "$HERE/webview-eval.mjs" 9222 "$1" 2>/dev/null || echo '{"error":"eval failed"}'; }
wait_text() { local end=$(( $(date +%s) + $2 )); while [ "$(date +%s)" -lt "$end" ]; do text | grep -q "$1" && return 0; sleep 3; done; return 1; }
log() { echo "PROBE $*"; }

pid=$(pidnow); log "pid=$pid top=$(top)"; forward "$pid"
wait_text 'Shop owner sign in' 150 && log "signin-screen=yes" || log "signin-screen=no $(text | cut -c1-200)"
log "A before back (sign-in, no history): top=$(top) history=$(eval_js 'JSON.stringify({len: history.length, hash: location.hash})')"
adb shell input keyevent KEYCODE_BACK; sleep 4
log "A after back: top=$(top) pid=$(pidnow)"
adb shell monkey -p com.printnest.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 10
pid=$(pidnow); log "relaunched pid=$pid top=$(top)"; forward "$pid"
wait_text 'Shop owner sign in' 120 && log "signin-screen-again=yes" || log "signin-screen-again=no $(text | cut -c1-200)"
eval_js 'window.__ev = []; addEventListener("popstate", () => __ev.push("popstate " + location.hash)); addEventListener("hashchange", () => __ev.push("hashchange " + location.hash)); "installed"' >/dev/null
node "$HERE/webview-page.mjs" 9222 click 'Create an account' >/dev/null 2>&1; sleep 4
log "B on register: history=$(eval_js 'JSON.stringify({len: history.length, hash: location.hash, canBack: history.length > 1})')"
adb shell input keyevent KEYCODE_BACK; sleep 4
log "B after back: top=$(top) pid=$(pidnow)"
log "B after back: history=$(eval_js 'JSON.stringify({len: history.length, hash: location.hash, events: __ev})')"
adb logcat -d -t 2000 > "$OUT/logcat.txt" 2>&1 || true
grep -iE 'Capacitor|BackPressed|onBack|keyevent|goBack|canGoBack|finish|moveTask' "$OUT/logcat.txt" | tail -40 | sed -E 's/^/LOG: /'
exit 0
