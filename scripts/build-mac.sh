#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sdk_version="$(xcrun --show-sdk-version)"
if [[ "${sdk_version%%.*}" -lt 26 ]]; then
  echo "SnippetHub requires Xcode 26+ with the macOS 26+ SDK to build Spotlight actions." >&2
  exit 1
fi
xcode_build="$(xcodebuild -version | awk '/Build version/ { print $3 }')"
app="dist/SnippetHub.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" dist/swift-module-cache
cp apps/mac/Info.plist "$app/Contents/Info.plist"
cp core/search.js catalog/python.json "$app/Contents/Resources/"
arch="$(uname -m)"
sdk="$(xcrun --show-sdk-path)"
toolchain="$(dirname "$(dirname "$(dirname "$(xcrun --find swiftc)")")")"
metadata="dist/mac-metadata"
mkdir -p "$metadata"
# The compiler flag expects a JSON array, including on Xcode 27.
protocols="$metadata/protocols.json"
printf '%s\n' '["AppIntent", "AppEntity", "AppEnum", "EntityQuery", "AppShortcutsProvider"]' > "$protocols"
xcrun swiftc -parse-as-library -O -target "${arch}-apple-macosx14.0" \
  -module-name SnippetHub -whole-module-optimization \
  -module-cache-path dist/swift-module-cache \
  -emit-const-values-path "$metadata/SnippetHub.swiftconstvalues" \
  -Xfrontend -const-gather-protocols-file -Xfrontend "$protocols" \
  -framework SwiftUI -framework AppKit -framework JavaScriptCore -framework AppIntents \
  apps/mac/*.swift -o "$app/Contents/MacOS/SnippetHub"
# swiftc alone does not register App Intents. Ship extracted metadata before signing.
printf '%s\n' "$PWD"/apps/mac/*.swift > "$metadata/sources.txt"
printf '%s\n' "$PWD/$metadata/SnippetHub.swiftconstvalues" > "$metadata/const-values.txt"
# Xcode 26 needs the explicit extraction mode; Xcode 27 removed this flag.
metadata_options=(--module-name SnippetHub)
processor_help="$(xcrun appintentsmetadataprocessor --help 2>&1 || true)"
if [[ "$processor_help" == *"--compile-time-extraction"* ]]; then
  metadata_options+=(--compile-time-extraction)
fi
xcrun appintentsmetadataprocessor \
  --output "$app/Contents/Resources" \
  --toolchain-dir "$toolchain" --sdk-root "$sdk" \
  --xcode-version "$xcode_build" \
  --platform-family macOS --deployment-target 14.0 \
  --target-triple "${arch}-apple-macosx14.0" \
  --source-file-list "$metadata/sources.txt" \
  --swift-const-vals-list "$metadata/const-values.txt" \
  "${metadata_options[@]}"
test -f "$app/Contents/Resources/Metadata.appintents/extract.actionsdata"
signing_identity="${SNIPPETHUB_SIGN_IDENTITY:--}"
codesign --force --sign "$signing_identity" "$app"
codesign --verify --strict "$app"
if [[ "$signing_identity" == "-" ]]; then
  echo "Ad-hoc build: the window works, but system App Intent execution may require Apple Development signing."
  echo "Set SNIPPETHUB_SIGN_IDENTITY to an installed signing identity for Spotlight testing."
fi
echo "Built native app for ${arch}: $app"
