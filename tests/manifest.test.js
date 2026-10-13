import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('src/manifest.json', 'utf8'));
test('manifest uses minimal permissions and no startup host access', () => {
  assert.deepEqual(manifest.permissions, ['tabs', 'activeTab']);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.sidebar_action, undefined);
  assert.deepEqual(manifest.web_accessible_resources, ['overlay.html']);
  assert.match(manifest.content_security_policy, /connect-src 'none'/);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
});
test('both commands are registered with macOS Control alternatives', () => {
  assert.equal(manifest.commands['open-palette'].suggested_key.mac, 'MacCtrl+Shift+K');
  assert.equal(manifest.commands['previous-tab'].suggested_key.mac, 'MacCtrl+Shift+J');
});
