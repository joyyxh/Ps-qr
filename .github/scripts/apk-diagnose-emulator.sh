#!/usr/bin/env bash
# Installs each earlier QRquick APK on the emulator and records what the package manager says.
# Three checks: a fresh install of each APK, an update chain (each APK installed over the
# previous one), and the install of a zip wrapper, which is what a GitHub artifact download is.
# Always exits 0, so the report step still runs.
set -uo pipefail

OUT="$RUNNER_TEMP/apk-diag"
LOG="$OUT/emulator.md"
PKG=com.printnest.app
: > "$LOG"

rows=()
while IFS= read -r line; do rows+=("$line"); done < <(tac "$OUT/apks.tsv" 2>/dev/null)

{
  echo
  echo "# Emulator install results"
  echo
  echo "- ABI: $(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  echo "- Android API level: $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "- APKs tested, oldest first: ${#rows[@]}"
} >> "$LOG"

echo "## Fresh install of each APK" >> "$LOG"
for row in "${rows[@]}"; do
  IFS=$'\t' read -r id sha created conclusion apk <<< "$row"
  adb uninstall "$PKG" >/dev/null 2>&1
  res="$(timeout 300 adb install "$apk" 2>&1 | tr -d '\r' | grep -vE '^Performing' | tail -n 2 | tr '\n' ' ')"
  {
    echo
    echo "- Run $id, commit $sha: $res"
  } >> "$LOG"
  if echo "$res" | grep -q '^Success\|Success'; then
    adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    sleep 15
    pid="$(adb shell pidof "$PKG" | tr -d '\r')"
    echo "  - App process after launch: ${pid:-not running}" >> "$LOG"
  else
    echo "  - Package manager log: $(adb logcat -d -t 400 2>/dev/null | grep -iE 'PackageManager|PackageInstaller|library' | tail -n 4 | tr '\n' ' ' | cut -c1-600)" >> "$LOG"
  fi
done

echo >> "$LOG"
echo "## Update chain (each APK installed over the previous one)" >> "$LOG"
adb uninstall "$PKG" >/dev/null 2>&1
first=1
for row in "${rows[@]}"; do
  IFS=$'\t' read -r id sha created conclusion apk <<< "$row"
  if [ "$first" -eq 1 ]; then
    res="$(timeout 300 adb install "$apk" 2>&1 | tr -d '\r' | tail -n 2 | tr '\n' ' ')"
    first=0
  else
    res="$(timeout 300 adb install -r "$apk" 2>&1 | tr -d '\r' | tail -n 2 | tr '\n' ' ')"
  fi
  echo "- Run $id, commit $sha: $res" >> "$LOG"
done

echo >> "$LOG"
echo "## Zip wrapper" >> "$LOG"
newest="$(head -n 1 "$OUT/apks.tsv" | cut -f5)"
if [ -n "$newest" ]; then
  python3 -c 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[2], "w", zipfile.ZIP_DEFLATED); z.write(sys.argv[1], "app-debug.apk"); z.close()' "$newest" "$OUT/artifact-wrapped.zip"
  adb uninstall "$PKG" >/dev/null 2>&1
  res="$(timeout 120 adb install "$OUT/artifact-wrapped.zip" 2>&1 | tr -d '\r' | tail -n 2 | tr '\n' ' ')"
  echo "- Installing the zip-wrapped newest APK: $res" >> "$LOG"
fi
exit 0
