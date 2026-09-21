const { spawnSync } = require('node:child_process');
const { validateCatalog } = require('../core/search');
const catalog = validateCatalog(require('../catalog/python.json'));
const result = spawnSync('python3', ['-c',
  'import ast,json,sys\nfor s in json.load(sys.stdin):\n ast.parse(s["code"], filename=s["id"])\nprint("All Python snippets parse successfully.")'],
  { input: JSON.stringify(catalog), encoding: 'utf8' });
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Validated ${catalog.length} snippets; unique IDs, metadata, and Python syntax.`);
