#!/usr/bin/env bash
# Posts the diagnosis as an "APK diagnostics" check run, so its text can be read through the REST API.
set -uo pipefail

OUT="$RUNNER_TEMP/apk-diag"
mkdir -p "$OUT"
touch "$OUT/report.md" "$OUT/emulator.md"
SUMMARY="$(cat "$OUT/report.md" "$OUT/emulator.md" | head -c 60000)"
jq -n --arg sha "$GITHUB_SHA" --arg summary "$SUMMARY" \
  '{name: "APK diagnostics", head_sha: $sha, status: "completed", conclusion: "neutral",
    output: {title: "Earlier QRquick APK diagnostics", summary: $summary}}' > "$OUT/check.json"
gh api -X POST "repos/$GITHUB_REPOSITORY/check-runs" --input "$OUT/check.json" --jq '.html_url'
exit 0
