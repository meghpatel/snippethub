#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
app="dist/SnippetHub.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" dist/swift-module-cache
cp apps/mac/Info.plist "$app/Contents/Info.plist"
cp core/search.js catalog/python.json "$app/Contents/Resources/"
arch="$(uname -m)"
xcrun swiftc -parse-as-library -O -target "${arch}-apple-macosx14.0" \
  -module-cache-path dist/swift-module-cache \
  -framework SwiftUI -framework AppKit -framework JavaScriptCore \
  apps/mac/SnippetHub.swift -o "$app/Contents/MacOS/SnippetHub"
codesign --force --sign - "$app"
echo "Built native app for ${arch}: $app"
