#!/usr/bin/env bash
# Builds the `tokenmaxxing` CLI for every platform it runs on, and their checksums, into $1 (dist/cli).
# Run on a Mac: Bun signs the macOS binaries it compiles there (ad hoc), which Apple Silicon requires.
# They're downloaded with curl, which doesn't quarantine them, so Gatekeeper doesn't ask for more.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$(mkdir -p "${1:-$ROOT/dist/cli}" && cd "${1:-$ROOT/dist/cli}" && pwd)"

# <bun target> <name>. x64 Linux uses the baseline build: workhorse VMs often lack AVX2.
targets=(
  "bun-darwin-arm64 tokenmaxxing-darwin-arm64"
  "bun-darwin-x64 tokenmaxxing-darwin-x64"
  "bun-linux-arm64 tokenmaxxing-linux-arm64"
  "bun-linux-x64-baseline tokenmaxxing-linux-x64"
)
for t in "${targets[@]}"; do
  read -r target name <<<"$t"
  # From the helper's own dir: `bun build --compile` inlines .env files from the cwd.
  (cd "$ROOT/app/helper" && bun build src/cli.ts --compile --minify --target="$target" --outfile "$OUT/$name")
done
(cd "$OUT" && shasum -a 256 tokenmaxxing-* > SHA256SUMS)
cat "$OUT/SHA256SUMS"
