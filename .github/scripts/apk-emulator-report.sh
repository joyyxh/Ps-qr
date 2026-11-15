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
  echo "## Log lines about crashes, libraries and the package"
  grep -iE 'FATAL|AndroidRuntime|UnsatisfiedLink|library|dlopen|com\.printnest|PackageManager|Process: ' "$OUT/logcat.txt" 2>/dev/null | tail -n 120 || echo "(no logcat)"
} > "$OUT/emulator-report.md"

jq -n --arg sha "$GITHUB_SHA" --rawfile summary "$OUT/emulator-report.md" \
  '{name: "APK emulator", head_sha: $sha, status: "completed", conclusion: "neutral",
    output: {title: "Emulator install and launch", summary: ($summary | .[0:60000])}}' > "$OUT/emulator-check.json"
gh api -X POST "repos/$GITHUB_REPOSITORY/check-runs" --input "$OUT/emulator-check.json" --jq '.html_url'
exit 0
