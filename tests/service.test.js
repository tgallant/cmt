import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service.js';

function setup() {
  const data = new Map([
    [1, { id: 1, windowId: 4, active: true, pinned: false, url: 'https://a.test', title: 'A' }],
    [2, { id: 2, windowId: 4, pinned: true, url: 'https://b.test', title: 'B' }],
    [3, { id: 3, windowId: 4, incognito: true, url: 'https://private.test', title: 'Private' }],
  ]);
  const calls = [];
  const api = {
    tabs: {
      query: async () => [...data.values()],
      get: async (id) => { if (!data.has(id)) throw new Error('Tab is gone'); return data.get(id); },
      update: async (id, changes) => { calls.push(['update', id, changes]); Object.assign(data.get(id), changes); },
      remove: async (id) => { calls.push(['remove', id]); data.delete(id); },
      discard: async (id) => { calls.push(['discard', id]); },
      executeScript: async () => { throw new Error('Restricted page'); },
      create: async (options) => { calls.push(['create', options]); },
    },
    windows: { update: async (...args) => calls.push(['window', ...args]) },
    browserAction: { openPopup: async () => calls.push(['popup']) },
    runtime: { getURL: (path) => `moz-extension://test/${path}` },
  };
  return { service: createService(api), data, calls };
}

test('snapshot returns live tabs without storing private data', async () => {
  const { service, data } = setup();
  assert.equal((await service.snapshot(4)).tabs.length, 3);
  data.delete(3);
  assert.equal((await service.snapshot(4)).tabs.length, 2);
});
test('activation focuses the tab window', async () => {
  const { service, calls } = setup();
  await service.act({ action: 'activate', ids: [2] });
  assert.deepEqual(calls, [['update', 2, { active: true }], ['window', 4, { focused: true }]]);
});
test('close requires confirmation and protects pinned tabs', async () => {
  const { service, data } = setup();
  await assert.rejects(service.act({ action: 'close', ids: [1] }), /confirm/i);
  const result = await service.act({ action: 'close', ids: [1, 2], confirmed: true });
  assert.deepEqual(result.done, [1]);
  assert.equal(result.skipped[0].id, 2);
  assert.ok(data.has(2));
  await service.act({ action: 'close', ids: [2], confirmed: true, includePinned: true });
  assert.ok(!data.has(2));
});
test('all non-close actions use standard tab APIs', async () => {
  const { service, calls } = setup();
  for (const action of ['pin', 'unpin', 'mute', 'unmute', 'discard']) await service.act({ action, ids: [2] });
  assert.deepEqual(calls, [['update', 2, { pinned: true }], ['update', 2, { pinned: false }], ['update', 2, { muted: true }], ['update', 2, { muted: false }], ['discard', 2]]);
});
test('active or audible tabs cannot be discarded; stale IDs do not abort a batch', async () => {
  const { service, data } = setup();
  data.get(2).audible = true;
  const result = await service.act({ action: 'discard', ids: [999, 1, 2, 3, 3] });
  assert.deepEqual(result.done, [3]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.skipped.length, 2);
});
test('unknown actions are rejected', async () => {
  await assert.rejects(setup().service.act({ action: 'erase', ids: [1] }), /action/i);
});
test('previous tab uses window-local activation history', async () => {
  const { service, calls, data } = setup();
  data.get(1).active = false;
  data.get(2).active = true;
  service.recordActivation({ tabId: 1, windowId: 4 });
  service.recordActivation({ tabId: 2, windowId: 4 });
  service.recordActivation({ tabId: 3, windowId: 7 });
  await service.previous(4);
  assert.equal(calls[0][1], 1);
});
test('overlay injection falls back to the popup on restricted pages', async () => {
  const { service, calls } = setup();
  await service.openPalette(1);
  assert.deepEqual(calls, [['popup']]);
});
