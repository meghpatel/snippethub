/* Shared by Node, VS Code and JavaScriptCore. No network or runtime dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnippetHub = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STOP = new Set(('a an the how do does i me my can could would please want need ' +
    'in on at of to from into for with using use python snippet code example show get is it and').split(' '));
  const GROUPS = [
    ['read', 'load', 'import', 'open', 'reading', 'loading'],
    ['write', 'save', 'export', 'writing', 'saving'],
    ['convert', 'transform', 'turn', 'converting'],
    ['dataframe', 'df', 'dataframes'], ['dictionary', 'dict', 'dictionaries'],
    ['list', 'array', 'lists', 'arrays'], ['remove', 'delete', 'drop', 'removing'],
    ['duplicate', 'duplicates', 'deduplicate', 'dedup'],
    ['directory', 'folder', 'directories', 'folders'],
    ['file', 'files'], ['sort', 'order', 'sorting', 'sorted'],
    ['date', 'datetime', 'timestamp', 'dates'], ['parse', 'parsing'],
    ['request', 'fetch', 'download', 'requests'], ['nested', 'flatten', 'normalize'],
  ];
  const synonyms = new Map();
  GROUPS.forEach(group => group.forEach(word => synonyms.set(word, group[0])));
  const canonical = word => synonyms.get(word) || word;
  function words(text) {
    return String(text).toLowerCase().replace(/data\s+frames?/g, 'dataframe')
      .match(/[a-z0-9]+/g) || [];
  }
  function tokens(text) { return words(text).filter(word => !STOP.has(word)).map(canonical); }
  function deletions(word) {
    const keys = new Set([word]);
    for (let i = 0; i < word.length; i++) keys.add(word.slice(0, i) + word.slice(i + 1));
    return keys;
  }
  function oneEdit(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      const diff = [];
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
      return diff.length === 1 || (diff.length === 2 && diff[1] === diff[0] + 1 &&
        a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]);
    }
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let i = 0;
    while (i < shorter.length && shorter[i] === longer[i]) i++;
    return shorter.slice(i) === longer.slice(i + 1);
  }
  function add(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  function validateCatalog(catalog) {
    if (!Array.isArray(catalog) || !catalog.length) throw new Error('Catalog must be a nonempty array');
    const ids = new Set();
    for (const s of catalog) {
      if (!s || typeof s !== 'object') throw new Error('Invalid snippet');
      for (const key of ['id', 'title', 'description', 'code', 'category']) {
        if (typeof s[key] !== 'string' || !s[key].trim()) throw new Error(`Missing ${key}: ${s.id || '?'}`);
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || ids.has(s.id)) throw new Error(`Invalid or duplicate ID: ${s.id}`);
      ids.add(s.id);
      if (s.language !== 'python') throw new Error(`Unsupported language: ${s.id}`);
      for (const key of ['tags', 'aliases', 'dependencies']) {
        if (!Array.isArray(s[key]) || s[key].some(v => typeof v !== 'string' || !v.trim())) throw new Error(`Invalid ${key}: ${s.id}`);
      }
      if (!s.aliases.length || !s.tags.length) throw new Error(`Missing search metadata: ${s.id}`);
    }
    return catalog;
  }

  class SearchEngine {
    constructor(catalog) {
      this.snippets = validateCatalog(catalog).slice();
      this.postings = new Map();
      this.prefixes = new Map();
      this.typos = new Map();
      this.phrases = [];
      this.snippets.forEach((snippet, index) => {
        const weights = new Map();
        const fields = [[snippet.title, 6], [snippet.tags.join(' '), 5],
          [snippet.aliases.join(' '), 4], [snippet.description, 2], [snippet.category, 2]];
        for (const [text, weight] of fields) {
          for (const term of new Set(tokens(text))) weights.set(term, (weights.get(term) || 0) + weight);
        }
        for (const [term, weight] of weights) {
          if (!this.postings.has(term)) this.postings.set(term, new Map());
          this.postings.get(term).set(index, weight);
        }
        this.phrases[index] = [snippet.title, ...snippet.aliases].map(p => tokens(p).join(' '));
      });
      // Include synonym spellings so incomplete words and typos resolve before canonicalization.
      const vocabulary = new Set([...this.postings.keys(), ...synonyms.keys()]);
      for (const term of vocabulary) {
        if (!this.postings.has(canonical(term))) continue;
        for (let n = 2; n < term.length; n++) add(this.prefixes, term.slice(0, n), canonical(term));
        if (term.length >= 4) for (const key of deletions(term)) add(this.typos, key, term);
      }
    }

    search(query = '', limit = 20) {
      if (!Number.isFinite(limit) || limit < 1) return [];
      limit = Math.floor(limit);
      const terms = [...new Set(tokens(String(query).slice(0, 256)))].slice(0, 24);
      if (!terms.length) {
        // Blank queries browse; punctuation or filler-only queries do not imply a match.
        return String(query).trim() ? [] : this.snippets.slice(0, limit).map(snippet => ({ snippet, score: 0, matchedTerms: [] }));
      }
      const candidates = new Map();
      for (const term of terms) {
        const alternatives = new Map();
        if (this.postings.has(term)) alternatives.set(term, 1);
        for (const t of this.prefixes.get(term) || []) if (!alternatives.has(t)) alternatives.set(t, 0.7);
        if (term.length >= 4) {
          for (const key of deletions(term)) {
            for (const spelling of this.typos.get(key) || []) {
              const t = canonical(spelling);
              if (!alternatives.has(t) && oneEdit(term, spelling)) alternatives.set(t, 0.55);
            }
          }
        }
        const best = new Map();
        for (const [t, quality] of alternatives) {
          const posting = this.postings.get(t);
          const idf = Math.log(1 + this.snippets.length / posting.size);
          for (const [index, weight] of posting) {
            const score = quality * idf * (weight / (weight + 6));
            best.set(index, Math.max(best.get(index) || 0, score));
          }
        }
        for (const [index, score] of best) {
          if (!candidates.has(index)) candidates.set(index, { score: 0, matchedTerms: [] });
          const candidate = candidates.get(index);
          candidate.score += score;
          candidate.matchedTerms.push(term);
        }
      }
      const phrase = terms.join(' ');
      return [...candidates].filter(([, c]) => c.matchedTerms.length / terms.length >= 0.6)
        .map(([index, c]) => ({ snippet: this.snippets[index], matchedTerms: c.matchedTerms,
          score: c.score * Math.pow(c.matchedTerms.length / terms.length, 2) +
            (this.phrases[index].includes(phrase) ? 3 : 0) }))
        .sort((a, b) => b.score - a.score || a.snippet.id.localeCompare(b.snippet.id))
        .slice(0, limit);
    }
  }
  return { SearchEngine, validateCatalog };
});
