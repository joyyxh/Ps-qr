#!/usr/bin/env bash
# Posts the emulator install and launch results of the current APK as an "APK emulator" check run.
set -uo pipefail

OUT="$RUNNER_TEMP"
{
  echo "# Emulator install and launch of the APK built from $GITHUB_SHA"
  echo
  echo "## adb install"
  cat "$OUT/install.txt" 2>/dev/null || echo "(not run)"
  echo
  echo "## Monkey launch"
  cat "$OUT/monkey.txt" 2>/dev/null || echo "(not run)"
  echo
  echo "## Process id after launch"
  cat "$OUT/pid.txt" 2>/dev/null || echo "(none)"
  echo
  echo "## Install of the same APK wrapped in a zip (what a GitHub artifact download is)"
  cat "$OUT/zip-install.txt" 2>/dev/null || echo "(not run)"
  echo
  APK="$GITHUB_WORKSPACE/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
  echo "## Built APK"
  echo "- File: app-debug.apk"
  echo "- Bytes: $(stat -c %s "$APK" 2>/dev/null || echo missing)"
  echo "- SHA-256: $(sha256sum "$APK" 2>/dev/null | cut -d' ' -f1)"
  echo "- Commit: $GITHUB_SHA"
  echo
  echo "## Log lines about crashes, libraries and the package"
  grep -iE 'FATAL|AndroidRuntime|UnsatisfiedLink|library|dlopen|com\.printnest|PackageManager|Process: ' "$OUT/logcat.txt" 2>/dev/null | tail -n 120 || echo "(no logcat)"
} > "$OUT/emulator-report.md"

jq -n --arg sha "$GITHUB_SHA" --rawfile summary "$OUT/emulator-report.md" \
  '{name: "APK emulator", head_sha: $sha, status: "completed", conclusion: "neutral",
    output: {title: "Emulator install and launch", summary: ($summary | .[0:60000])}}' > "$OUT/emulator-check.json"
if posted="$(gh api -X POST "repos/$GITHUB_REPOSITORY/check-runs" --input "$OUT/emulator-check.json" --jq '.html_url' 2>&1)"; then
  echo "::notice title=APK emulator report::$posted"
else
  echo "::error title=APK emulator report::Could not post the check run: $(echo "$posted" | tr '\n' ' ' | cut -c1-400)"
fi
exit 0
