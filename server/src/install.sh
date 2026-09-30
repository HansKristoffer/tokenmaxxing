#!/bin/sh
# Installs the `tokenmaxxing` CLI on a second computer, then runs it with this script's arguments:
#   curl -fsSL __SERVER__/install.sh | sh -s -- link <code>
# The app's "Link a computer…" gives you this line with a code in it.
set -eu

SERVER="__SERVER__"
BASE="${TOKENMAXXING_DOWNLOAD_BASE:-https://github.com/HansKristoffer/tokenmaxxing/releases/latest/download}"
DIR="${TOKENMAXXING_INSTALL_DIR:-$HOME/.local/bin}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "tokenmaxxing runs on macOS and Linux (on Windows, inside WSL)." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "tokenmaxxing doesn't run on $(uname -m) yet." >&2; exit 1 ;;
esac
# A shell running under Rosetta on an Apple Silicon Mac still gets the native build.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -in hw.optional.arm64 2>/dev/null)" = 1 ]; then
  arch=arm64
fi

file="tokenmaxxing-$os-$arch"
tmp="$(mktemp -d)"
# Keeps the exit status: some shells otherwise exit with the trap's.
trap 'status=$?; rm -rf "$tmp"; exit $status' EXIT
echo "Downloading ${file}…"
curl -fsSL -o "$tmp/$file" "$BASE/$file"
curl -fsSL -o "$tmp/SHA256SUMS" "$BASE/SHA256SUMS"
want="$(grep " $file\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
if command -v sha256sum >/dev/null 2>&1; then
  got="$(sha256sum "$tmp/$file" | cut -d' ' -f1)"
else
  got="$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)"
fi
if [ -z "$want" ] || [ "$want" != "$got" ]; then
  echo "The download didn't match its checksum; nothing was installed." >&2
  exit 1
fi

mkdir -p "$DIR"
chmod +x "$tmp/$file"
mv "$tmp/$file" "$DIR/tokenmaxxing"
echo "Installed $DIR/tokenmaxxing"
case ":$PATH:" in
  *":$DIR:"*) ;;
  *) echo "To run it yourself, add it to your PATH: export PATH=\"$DIR:\$PATH\"" ;;
esac

if [ $# -gt 0 ]; then
  TOKENMAXXING_SERVER_URL="$SERVER" exec "$DIR/tokenmaxxing" "$@"
fi
