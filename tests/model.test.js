import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { queryTabs, duplicateExtras, selectRange } from '../src/model.js';

const now = 2_000_000_000_000;
const tabs = [
  { id: 1, title: 'Firefox documentation', url: 'https://mozilla.org/docs', windowId: 1, index: 0, lastAccessed: now, active: true },
  { id: 2, title: 'Old copy', url: 'https://mozilla.org/docs', windowId: 1, index: 1, lastAccessed: now - 40 * 86400000, discarded: true },
  { id: 3, title: 'Pinned reference', url: 'https://example.org/a?q=1', windowId: 2, index: 0, pinned: true, lastAccessed: now - 5 },
  { id: 4, title: 'Audio', url: 'https://example.org/a?q=2', windowId: 1, index: 2, audible: true },
  { id: 5, title: 'Fragment', url: 'https://mozilla.org/docs#x', windowId: 1, index: 3 },
];
const ids = (options) => queryTabs(tabs, { now, ...options }).map((tab) => tab.id);
const searchIds = (rows, search, options = {}) => queryTabs(rows.map((row, index) => ({
  id: index + 1, windowId: 1, index, url: 'https://blank.test/', ...row,
})), { search, ...options }).map((tab) => tab.id);

test('fuzzy search matches title and URL, requires all words', () => {
  assert.deepEqual(ids({ search: 'ffdoc' }), [1]);
  assert.deepEqual(ids({ search: 'mzla docs' }), [1, 2, 5]);
  assert.deepEqual(ids({ search: 'firefox nope' }), []);
});
test('widely separated letters are not relevant matches in either field', () => {
  const loose = [...'youtube'].join('x'.repeat(30));
  assert.deepEqual(searchIds([
    { title: 'YouTube guide' },
    { title: loose },
    { title: 'Unrelated checkout', url: `https://blank.test/?token=${loose}` },
  ], 'youtube'), [1]);
});
test('compact fuzzy matches work in every part of a complete URL', () => {
  assert.deepEqual(searchIds([
    { url: 'https://youtube.test/' },
    { url: 'https://blank.test/youtube' },
    { url: 'https://blank.test/?topic=youtube' },
    { url: 'https://blank.test/#youtube' },
    { url: 'not-a-url/youtube' },
  ], 'ytb').sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});
test('literal matches outrank fuzzy matches despite an earlier weak alignment', () => {
  assert.deepEqual(searchIds([
    { title: 'you t u b e' },
    { title: 'y o u t u b e — YouTube' },
  ], 'youtube'), [2, 1]);
});
test('a later best fuzzy alignment is not penalized by an earlier poor one', () => {
  assert.deepEqual(searchIds([
    { title: `m${'.'.repeat(80)} Mozilla` },
    { title: 'Mozilla' },
  ], 'mzla'), [1, 2]);
});
test('literal matches for all query words take priority over mixed matches', () => {
  assert.deepEqual(searchIds([
    { title: 'Alpha Beta you t u b e' },
    { title: 'prealpha prebeta y o u t u b e — preyoutube' },
  ], 'alpha beta youtube'), [2, 1]);
});
test('explicit sort order still applies to search results', () => {
  const rows = [{ title: 'A you t u b e' }, { title: 'Z YouTube' }];
  assert.deepEqual(searchIds(rows, 'youtube'), [2, 1]);
  assert.deepEqual(searchIds(rows, 'youtube', { sort: 'title' }), [1, 2]);
});
test('empty searches keep tabs with missing fields while unmatched searches do not', () => {
  const rows = [{ title: undefined, url: undefined }, { title: 'YouTube guide', url: undefined }];
  assert.deepEqual(searchIds(rows, ''), [1, 2]);
  assert.deepEqual(searchIds(rows, 'youtube'), [2]);
  assert.deepEqual(searchIds(rows, 'youtube nonexistent'), []);
});
test('995-tab relevance filtering stays below 200 ms with noisy URLs', () => {
  const loose = [...'youtube'].join('x'.repeat(36));
  const fixture = Array.from({ length: 995 }, (_, id) => ({
    id, windowId: 1, index: id, title: 'Unrelated note', url: `https://blank.test/?token=${loose}&id=${id}`,
  }));
  fixture[994].title = 'YouTube guide';
  queryTabs(fixture, { search: 'youtube' });
  const start = performance.now();
  const result = queryTabs(fixture, { search: 'youtube' });
  const elapsed = performance.now() - start;
  assert.deepEqual(result.map((tab) => tab.id), [994]);
  console.log(`995-tab noisy-URL query: ${elapsed.toFixed(2)} ms`);
  assert.ok(elapsed < 200);
});
test('best-alignment results agree with exhaustive scoring on generated short text', () => {
  const bonus = (text, at) => at === 0 || !/[a-z0-9]/i.test(text[at - 1]) ? 8 : /[a-z]/.test(text[at - 1]) && /[A-Z]/.test(text[at]) ? 7 : 0;
  function reference(text, word) {
    const lower = text.toLowerCase();
    let literal = -Infinity;
    for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + 1)) literal = Math.max(literal, 2 + bonus(text, at) / 8);
    if (Number.isFinite(literal)) return literal;
    let best = -Infinity;
    function visit(i, previous, score) {
      if (i === word.length) { best = Math.max(best, score); return; }
      for (let at = lower.indexOf(word[i], previous + 1); at >= 0; at = lower.indexOf(word[i], at + 1)) {
        const skipped = at - previous - 1;
        const extra = i === 0 ? 16 + 2 * bonus(text, at) : skipped === 0 ? 16 + Math.max(4, bonus(text, at)) : 16 + bonus(text, at) - 6 - 2 * (skipped - 1);
        visit(i + 1, at, score + extra);
      }
    }
    visit(0, -1, 0);
    const quality = best / (20 * word.length + 12);
    return quality >= 0.65 ? Math.min(quality, 1) : -Infinity;
  }
  let seed = 20261013;
  const alphabet = 'xyzXYZ ._-';
  const fixture = Array.from({ length: 500 }, (_, id) => {
    let title = '';
    for (let i = 0; i < 18; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      title += alphabet[seed % alphabet.length];
    }
    return { id, windowId: 1, index: id, title };
  });
  for (const search of ['x', 'xy', 'xyz', 'yxxy', 'zzy']) {
    const expected = fixture.map((tab) => ({ tab, score: reference(tab.title, search) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => Number(b.score >= 2) - Number(a.score >= 2) || b.score - a.score || a.tab.id - b.tab.id)
      .map((row) => row.tab.id);
    assert.deepEqual(queryTabs(fixture, { search }).map((tab) => tab.id), expected, `Query: ${search}`);
  }
});
test('filters combine and age excludes unknown times', () => {
  assert.deepEqual(ids({ filters: { duplicate: true, discarded: true, windowId: 1, host: 'mozilla.org', olderDays: 30 } }), [2]);
  assert.deepEqual(ids({ filters: { audible: true } }), [4]);
  assert.deepEqual(ids({ filters: { pinned: true } }), [3]);
  assert.deepEqual(ids({ filters: { olderDays: 1 } }), [2]);
  assert.deepEqual(ids({ filters: { host: 'example.org' } }), [3, 4]);
});
test('modes and stable sorts', () => {
  assert.deepEqual(ids({ mode: 'pinned' }), [3]);
  assert.deepEqual(ids({ mode: 'recent' }), [1, 3, 2, 4, 5]);
  assert.deepEqual(ids({ sort: 'title' }), [4, 1, 5, 2, 3]);
  assert.deepEqual(ids({ sort: 'host' }), [3, 4, 1, 2, 5]);
  assert.deepEqual(ids({ sort: 'oldest' }), [2, 3, 1, 4, 5]);
  assert.deepEqual(ids({ sort: 'order' }), [1, 2, 4, 5, 3]);
});
test('exact duplicate cleanup prefers pinned, then active, then recent', () => {
  assert.deepEqual(duplicateExtras(tabs), [2]);
  assert.deepEqual(duplicateExtras([...tabs, { ...tabs[1], id: 6, pinned: true }]), [1, 2]);
});
test('range selection works in either direction and retains prior selection', () => {
  assert.deepEqual([...selectRange(new Set([9]), [1, 2, 3, 4], 4, 2)], [9, 2, 3, 4]);
});
test('995-tab fuzzy search stays below 200 ms', () => {
  const fixture = Array.from({ length: 995 }, (_, id) => ({ ...tabs[0], id, title: `Reference ${id}` }));
  queryTabs(fixture, { search: 'ref' });
  const start = performance.now();
  const result = queryTabs(fixture, { search: 'ref 9', sort: 'title' });
  assert.ok(result.length > 0);
  const elapsed = performance.now() - start;
  console.log(`995-tab model query: ${elapsed.toFixed(2)} ms`);
  assert.ok(elapsed < 200);
  assert.equal(queryTabs(fixture).length, 995);
});
