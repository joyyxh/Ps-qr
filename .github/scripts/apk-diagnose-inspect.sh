#!/usr/bin/env bash
# Inspects each downloaded QRquick APK: file, signing, manifest, native libraries and bundled config.
set -uo pipefail

OUT="$RUNNER_TEMP/apk-diag"
REPORT="$OUT/report.md"
BT="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
APKSIGNER="$BT/apksigner"
AAPT="$BT/aapt"

{
  echo "# Earlier QRquick APKs"
  echo
  echo "- Build tools: $(basename "$BT")"
  if [ ! -s "$OUT/apks.tsv" ]; then
    echo "- No APK files were found in the recent runs."
  fi
} > "$REPORT"

n=0
while IFS=$'\t' read -r id sha created conclusion apk; do
  n=$((n + 1))
  {
    echo
    echo "## $n. run $id, commit $sha, $created"
    echo "- File: $(basename "$(dirname "$apk")")/$(basename "$apk")"
    echo "- Size: $(stat -c %s "$apk") bytes"
    echo "- SHA-256: $(sha256sum "$apk" | cut -d' ' -f1)"
    if unzip -tq "$apk" >/dev/null 2>&1; then echo "- Zip structure: valid"; else echo "- Zip structure: INVALID"; fi
    echo "- Signing:"
    "$APKSIGNER" verify --verbose --print-certs "$apk" 2>&1 | grep -E 'Verifies|scheme|SHA-256 digest|Signer' | sed 's/^/  - /'
    echo "- Badging:"
    "$AAPT" dump badging "$apk" 2>&1 | grep -E "^package|sdkVersion|targetSdkVersion|native-code|uses-library|uses-permission|feature" | sed 's/^/  - /'
    echo "- Manifest libraries (uses-library / uses-native-library):"
    libs="$("$AAPT" dump xmltree "$apk" AndroidManifest.xml 2>&1 | grep -A4 -E 'E: (uses-library|uses-native-library)')"
    if [ -n "$libs" ]; then echo "$libs" | sed 's/^/  /'; else echo "  - none declared"; fi
    echo "- Native libraries by ABI:"
    abis="$(unzip -l "$apk" | awk '$4 ~ /^lib\//{split($4, p, "/"); print p[2]}' | sort | uniq -c)"
    if [ -n "$abis" ]; then echo "$abis" | sed 's/^/  - /'; else echo "  - none (no lib/ folder)"; fi
    echo "- Dex files: $(unzip -l "$apk" | grep -cE ' classes[0-9]*\.dex$')"
    if unzip -l "$apk" | grep -q 'assets/public/index.html'; then echo "- Bundled web app: present"; else echo "- Bundled web app: MISSING"; fi
    echo "- Bundled config: $(unzip -p "$apk" assets/public/config.js 2>/dev/null | grep -oE 'ownerApp: [a-z]+' | head -n 1 || true)"
    echo "- Bundled QR address: $(unzip -p "$apk" assets/public/config.js 2>/dev/null | grep -oE "publicBaseUrl: '[^']*'" | head -n 1 || true)"
  } >> "$REPORT"
done < "$OUT/apks.tsv"

exit 0
