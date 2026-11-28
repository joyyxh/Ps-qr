#!/usr/bin/env bash
# Downloads the APK artifacts of recent Android APK runs, for diagnosis only.
# GitHub wraps each artifact in a zip; gh extracts it, so the APK file is left in place.
set -uo pipefail

OUT="$RUNNER_TEMP/apk-diag"
REPO="$GITHUB_REPOSITORY"
rm -rf "$OUT"
mkdir -p "$OUT/runs"
: > "$OUT/runs.txt"
: > "$OUT/apks.tsv"

gh run list -R "$REPO" -w android-apk.yml -L 12 \
  --json databaseId,headSha,conclusion,createdAt,status > "$OUT/runs.json" </dev/null

jq -r '.[] | select(.status == "completed") | [.databaseId, .headSha, .createdAt, .conclusion] | @tsv' "$OUT/runs.json" |
while IFS=$'\t' read -r id sha created conclusion; do
  dir="$OUT/runs/$id"
  mkdir -p "$dir"
  if gh run download "$id" -R "$REPO" -D "$dir" > "$dir/download.log" 2>&1 </dev/null; then
    result="downloaded"
  else
    result="not downloaded: $(tail -n 1 "$dir/download.log")"
  fi
  printf '%s\t%s\t%s\t%s\n' "$id" "${sha:0:7}" "$created" "$result" >> "$OUT/runs.txt"
  find "$dir" -type f -name '*.apk' | sort | while read -r apk; do
    printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$sha" "$created" "$conclusion" "$apk" >> "$OUT/apks.tsv"
  done
done

echo "APK files found: $(wc -l < "$OUT/apks.tsv")"
exit 0
