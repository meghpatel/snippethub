const { SearchEngine } = require('../core/search');
const engine = new SearchEngine(require('../catalog/python.json'));
const results = engine.search(process.argv.slice(2).join(' '), 5);
if (!results.length) console.log('No matches. Try "read JSON" or "sort dictionaries".');
for (const { snippet, score } of results) {
  console.log(`${snippet.title} (${score.toFixed(2)})\n${snippet.description}\n\n${snippet.code}`);
}
