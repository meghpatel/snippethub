'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'dist/vscode');
// Start clean: a stale file left from an earlier build would otherwise ship in the VSIX.
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const directory of ['core', 'catalog']) {
  fs.cpSync(path.join(root, directory), path.join(dest, directory), { recursive: true });
}
for (const file of ['extension.js', 'package.json']) {
  fs.copyFileSync(path.join(root, 'apps/vscode', file), path.join(dest, file));
}
for (const file of ['README.md', 'CONTRIBUTING.md', 'LICENSE']) fs.copyFileSync(path.join(root, file), path.join(dest, file));
console.log(`Built VS Code extension: ${dest}`);
