#!/bin/sh
# Sign CI output with this machine's persistent preview identity; never rotate on rebuild.
set -eu
umask 077
cd "$(dirname "$0")/.."
: "${LIUBAI_JAVA_HOME:?Set LIUBAI_JAVA_HOME to a JDK directory}"
: "${LIUBAI_APKSIGNER_JAR:?Set LIUBAI_APKSIGNER_JAR to Android build-tools lib/apksigner.jar}"
input=${1:?Input APK path required}
output=${2:?Output APK path required}
keydir=".local/android-signing"
mkdir -p "$keydir"
chmod 700 "$keydir"
if [ ! -e "$keydir/preview.keystore" ]; then
  if [ -e "$keydir/password" ]; then
    echo 'Signing password exists without its key; restore the key instead of rotating it' >&2
    exit 1
  fi
  openssl rand -base64 36 > "$keydir/password"
  "$LIUBAI_JAVA_HOME/bin/keytool" -genkeypair -keystore "$keydir/preview.keystore" -storepass:file "$keydir/password" -keypass:file "$keydir/password" -alias liubai-preview -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Liubai Preview, O=Liubai, C=CN'
fi
"$LIUBAI_JAVA_HOME/bin/java" -jar "$LIUBAI_APKSIGNER_JAR" sign --ks "$keydir/preview.keystore" --ks-key-alias liubai-preview --ks-pass "file:$keydir/password" --v4-signing-enabled false --out "$output" "$input"
"$LIUBAI_JAVA_HOME/bin/java" -jar "$LIUBAI_APKSIGNER_JAR" verify --verbose --print-certs "$output"
