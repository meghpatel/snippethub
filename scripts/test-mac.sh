#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_app="dist/mac-tests/SnippetHubTests.app"
mkdir -p "$test_app/Contents/MacOS" "$test_app/Contents/Resources" dist/swift-module-cache
cp core/search.js catalog/python.json "$test_app/Contents/Resources/"
node <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { SearchEngine } = require('./core/search.js');
const catalog = require('./catalog/python.json');
const engine = new SearchEngine(catalog);
const queries = [...catalog.flatMap(s => [s.title, ...s.aliases]), '', 'json', 'pd',
  'json to pandas', 'read JON file', 'kubernetes ingress', 'the please',
  '\"); throw new Error("injected"); //', 'x'.repeat(10000)];
fs.writeFileSync('dist/mac-tests/cases.json', JSON.stringify(queries.map(query => {
  const results = engine.search(query, 50);
  return { query, ids: results.map(r => r.snippet.id), codes: results.map(r => r.snippet.code) };
})));
const metadata = JSON.parse(fs.readFileSync('dist/SnippetHub.app/Contents/Resources/Metadata.appintents/extract.actionsdata'));
const search = metadata.actions.SearchSnippetsIntent;
assert.equal(search.isDiscoverable, true);
assert.equal(search.openAppWhenRun, false);
assert.equal(search.parameters.length, 1);
assert.equal(search.parameters[0].name, 'query');
assert.ok(JSON.stringify(search.actionConfiguration).includes('${query}'));
assert.ok(JSON.stringify(metadata.autoShortcuts).includes('SearchSnippetsIntent'));
for (const name of ['SnippetPreviewIntent', 'BrowseSnippetsIntent', 'CopySnippetIntent']) {
  assert.equal(metadata.actions[name].isDiscoverable, false);
}
console.log('Spotlight metadata contains the search shortcut, required parameter, and private preview actions.');
JS
xcrun swiftc -parse-as-library -target "$(uname -m)-apple-macosx14.0" \
  -module-cache-path dist/swift-module-cache \
  -framework SwiftUI -framework AppKit -framework JavaScriptCore -framework AppIntents \
  apps/mac/SnippetStore.swift apps/mac/SpotlightIntents.swift tests/mac-smoke.swift \
  -o "$test_app/Contents/MacOS/SnippetHubTests"
"$test_app/Contents/MacOS/SnippetHubTests" "$PWD/dist/mac-tests/cases.json"
codesign --verify --strict dist/SnippetHub.app
