#!/usr/bin/env bash
# Checks the installed QRquick APK on the emulator.
#
# Runs inside the android-emulator-runner script block, after the app has been launched.
# The app's WebView is read through its DevTools socket (webview-page.mjs), which shows the
# real page state and clicks with real mouse input. The launcher label is read with
# uiautomator. The checks cover the pre-login screen, no owner tabs before sign-in, the
# registration link, Back navigation, reopening the app, and the process staying alive.
# It does not sign in, because CI has no owner account.
#
# Usage: bash .github/scripts/apk-ui-check.sh <output-directory>
# Writes screenshots, page snapshots, the WebView log tail and results.txt into the output
# directory. Exits non-zero when a required check fails.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?usage: apk-ui-check.sh <output-directory>}"
PKG="com.printnest.app"
DEVTOOLS_PORT=9222
mkdir -p "$OUT"
RESULTS="$OUT/results.txt"
: > "$RESULTS"
FAILED=0
STEP=0
PAGE=""

pass() { echo "PASS  $1" | tee -a "$RESULTS"; }
fail() { echo "FAIL  $1" | tee -a "$RESULTS"; FAILED=$((FAILED + 1)); }
warn() { echo "WARN  $1" | tee -a "$RESULTS"; }

shot() { # name -> numbered screenshot file
  STEP=$((STEP + 1))
  local file; file="$OUT/$(printf '%02d' "$STEP")-$1.png"
  adb exec-out screencap -p > "$file" 2>/dev/null || true
  echo "      screenshot: $file"
}

diagnose() { # print what the WebView showed, for the log and the artifact
  {
    echo "--- last page snapshot"
    printf '%s\n' "$PAGE" | cut -c1-1500
    echo "--- foreground activity"
    adb shell dumpsys activity activities 2>/dev/null | tr -d '\r' | grep -m3 -E 'mResumedActivity|topResumedActivity' || true
    echo "--- DevTools sockets"
    adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -i devtools | head -5 || true
    echo "--- WebView and app log lines"
    adb logcat -d -t 4000 2>/dev/null | grep -iE "chromium|webview|capacitor|console|uncaught|err_|$PKG" | tail -n 80 || true
  } | tee -a "$OUT/diagnostics.txt"
}

open_webview() { # forward the app's DevTools socket to a local port
  local pid socket=""
  for _ in $(seq 1 40); do
    pid="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
    if [ -n "$pid" ]; then
      socket="$(adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o "webview_devtools_remote_${pid}" | head -n 1)"
      [ -n "$socket" ] && break
    fi
    sleep 3
  done
  [ -n "$socket" ] || return 1
  adb forward "tcp:$DEVTOOLS_PORT" "localabstract:$socket" >/dev/null 2>&1
}

read_page() { # one snapshot of the WebView: JSON with url, title, text, tabsVisible
  PAGE="$(node "$HERE/webview-page.mjs" "$DEVTOOLS_PORT" text 2>>"$OUT/devtools-errors.txt" || true)"
  printf '%s' "$PAGE"
}

wait_for_page() { # text fragment, seconds -> exit 0 when the page shows it
  local deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    read_page >/dev/null   # sets PAGE in this shell (no subshell here)
    if printf '%s' "$PAGE" | grep -Fq "$1"; then return 0; fi
    sleep 3
  done
  return 1
}

wait_for_signin() { # seconds -> exit 0 on the sign-in screen (its button, not the registration screen)
  local deadline=$((SECONDS + $1))
  while [ "$SECONDS" -lt "$deadline" ]; do
    read_page >/dev/null   # sets PAGE in this shell (no subshell here)
    if printf '%s' "$PAGE" | grep -Fq 'Sign in' && ! printf '%s' "$PAGE" | grep -Fq 'Create account'; then
      return 0
    fi
    sleep 3
  done
  return 1
}

click_text() { # text fragment -> exit 0 when a button or link was clicked
  local answer
  answer="$(node "$HERE/webview-page.mjs" "$DEVTOOLS_PORT" click "$1" 2>>"$OUT/devtools-errors.txt" || true)"
  echo "      click: $answer"
  printf '%s' "$answer" | grep -Fq '"clicked":"'
}

# 0. Connect to the WebView through its DevTools socket.
if open_webview; then
  pass "webview: the app's WebView is reachable for checks"
else
  fail "webview: no DevTools socket for the app's WebView (the debug build should expose one)"
  diagnose
fi

# 1. The sign-in screen is the first screen, and the owner tabs are hidden.
if wait_for_signin 180; then
  pass "pre-login: the sign-in screen is shown"
else
  fail "pre-login: the sign-in screen did not appear within 180 seconds"
  diagnose
fi
shot "signin"

if printf '%s' "$PAGE" | grep -Fq '"tabsVisible":false'; then
  pass "pre-login: no owner tabs are visible before sign-in"
else
  fail "pre-login: owner tabs are visible, or the page could not be read, before sign-in"
fi

if printf '%s' "$PAGE" | grep -Fq 'QRquick'; then
  pass "pre-login: the QRquick name is on the sign-in screen"
else
  fail "pre-login: the QRquick name is not on the sign-in screen"
fi

# 2. Registration opens from the sign-in screen.
if click_text 'Create an account'; then
  if wait_for_page 'Create account' 30; then
    pass "registration: the create-account screen opens"
  else
    fail "registration: the create-account screen did not open after the link was clicked"
    diagnose
  fi
  if printf '%s' "$PAGE" | grep -Fq 'Already have an account'; then
    pass "registration: a link back to sign-in is offered"
  else
    fail "registration: no link back to sign-in"
  fi
  shot "register"

  # 3. Back returns to the sign-in screen rather than closing the app.
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  if wait_for_signin 30; then
    pass "navigation: Back returns to the sign-in screen"
  else
    fail "navigation: Back did not return to the sign-in screen"
    diagnose
  fi
  shot "back"
else
  fail "registration: no 'Create an account' button or link was found on the sign-in screen"
  diagnose
fi

# 4. The launcher shows the app name (best effort: the icon may not be on the home screen).
adb shell input keyevent KEYCODE_HOME
sleep 4
adb shell uiautomator dump /sdcard/qrq-home.xml >/dev/null 2>&1 || true
adb pull /sdcard/qrq-home.xml "$OUT/home.xml" >/dev/null 2>&1 || : > "$OUT/home.xml"
if grep -Fq 'text="QRquick"' "$OUT/home.xml" || grep -Fq 'content-desc="QRquick"' "$OUT/home.xml"; then
  pass "launcher: the app is labelled QRquick"
else
  warn "launcher: QRquick was not found on the home screen (the label is also checked in the APK badging)"
fi
shot "launcher"

# 5. Reopening the app lands on the protected sign-in screen again.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
if wait_for_signin 90; then
  pass "reopen: the app opens on the sign-in screen"
else
  fail "reopen: the app did not open on the sign-in screen"
  diagnose
fi
shot "reopen"

if adb shell pidof "$PKG" >/dev/null 2>&1; then
  pass "process: the app is still running after the checks"
else
  fail "process: the app is not running after the checks"
fi

adb logcat -d -t 4000 > "$OUT/logcat-tail.txt" 2>/dev/null || true

{
  echo "### Emulator screen checks"
  echo ""
  echo '```'
  cat "$RESULTS"
  echo '```'
  echo ""
  echo "Screenshots, page snapshots and the WebView log tail are in the qrquick-ui-check artifact."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "Checks failed: $FAILED"
[ "$FAILED" -eq 0 ]
