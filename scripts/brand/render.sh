#!/usr/bin/env bash
# Renders PNG/ICO exports from the path-only master SVGs in docs/brand/assets/.
# The masters contain no <text> and no font references, so any renderer works.
# Requires ImageMagick (magick).
set -euo pipefail
cd "$(dirname "$0")/../.."

ASSETS=docs/brand/assets
ADMIN=apps/admin/src/app
RES=apps/android/app/src/main/res

# --- Admin web icons (dark squircle works on any browser chrome) ---
# -depth 8: 8-bit PNG — Play Store and launchers expect 32-bit RGBA, not 64-bit.
cp "$ASSETS/icon-dark.svg" "$ADMIN/icon.svg"
magick "$ASSETS/icon-dark.svg" -resize 180x180 -depth 8 "$ADMIN/apple-icon.png"
magick "$ASSETS/icon-dark.svg" -resize 512x512 -depth 8 "$ADMIN/icon.png"
magick "$ASSETS/icon-dark.svg" -depth 8 -define icon:auto-resize=16,32,48 "$ADMIN/favicon.ico"

# --- Android legacy launcher icons (pre-8.0 devices) ---
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  dpi=${pair%%:*}
  size=${pair##*:}
  half=$((size / 2))
  mkdir -p "$RES/mipmap-$dpi"
  magick "$ASSETS/icon-dark.svg" -resize "${size}x${size}" -depth 8 "$RES/mipmap-$dpi/ic_launcher.png"
  magick "$ASSETS/icon-dark.svg" -resize "${size}x${size}" \
    \( -size "${size}x${size}" xc:none -fill white -draw "circle $half,$half $half,0" \) \
    -compose DstIn -composite -depth 8 "$RES/mipmap-$dpi/ic_launcher_round.png"
done

# --- Play Store listing icon (upload artifact, not shipped in the APK) ---
magick "$ASSETS/icon-dark.svg" -resize 512x512 -depth 8 "$ASSETS/playstore-512.png"

echo "renders done"
