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
  ['read JON file', 'read-json-file'],
  ['parse jon string', 'parse-json-string'],
  ['save dict to jon', 'write-json-file'],
  ['jon to pd df', 'json-to-dataframe'],
  ['import csv into PD', 'read-csv-dataframe'],
  ['flatten nested jon with pd', 'flatten-nested-json'],
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
test('pandas shorthand has the same results and scores as the full library name', () => {
  for (const [shortcut, full] of [['pd', 'pandas'], ['json to pd df', 'json to pandas dataframe']]) {
    assert.deepEqual(engine.search(shortcut), engine.search(full));
  }
  assert.deepEqual(new Set(engine.search('pd').map(r => r.snippet.id)),
    new Set(['json-to-dataframe', 'read-csv-dataframe', 'flatten-nested-json']));
});

function vocabularyRecipe(term) {
  return { id: term, title: term, description: term, language: 'python',
    category: 'Reference', tags: [term], aliases: [term], dependencies: [], code: 'pass\n' };
}

test('numpy shorthand resolves only to available NumPy metadata', () => {
  const expanded = new SearchEngine([...catalog, vocabularyRecipe('numpy')]);
  assert.deepEqual(expanded.search('NP'), expanded.search('numpy'));
  assert.equal(expanded.search('np')[0].snippet.id, 'numpy');
  assert.deepEqual(engine.search('np'), []);
});

test('JSON tolerates one missing, extra, replaced, or transposed letter', () => {
  const isolated = new SearchEngine([vocabularyRecipe('json')]);
  for (const query of ['JON', 'jsn', 'jxon', 'jsson', 'jsno']) {
    assert.equal(isolated.search(query)[0]?.snippet.id, 'json', query);
    assert.ok(isolated.search(query)[0].score < isolated.search('json')[0].score);
  }
  for (const query of ['jn', 'j', 'jxxn']) assert.deepEqual(isolated.search(query), [], query);
});

test('equally weighted exact and prefix matches outrank typo matches', () => {
  const competing = new SearchEngine(['json', 'jones', 'jon'].map(vocabularyRecipe));
  assert.deepEqual(competing.search('jon').map(r => r.snippet.id), ['jon', 'jones', 'json']);
});
test('accents and apostrophes do not shatter otherwise-known words', () => {
  assert.equal(engine.search('r\u00e9ad json file')[0]?.snippet.id, 'read-json-file');
  assert.equal(engine.search('s\u00f3rt dictionaries')[0]?.snippet.id, 'sort-dictionaries');
  assert.deepEqual(engine.search('read json file'), engine.search('r\u00e9\u00e0d js\u00f6n f\u00eele'));
  assert.deepEqual(engine.search("list files in the folder's path"), engine.search('list files in the folders path'));
});
test('blank query browses and limits results', () => {
  assert.equal(engine.search('').length, 10);
  assert.equal(engine.search('', 3).length, 3);
  assert.equal(engine.search('json', 0).length, 0);
  // Infinity is an ordinary "no limit"; a non-number is still rejected.
  assert.deepEqual(engine.search('json', Infinity), engine.search('json', 10));
  assert.equal(engine.search('', Infinity).length, 10);
  for (const limit of [NaN, -1, '5', null]) assert.deepEqual(engine.search('json', limit), []);
});
test('unrelated, filler-only, punctuation queries return no results', () => {
  for (const query of ['deploy kubernetes cluster', 'please show me python', '!!!',
    'json kubernetes deployment', 'jon kubernetes deployment', 'pd kubernetes deployment', 'jn', 'zz']) {
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
  assert.equal(alternate.search('jon to pd df')[0].snippet.id, 'json-to-dataframe');
  const expanded = new sandbox.SnippetHub.SearchEngine([...catalog, vocabularyRecipe('numpy')]);
  assert.equal(expanded.search('np')[0].snippet.id, 'numpy');
});
