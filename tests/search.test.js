const test = require('node:test');
const assert = require('node:assert/strict');
const { SearchEngine, validateCatalog } = require('../core/search');
const catalog = require('../catalog/python.json');
const engine = new SearchEngine(catalog);

const queries = [
  ['import a JSON', 'read-json-file'],
  ['how do I load a json file in python', 'read-json-file'],
  ['converting JSON to pandas DF', 'json-to-dataframe'],
  ['turn json into a data frame', 'json-to-dataframe'],
  ['save dict to json', 'write-json-file'],
  ['parse json string', 'parse-json-string'],
  ['import csv into pandas', 'read-csv-dataframe'],
  ['flatten nested json', 'flatten-nested-json'],
  ['remove duplicates from a list', 'deduplicate-list'],
  ['unique values in array', 'deduplicate-list'],
  ['sort dictionaries by field', 'sort-dictionaries'],
  ['list files in folder', 'list-directory-files'],
  ['convert string to datetime', 'parse-date-string'],
  ['read jsno file', 'read-json-file'],
  ['json to pand', 'json-to-dataframe'],
  ['json to datafrme', 'json-to-dataframe'],
  ['READ JSON FILE', 'read-json-file'],
];
for (const [query, expected] of queries) {
  test(`ranks "${query}" correctly`, () => assert.equal(engine.search(query)[0]?.snippet.id, expected));
}
test('catalog has ten unique, valid Python snippets', () => {
  assert.equal(validateCatalog(catalog).length, 10);
  for (const s of catalog) assert.equal(engine.search(s.title)[0]?.snippet.id, s.id);
});
test('blank query browses and limits results', () => {
  assert.equal(engine.search('').length, 10);
  assert.equal(engine.search('', 3).length, 3);
  assert.equal(engine.search('json', 0).length, 0);
});
test('unrelated, filler-only, punctuation queries return no results', () => {
  for (const query of ['deploy kubernetes cluster', 'please show me python', '!!!', 'json kubernetes deployment']) {
    assert.deepEqual(engine.search(query), []);
  }
});
test('bounded hostile input does not evaluate code or throw', () => {
  for (const query of ['x'.repeat(100000), "'); throw Error('oops'); //", '__proto__', 'constructor']) {
    assert.doesNotThrow(() => engine.search(query));
  }
});
test('search is deterministic and does not mutate source data', () => {
  const before = JSON.stringify(catalog);
  assert.deepEqual(engine.search('json'), engine.search('json'));
  assert.equal(JSON.stringify(catalog), before);
});
test('invalid catalog is rejected early', () => {
  assert.throws(() => new SearchEngine([]), /nonempty/);
  assert.throws(() => new SearchEngine([...catalog, catalog[0]]), /duplicate/);
  assert.throws(() => new SearchEngine([{ ...catalog[0], code: '' }]), /Missing code/);
});
test('same module runs without Node globals, as in JavaScriptCore', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const sandbox = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../core/search'), 'utf8'), sandbox);
  const alternate = new sandbox.SnippetHub.SearchEngine(catalog);
  assert.equal(alternate.search('json to df')[0].snippet.id, 'json-to-dataframe');
});
