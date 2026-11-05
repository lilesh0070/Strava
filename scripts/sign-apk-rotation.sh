#!/usr/bin/env bash
# Re-signs a release APK with APK Signature Scheme v3 key rotation, so installed copies move from the old key
# (the shared React Native debug key) to the private release key IN PLACE, with their data:
#   - v2 signature: the old key. Android 7–8 (API 24–27) only check v2, so they keep updating as before.
#   - v3 signature: the new key plus a lineage old → new made here with `apksigner rotate`, used from
#     Android 9 (--rotation-min-sdk-version 28). Android 9+ installs it over an app signed with the old key and
#     from then on trusts only the new key: the old key gets no rollback capability, so an APK signed only with
#     the debug key can no longer replace the app there.
# Used by .github/workflows/release.yml (real key) and .github/workflows/signing-selftest.yml (throwaway key),
# so the exact commands a release relies on are proven on a runner without the real secrets.
#
#   scripts/sign-apk-rotation.sh <in.apk> <out.apk>
#
# Environment:
#   OLD_KEYSTORE           debug keystore (android/app/debug.keystore after `expo prebuild`; alias
#                          androiddebugkey, password android)
#   NEW_KEYSTORE           release keystore (.jks or PKCS12)
#   NEW_KEY_ALIAS          its key alias
#   NEW_KEYSTORE_PASSWORD  its store password (handed to keytool/apksigner by variable name, never printed)
#   NEW_KEY_PASSWORD       its key password (optional; default: the store password)
#   EXPECT_SIGNER          optional "AB:CD:…": what the app embeds as extra.signer; must be the v3 signer
#   EXPECT_LINEAGE         optional "OLD,NEW": what update.json lists as lineage; must be the APK's lineage
#   LINEAGE_FILE           optional: where to write the lineage (default: a temp file)
#   APKSIGNER, ZIPALIGN    optional tool paths (default: the newest $ANDROID_HOME/build-tools/<version>)
set -euo pipefail

fail() { echo "::error::$*" >&2; exit 1; }

