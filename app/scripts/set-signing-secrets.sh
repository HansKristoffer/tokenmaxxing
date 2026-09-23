#!/usr/bin/env bash
# Uploads the Apple signing + notarization secrets the release workflow needs.
# Everything is typed at hidden prompts and piped straight to `gh secret set`;
# nothing is written to disk or echoed.
#
#   app/scripts/set-signing-secrets.sh ~/Desktop/DeveloperID.p12
set -euo pipefail

P12="${1:?usage: $0 path/to/DeveloperID.p12}"
REPO="${REPO:-HansKristoffer/tokenmaxxing}"
[ -f "$P12" ] || { echo "no such file: $P12" >&2; exit 1; }

read -rsp "Password you set when exporting the .p12: " P12_PASSWORD; echo
# The identity name codesign needs, e.g. "Developer ID Application: Hans Kristoffer (ABCDE12345)".
IDENTITY="$(openssl pkcs12 -in "$P12" -nokeys -passin "pass:$P12_PASSWORD" -legacy 2>/dev/null \
  || openssl pkcs12 -in "$P12" -nokeys -passin "pass:$P12_PASSWORD")"
IDENTITY="$(printf '%s' "$IDENTITY" | openssl x509 -noout -subject -nameopt multiline | sed -n 's/^ *commonName *= *//p')"
case "$IDENTITY" in
  "Developer ID Application:"*) echo "Identity: $IDENTITY" ;;
  *) echo "That .p12 is not a 'Developer ID Application' certificate (got: ${IDENTITY:-nothing})." >&2; exit 1 ;;
esac
TEAM_ID="$(printf '%s' "$IDENTITY" | sed -n 's/.*(\([A-Z0-9]*\))$/\1/p')"

read -rp "Apple ID email (for notarization): " APPLE_ID
read -rsp "App-specific password (appleid.apple.com → Sign-In and Security): " NOTARY_PASSWORD; echo

base64 -i "$P12" | gh secret set MACOS_CERT_P12 --repo "$REPO"
printf '%s' "$P12_PASSWORD" | gh secret set MACOS_CERT_PASSWORD --repo "$REPO"
printf '%s' "$IDENTITY" | gh secret set MACOS_SIGN_IDENTITY --repo "$REPO"
printf '%s' "$APPLE_ID" | gh secret set NOTARY_APPLE_ID --repo "$REPO"
printf '%s' "$TEAM_ID" | gh secret set NOTARY_TEAM_ID --repo "$REPO"
printf '%s' "$NOTARY_PASSWORD" | gh secret set NOTARY_PASSWORD --repo "$REPO"

echo "Done. Secrets on $REPO:"
gh secret list --repo "$REPO"
