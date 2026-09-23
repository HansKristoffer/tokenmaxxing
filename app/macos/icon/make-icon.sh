#!/usr/bin/env bash
# Regenerates app/macos/icon/AppIcon.icns from make-icon.swift.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
swift "$DIR/make-icon.swift" "$TMP/icon_1024.png"
SET="$TMP/AppIcon.iconset"
mkdir "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$TMP/icon_1024.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$TMP/icon_1024.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$DIR/AppIcon.icns"

rm -rf "$TMP"
echo "wrote $DIR/AppIcon.icns"
