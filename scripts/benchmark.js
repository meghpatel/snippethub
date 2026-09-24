const { performance } = require('node:perf_hooks');
const { SearchEngine } = require('../core/search');
const catalog = require('../catalog/python.json');
const queries = ['import a JSON', 'json to pandas df', 'remove duplicates from a list', 'read jsno file', 'sort dictionaries', 'json to pand', 'unrelated kubernetes', 'JON', 'jon to pd df', 'pd', 'np'];
for (const size of [10, 1000, 10000]) {
  // Synthetic duplicates stress large posting lists; this is not a relevance dataset.
  const snippets = Array.from({ length: size }, (_, i) => ({ ...catalog[i % catalog.length], id: `snippet-${i}` }));
  const start = performance.now();
  const engine = new SearchEngine(snippets);
  const build = performance.now() - start;
  for (let i = 0; i < 100; i++) engine.search(queries[i % queries.length]);
  const times = [];
  for (let i = 0; i < 1000; i++) {
    const t = performance.now();
    engine.search(queries[i % queries.length]);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ snippets: size, buildMs: +build.toFixed(2), medianMs: +times[500].toFixed(3), p95Ms: +times[950].toFixed(3), maxMs: +times[999].toFixed(3) }));
}