[ $# -eq 2 ] || fail "usage: scripts/sign-apk-rotation.sh <in.apk> <out.apk>"
IN=$1
OUT=$2
[ -s "$IN" ] || fail "input APK not found: $IN"
[ "$(realpath -m "$IN")" != "$(realpath -m "$OUT")" ] || fail "the output APK must be a different file than the input"
for v in OLD_KEYSTORE NEW_KEYSTORE NEW_KEY_ALIAS NEW_KEYSTORE_PASSWORD; do
  [ -n "${!v:-}" ] || fail "$v is not set"
done
[ -s "$OLD_KEYSTORE" ] || fail "debug keystore not found: $OLD_KEYSTORE"
[ -s "$NEW_KEYSTORE" ] || fail "release keystore not found: $NEW_KEYSTORE"
export NEW_KEYSTORE_PASSWORD
NEW_KEY_PASSWORD=${NEW_KEY_PASSWORD:-$NEW_KEYSTORE_PASSWORD}
export NEW_KEY_PASSWORD
OLD_KEY_ALIAS=androiddebugkey
OLD_KEYSTORE_PASSWORD=android # the public React Native debug key's password, not a secret
export OLD_KEYSTORE_PASSWORD

# ---- tools: apksigner and zipalign from the newest installed build-tools
if [ -z "${APKSIGNER:-}" ] || [ -z "${ZIPALIGN:-}" ]; then
  sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  [ -n "$sdk" ] && [ -d "$sdk/build-tools" ] || fail "Android SDK build-tools not found (ANDROID_HOME='$sdk')"
  bt=$(for d in "$sdk"/build-tools/*/; do
    d=${d%/} && d=${d##*/} && [[ $d =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && echo "$d"
  done | sort -V | tail -n 1 || true) # stable versions only (no -rc)
  [ -n "$bt" ] || fail "no build-tools version found in $sdk/build-tools"
  echo "Using build-tools $bt"
  APKSIGNER=${APKSIGNER:-$sdk/build-tools/$bt/apksigner}
  ZIPALIGN=${ZIPALIGN:-$sdk/build-tools/$bt/zipalign}
fi
[ -x "$APKSIGNER" ] || fail "apksigner not found: $APKSIGNER"
[ -x "$ZIPALIGN" ] || fail "zipalign not found: $ZIPALIGN"
help=$("$APKSIGNER" sign -h 2>&1 || true)
grep -q -- '--rotation-min-sdk-version' <<<"$help" ||
  fail "$APKSIGNER does not support --rotation-min-sdk-version (needs build-tools 33.0.1 or newer)"

# ---- fingerprints ("AB:CD:…", as keytool prints them and the app compares them)
fp() { # <keystore> <alias> <name of the variable holding the store password>
  local out
  out=$(keytool -list -v -keystore "$1" -alias "$2" -storepass:env "$3" 2>&1) || {
    grep -i 'error' <<<"$out" >&2 || true
    return 0
  }
  awk '/SHA256:/ { print $2; exit }' <<<"$out"
}
is_fp() { [[ $1 =~ ^([0-9A-F]{2}:){31}[0-9A-F]{2}$ ]]; }
hex() { tr -d ':' <<<"$1" | tr 'A-F' 'a-f'; } # apksigner prints digests as lowercase hex
OLD_FP=$(fp "$OLD_KEYSTORE" "$OLD_KEY_ALIAS" OLD_KEYSTORE_PASSWORD)
is_fp "$OLD_FP" || fail "could not read the debug key from $OLD_KEYSTORE"
NEW_FP=$(fp "$NEW_KEYSTORE" "$NEW_KEY_ALIAS" NEW_KEYSTORE_PASSWORD)
is_fp "$NEW_FP" || fail "could not read the release key (check the keystore password and the key alias)"
[ "$OLD_FP" != "$NEW_FP" ] || fail "the release key is the debug key: nothing to rotate to"
echo "Old key (v2 signature, Android 7-8; first in the lineage): $OLD_FP"
echo "New key (v3 signature, Android 9+):                       $NEW_FP"
if [ -n "${EXPECT_SIGNER:-}" ] && [ "$EXPECT_SIGNER" != "$NEW_FP" ]; then
  fail "the app embeds signer $EXPECT_SIGNER, but the release key is $NEW_FP"
fi
if [ -n "${EXPECT_LINEAGE:-}" ] && [ "$EXPECT_LINEAGE" != "$OLD_FP,$NEW_FP" ]; then
  fail "update.json would list lineage $EXPECT_LINEAGE, but the rotation is $OLD_FP,$NEW_FP"
fi

OLD_SIGNER=(--ks "$OLD_KEYSTORE" --ks-key-alias "$OLD_KEY_ALIAS" --ks-pass env:OLD_KEYSTORE_PASSWORD --key-pass env:OLD_KEYSTORE_PASSWORD)
NEW_SIGNER=(--ks "$NEW_KEYSTORE" --ks-key-alias "$NEW_KEY_ALIAS" --ks-pass env:NEW_KEYSTORE_PASSWORD --key-pass env:NEW_KEY_PASSWORD)

# The lineage (from a lineage file or a signed APK) must be exactly old key → new key, and no key in it may
# have the rollback capability.
check_lineage() { # <lineage file or APK> <what, for messages>
  local out digests
  out=$("$APKSIGNER" lineage --in "$1" --print-certs -v 2>&1) || {
    echo "$out" >&2
    fail "apksigner could not read the lineage of the $2"
  }
  grep -E 'in lineage certificate (DN|SHA-256 digest)|capability' <<<"$out" || true
  digests=$(sed -nE 's/^Signer #[0-9]+ in lineage certificate SHA-256 digest: *([0-9a-f]{64}).*$/\1/p' <<<"$out" | paste -sd, -)
  [ "$digests" = "$(hex "$OLD_FP"),$(hex "$NEW_FP")" ] ||
    fail "the $2 has lineage '$digests', expected the debug key followed by the release key"
  if grep -Eiq 'rollback capability *: *true' <<<"$out"; then
    fail "the $2 gives an old key the rollback capability (a debug-key APK could replace the app again)"
  fi
}

# ---- 1. lineage: old key → new key. Default capabilities; never --set-rollback true.
LINEAGE_FILE=${LINEAGE_FILE:-$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/rotation.XXXXXX")}
rm -f "$LINEAGE_FILE"
"$APKSIGNER" rotate --out "$LINEAGE_FILE" --old-signer "${OLD_SIGNER[@]}" --new-signer "${NEW_SIGNER[@]}" ||
  fail "apksigner rotate failed (lineage debug key → release key)"
[ -s "$LINEAGE_FILE" ] || fail "apksigner rotate wrote no lineage"
echo "--- lineage file"
check_lineage "$LINEAGE_FILE" "lineage file"

# ---- 2. sign: v2 with the old key (the first signer), v3 with the new key and the lineage from Android 9.
# apksigner drops the APK's existing (Gradle, debug-key) signatures first. No v4: it is only for adb
# incremental installs and would leave an .idsig file next to the APK.
rm -f "$OUT" "$OUT.idsig"
signed_ok=0
trap '[ "$signed_ok" = 1 ] || rm -f "$OUT" "$OUT.idsig"' EXIT # never leave an unverified APK behind
"$APKSIGNER" sign --in "$IN" --out "$OUT" \
  --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false \
  --lineage "$LINEAGE_FILE" --rotation-min-sdk-version 28 \
  "${OLD_SIGNER[@]}" --next-signer "${NEW_SIGNER[@]}" ||
  fail "apksigner sign failed"
[ -s "$OUT" ] || fail "apksigner sign wrote no APK"

# ---- 3. verify
signers() { # the signer digests apksigner verify printed (not the lineage lines), sorted, comma-separated
  grep -v 'in lineage' <<<"$1" | sed -nE 's/^.*certificate SHA-256 digest: *([0-9a-f]{64}).*$/\1/p' | sort -u | paste -sd, -
}
echo "--- apksigner verify -v --print-certs"
all=$("$APKSIGNER" verify -v --print-certs "$OUT" 2>&1) || {
  echo "$all" >&2
  fail "apksigner verify failed on the signed APK"
}
grep -v '^WARNING' <<<"$all" || true
grep -qx 'Verifies' <<<"$all" || fail "apksigner verify did not say 'Verifies'"
grep -q '^Verified using v2 scheme (APK Signature Scheme v2): true' <<<"$all" || fail "the signed APK has no valid v2 signature"
grep -q '^Verified using v3 scheme (APK Signature Scheme v3): true' <<<"$all" ||
  fail "the signed APK has no valid v3 signature (no key rotation)"

old=$("$APKSIGNER" verify --print-certs --max-sdk-version 27 "$OUT" 2>&1) || {
  echo "$old" >&2
  fail "the signed APK does not verify on Android 7-8"
}
[ "$(signers "$old")" = "$(hex "$OLD_FP")" ] ||
  fail "on Android 7-8 the APK must be signed by the debug key alone, got: $(signers "$old")"
new=$("$APKSIGNER" verify --print-certs --min-sdk-version 28 "$OUT" 2>&1) || {
  echo "$new" >&2
  fail "the signed APK does not verify on Android 9+"
}
[ "$(signers "$new")" = "$(hex "$NEW_FP")" ] ||
  fail "on Android 9+ the APK must be signed by the release key, got: $(signers "$new")"
echo "--- lineage in the signed APK"
check_lineage "$OUT" "signed APK"

# ---- 4. only the signature changed: same entries, same CRCs, and native libraries still page-aligned
entries() {
  unzip -lv "$1" | awk 'NR > 3 && $1 ~ /^[0-9]+$/ && NF >= 8 { print $7, $8 }' |
    grep -Ev ' META-INF/([^/]+\.(SF|RSA|DSA|EC)|MANIFEST\.MF)$' | sort
}
[ "$(entries "$IN")" = "$(entries "$OUT")" ] || fail "re-signing changed the APK's contents"
if "$ZIPALIGN" -c -P 16 4 "$IN" >/dev/null 2>&1; then
  "$ZIPALIGN" -c -P 16 4 "$OUT" >/dev/null 2>&1 || fail "re-signing broke the 16 KB alignment of the native libraries"
  echo "Native libraries are still 16 KB page-aligned"
else
  "$ZIPALIGN" -c -p 4 "$OUT" >/dev/null 2>&1 || fail "the signed APK is not zip-aligned"
fi

signed_ok=1
echo "Signed with key rotation: v2 = debug key (Android 7-8), v3 = release key with lineage (Android 9+)"
