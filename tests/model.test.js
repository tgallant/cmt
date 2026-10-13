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

test('fuzzy search matches title and URL, requires all words', () => {
  assert.deepEqual(ids({ search: 'ffdoc' }), [1]);
  assert.deepEqual(ids({ search: 'mzla docs' }), [1, 2, 5]);
  assert.deepEqual(ids({ search: 'firefox nope' }), []);
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
