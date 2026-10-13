import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccess } from '../src/access.js';

const base = 'moz-extension://test/';
test('only the manager, popup, and an authorized overlay can read or act on tabs', () => {
  const access = createAccess(base);
  assert.equal(access.allowed({ url: base + 'manager.html' }), true);
  assert.equal(access.allowed({ url: base + 'popup.html' }), true);
  assert.equal(access.allowed({ url: base + 'overlay.html', tab: { id: 1 } }), false);
  assert.equal(access.allowed({ url: 'https://test/manager.html' }), false);
  const token = access.issue(1);
  const sender = { url: base + 'overlay.html?token=' + token, tab: { id: 1 } };
  assert.equal(access.allowed(sender), true);
  assert.equal(access.allowed({ ...sender, tab: { id: 2 } }), false);
  access.revoke(1);
  assert.equal(access.allowed(sender), false);
});
test('a new command replaces the prior overlay token', () => {
  const access = createAccess(base);
  const token = access.issue(1);
  assert.equal(access.context(1).token, token);
  access.issue(1);
  assert.equal(access.allowed({ url: base + 'overlay.html?token=' + token, tab: { id: 1 } }), false);
  assert.equal(access.context(99), null);
});
