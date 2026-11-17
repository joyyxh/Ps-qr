#!/usr/bin/env bash
# Checks the installed QRquick APK on the emulator by reading the screen with uiautomator.
#
# Runs inside the android-emulator-runner script block, after the app has been launched.
# It proves what a screen reader or a tester would see: the pre-login screen, the
# registration screen, Back navigation, the launcher label, and that no owner tabs are
# visible before sign-in. It does not sign in, because no test account exists in CI.
#
# Usage: bash .github/scripts/apk-ui-check.sh <output-directory>
# Writes screenshots, uiautomator XML dumps and results.txt into the output directory.
# Exits non-zero when a required check fails.

set -uo pipefail

OUT="${1:?usage: apk-ui-check.sh <output-directory>}"
PKG="com.printnest.app"
mkdir -p "$OUT"
RESULTS="$OUT/results.txt"
: > "$RESULTS"
FAILED=0
STEP=0

pass() { echo "PASS  $1" | tee -a "$RESULTS"; }
fail() { echo "FAIL  $1" | tee -a "$RESULTS"; FAILED=$((FAILED + 1)); }
warn() { echo "WARN  $1" | tee -a "$RESULTS"; }

shot() { # name -> screenshot file
  STEP=$((STEP + 1))
  local file; file="$OUT/$(printf '%02d' "$STEP")-$1.png"
  adb exec-out screencap -p > "$file" 2>/dev/null || true
  echo "      screenshot: $file"
}

dump_ui() { # xml file to write
  adb shell uiautomator dump /sdcard/qrq-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/qrq-ui.xml "$1" >/dev/null 2>&1 || : > "$1"
}

has_text() { # exact attribute, xml file -> exit 0 when present
  grep -Fq "$1" "$2"
}

wait_for() { # exact attribute, seconds, xml file -> exit 0 when it appears
  local deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    dump_ui "$3"
    has_text "$1" "$3" && return 0
    sleep 3
  done
  return 1
}

centre_of() { # xml file, text fragment -> prints "x y" of the first node containing it
  python3 - "$1" "$2" <<'PY'
import re, sys
import xml.etree.ElementTree as ET

path, wanted = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(path).getroot()
except Exception:
    sys.exit(0)
for node in root.iter('node'):
    label = node.get('text', '') or node.get('content-desc', '')
    if wanted in label:
        numbers = [int(n) for n in re.findall(r'\d+', node.get('bounds', ''))]
        if len(numbers) == 4:
            x1, y1, x2, y2 = numbers
            print((x1 + x2) // 2, (y1 + y2) // 2)
            sys.exit(0)
PY
}

XML="$OUT/ui.xml"

# 1. The sign-in screen is the first screen (the owner app is protected).
if wait_for 'text="Sign in"' 150 "$XML"; then
  pass "pre-login: the sign-in screen is shown"
else
  fail "pre-login: the sign-in screen did not appear within 150 seconds"
fi
shot "signin"

if has_text 'text="Orders"' "$XML" || has_text 'text="Stats"' "$XML" || has_text 'text="Prices"' "$XML"; then
  fail "pre-login: owner tabs are visible before sign-in"
else
  pass "pre-login: no owner tabs are visible before sign-in"
fi

if has_text 'QRquick' "$XML"; then
  pass "pre-login: the QRquick name is on the sign-in screen"
else
  fail "pre-login: the QRquick name is not on the sign-in screen"
fi

# 2. Registration opens from the sign-in screen.
REG_XY="$(centre_of "$XML" 'Create an account')"
if [ -n "$REG_XY" ]; then
  # shellcheck disable=SC2086
  adb shell input tap $REG_XY
  if wait_for 'text="Create account"' 30 "$XML"; then
    pass "registration: the create-account screen opens"
  else
    fail "registration: the create-account screen did not open after tapping the link"
  fi
  has_text 'Already have an account' "$XML" && pass "registration: the sign-in link is offered" || fail "registration: no link back to sign-in"
  shot "register"

  # 3. Back returns to the sign-in screen rather than closing the app.
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  if wait_for 'text="Sign in"' 30 "$XML"; then
    pass "navigation: Back returns to the sign-in screen"
  else
    fail "navigation: Back did not return to the sign-in screen"
  fi
  shot "back"
else
  fail "registration: no 'Create an account' link was found on the sign-in screen"
fi

# 4. The launcher shows the app name (best effort: the icon may not be on the home screen).
adb shell input keyevent KEYCODE_HOME
sleep 4
dump_ui "$OUT/home.xml"
if has_text 'text="QRquick"' "$OUT/home.xml" || has_text 'content-desc="QRquick"' "$OUT/home.xml"; then
  pass "launcher: the app is labelled QRquick"
else
  warn "launcher: QRquick was not found on the home screen (the label is also checked in the APK badging)"
fi
shot "launcher"

# 5. Reopening the app lands on the protected sign-in screen again.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
if wait_for 'text="Sign in"' 60 "$XML"; then
  pass "reopen: the app opens on the sign-in screen"
else
  fail "reopen: the app did not open on the sign-in screen"
fi
shot "reopen"

if adb shell pidof "$PKG" >/dev/null 2>&1; then
  pass "process: the app is still running after the checks"
else
  fail "process: the app is not running after the checks"
fi

{
  echo "### Emulator screen checks"
  echo ""
  echo '```'
  cat "$RESULTS"
  echo '```'
  echo ""
  echo "Screenshots and uiautomator dumps are in the qrquick-ui-check artifact."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "Checks failed: $FAILED"
[ "$FAILED" -eq 0 ]
