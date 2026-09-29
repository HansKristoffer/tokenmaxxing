#!/usr/bin/env bash
# Compiles the sync helper into the sidecar Tauri bundles (src-tauri/binaries/tokenmaxxing-helper-<triple>).
#   TAURI_ENV_TARGET_TRIPLE  set by `tauri build --target …`; defaults to this Mac.
#   universal-apple-darwin   builds both architectures and joins them with lipo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/app/desktop/src-tauri/binaries"
TRIPLE="${TAURI_ENV_TARGET_TRIPLE:-$(rustc -vV | sed -n 's/^host: //p')}"

# Dev builds run the helper from source (helper.rs); the binary only has to exist for the build.
if [ "${TAURI_ENV_DEBUG:-}" = true ] && [ -f "$OUT/tokenmaxxing-helper-$TRIPLE" ]; then exit 0; fi

build() { # <bun target> <outfile>
  # From the helper's own dir: `bun build --compile` inlines .env files from the cwd.
  (cd "$ROOT/app/helper" && bun build src/main.ts --compile --minify --target="$1" --outfile "$2")
}

case "$TRIPLE" in
  aarch64-apple-darwin) build bun-darwin-arm64 "$OUT/tokenmaxxing-helper-$TRIPLE" ;;
  x86_64-apple-darwin) build bun-darwin-x64 "$OUT/tokenmaxxing-helper-$TRIPLE" ;;
  # Tauri builds each architecture on its own, then bundles the joined one: it needs all three.
  universal-apple-darwin)
    build bun-darwin-arm64 "$OUT/tokenmaxxing-helper-aarch64-apple-darwin"
    build bun-darwin-x64 "$OUT/tokenmaxxing-helper-x86_64-apple-darwin"
    lipo -create "$OUT/tokenmaxxing-helper-aarch64-apple-darwin" "$OUT/tokenmaxxing-helper-x86_64-apple-darwin" \
      -output "$OUT/tokenmaxxing-helper-$TRIPLE" ;;
  *) echo "no helper build for $TRIPLE" >&2; exit 1 ;;
esac
