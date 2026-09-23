#!/usr/bin/env bash
# Assembles Tokenmaxxing.app from the Swift shell and the TypeScript helper.
#
#   build-app.sh dev       debug build; the helper runs from source via bun (restart the app to pick up TS changes)
#   build-app.sh release   compiled helper, hardened runtime, zipped; notarized when NOTARY_* is set
#
# Env:
#   TOKENMAXXING_SERVER_URL  server the app talks to (dev default: http://localhost:8787)
#   ARCH                     arm64 | x86_64 (release; default: this Mac's arch)
#   SIGN_IDENTITY            "Developer ID Application: …" (default: ad-hoc "-", runs locally only)
#   NOTARY_APPLE_ID, NOTARY_TEAM_ID, NOTARY_PASSWORD   enable notarization
set -euo pipefail

MODE="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MACOS="$ROOT/app/macos"
OUT="$ROOT/app/build"
APP="$OUT/Tokenmaxxing.app"
ARCH="${ARCH:-$(uname -m)}"
SIGN_IDENTITY="${SIGN_IDENTITY:--}"
VERSION="$(bun -e 'console.log(require(process.argv[1]).version)' "$ROOT/package.json")"
BUNDLE_ID="dk.hanskristoffer.tokenmaxxing"

case "$MODE" in
  dev) SERVER_URL="${TOKENMAXXING_SERVER_URL:-http://localhost:8787}"; CONFIG=debug ;;
  release)
    SERVER_URL="${TOKENMAXXING_SERVER_URL:?set TOKENMAXXING_SERVER_URL to the production server}"
    CONFIG=release ;;
  *) echo "usage: $0 dev|release" >&2; exit 2 ;;
esac

echo "==> Swift shell ($CONFIG, $ARCH)"
swift build --package-path "$MACOS" -c "$CONFIG" --arch "$ARCH"
BIN="$(swift build --package-path "$MACOS" -c "$CONFIG" --arch "$ARCH" --show-bin-path)/Tokenmaxxing"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Helpers" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Tokenmaxxing"
cp "$MACOS/icon/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>Tokenmaxxing</string>
	<key>CFBundleDisplayName</key><string>Tokenmaxxing</string>
	<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
	<key>CFBundleExecutable</key><string>Tokenmaxxing</string>
	<key>CFBundleIconFile</key><string>AppIcon</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleShortVersionString</key><string>$VERSION</string>
	<key>CFBundleVersion</key><string>$VERSION</string>
	<key>LSMinimumSystemVersion</key><string>14.0</string>
	<key>LSUIElement</key><true/>
	<key>NSHumanReadableCopyright</key><string>MIT License</string>
	<key>TMServerURL</key><string>$SERVER_URL</string>
</dict>
</plist>
PLIST

HELPER="$APP/Contents/Helpers/tokenmaxxing-helper"
if [ "$MODE" = dev ]; then
  echo "==> Helper (from source)"
  BUN="$(command -v bun)"
  # GUI apps get a minimal PATH, so bake in bun's absolute path.
  printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$BUN" "$ROOT/app/helper/src/main.ts" > "$HELPER"
  chmod +x "$HELPER"
else
  echo "==> Helper (compiled)"
  BUN_ARCH="$([ "$ARCH" = arm64 ] && echo arm64 || echo x64)"
  # `bun build --compile` can inline .env files from the cwd; build from a clean dir.
  (cd "$ROOT/app/helper" && bun build src/main.ts --compile --minify --target="bun-darwin-$BUN_ARCH" --outfile "$HELPER")
fi

echo "==> Signing ($SIGN_IDENTITY)"
if [ "$SIGN_IDENTITY" = "-" ]; then
  codesign --force --sign - "$HELPER"
  codesign --force --sign - "$APP"
else
  # Inside-out: the helper first (with Bun's JIT entitlements), then the bundle.
  codesign --force --timestamp --options runtime --entitlements "$MACOS/helper.entitlements" \
    --sign "$SIGN_IDENTITY" "$HELPER"
  codesign --force --timestamp --options runtime --sign "$SIGN_IDENTITY" "$APP"
fi
codesign --verify --strict --deep "$APP"

if [ "$MODE" = release ]; then
  ZIP="$OUT/Tokenmaxxing-$VERSION-$ARCH.zip"
  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
  if [ -n "${NOTARY_APPLE_ID:-}" ]; then
    echo "==> Notarizing"
    xcrun notarytool submit "$ZIP" --apple-id "$NOTARY_APPLE_ID" --team-id "$NOTARY_TEAM_ID" \
      --password "$NOTARY_PASSWORD" --wait
    xcrun stapler staple "$APP"
    rm -f "$ZIP"
    ditto -c -k --keepParent "$APP" "$ZIP"
  fi
  echo "==> $ZIP"
else
  echo "==> $APP"
fi
