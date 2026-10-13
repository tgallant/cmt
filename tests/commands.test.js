import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service.js';

test('known restricted pages open the popup before the user gesture expires', async () => {
  for (const url of ['about:config', 'moz-extension://other/page', 'https://addons.mozilla.org/en-US/firefox/']) {
    const calls = [];
    const service = createService({
      tabs: { executeScript: async () => { calls.push('inject'); throw new Error('blocked'); } },
      browserAction: { openPopup: async () => calls.push('popup') },
    });
    const pending = service.openPalette(1, url);
    assert.deepEqual(calls, ['popup']);
    await pending;
  }
});
