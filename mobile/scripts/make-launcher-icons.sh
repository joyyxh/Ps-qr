#!/usr/bin/env bash
# Generates the QRquick Android launcher icons from the brand mark.
#
# Output (committed, copied into the Android project by the APK workflow):
#   mobile/branding/res/mipmap-*/ic_launcher.png          legacy square icon
#   mobile/branding/res/mipmap-*/ic_launcher_round.png    legacy round icon
#   mobile/branding/res/mipmap-*/ic_launcher_foreground.png  adaptive foreground
#   mobile/branding/res/mipmap-anydpi-v26/ic_launcher*.xml   adaptive icon wiring
#   mobile/branding/res/values/ic_launcher_background.xml    adaptive background colour
#
# Source: web/icons/qrquick-mark.png (256x256, mark on a near-black background).
# Requires ImageMagick (magick or convert). Run from anywhere:
#   bash mobile/scripts/make-launcher-icons.sh

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SRC="$REPO/web/icons/qrquick-mark.png"
OUT="$REPO/mobile/branding/res"
BG_HEX="#050711"            # the mark's own corner colour, so legacy and background match
MARK_PERCENT=55             # mark size inside the 108dp adaptive canvas (safe zone is 66dp)

if command -v magick >/dev/null 2>&1; then IM="magick"; else IM="convert"; fi
command -v "$IM" >/dev/null 2>&1 || { echo "ImageMagick is required." >&2; exit 1; }
test -s "$SRC" || { echo "Missing source mark: $SRC" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Foreground: flood-fill the outer background from the four corners so only the
# mark remains opaque. The inner QR block is enclosed by the coloured ring, so the
# fill never reaches it.
"$IM" "$SRC" -alpha set -fuzz 12% -fill none \
  -draw 'color 0,0 floodfill' -draw 'color 255,0 floodfill' \
  -draw 'color 0,255 floodfill' -draw 'color 255,255 floodfill' \
  "$TMP/mark-transparent.png"

# density bucket : legacy px : adaptive px
BUCKETS=(
  "mdpi 48 108"
  "hdpi 72 162"
  "xhdpi 96 216"
  "xxhdpi 144 324"
  "xxxhdpi 192 432"
)

rm -rf "$OUT"
mkdir -p "$OUT/mipmap-anydpi-v26" "$OUT/values"

for bucket in "${BUCKETS[@]}"; do
  read -r density legacy adaptive <<<"$bucket"
  dir="$OUT/mipmap-$density"
  mkdir -p "$dir"

  # Legacy square icon: the full mark, which already carries the background colour.
  "$IM" "$SRC" -resize "${legacy}x${legacy}" "$dir/ic_launcher.png"

  # Legacy round icon: the same art clipped to a circle.
  "$IM" -size "${legacy}x${legacy}" xc:none -fill white \
    -draw "circle $((legacy / 2)),$((legacy / 2)) $((legacy / 2)),0" "$TMP/mask-$legacy.png"
  "$IM" "$dir/ic_launcher.png" -alpha set -background none \
    \( "$TMP/mask-$legacy.png" -alpha extract \) -compose CopyOpacity -composite \
    "PNG32:$dir/ic_launcher_round.png"

  # Adaptive foreground: transparent canvas with the mark centred at MARK_PERCENT.
  inner=$(( adaptive * MARK_PERCENT / 100 ))
  "$IM" "$TMP/mark-transparent.png" -resize "${inner}x${inner}" \
    -background none -gravity center -extent "${adaptive}x${adaptive}" \
    "$dir/ic_launcher_foreground.png"
done

cat > "$OUT/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
cp "$OUT/mipmap-anydpi-v26/ic_launcher.xml" "$OUT/mipmap-anydpi-v26/ic_launcher_round.xml"

cat > "$OUT/values/ic_launcher_background.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BG_HEX</color>
</resources>
XML

echo "Wrote launcher icons to $OUT"
