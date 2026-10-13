import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { ZipReader, Uint8ArrayReader } from '@zip.js/zip.js';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { Builder, By, Key, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { download } from 'geckodriver';

const uuid = 'c0475f72-7730-46c7-9857-5c49d8a74282';
const origin = `moz-extension://${uuid}`;

test('Firefox acceptance: real tabs, keyboard palette, fallback, and 995 tabs', { timeout: 240000 }, async (t) => {
  await access(resolve('artifacts/cmt.zip'));
  const archive = new ZipReader(new Uint8ArrayReader(await readFile('artifacts/cmt.zip')));
  assert.deepEqual((await archive.getEntries()).map((entry) => entry.filename).sort(), ['background.js', 'content.js', 'manager.html', 'manifest.json', 'overlay.html', 'popup.html', 'ui.css', 'ui.js']);
  await archive.close();
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><title>Fixture ${req.url}</title><input id="focus" aria-label="Test focus"><p>Local test page</p>`);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = new firefox.Options().addArguments('-headless')
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ 'cmt@local.example': uuid }))
    .setPreference('xpinstall.signatures.required', false)
    .setPreference('browser.tabs.warnOnClose', false);
  const binary = process.env.FIREFOX_BINARY || (process.platform === 'darwin' ? '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox' : '/usr/bin/firefox');
  options.setBinary(binary);
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
    .setFirefoxService(new firefox.ServiceBuilder(await download(process.env.GECKODRIVER_VERSION || '0.37.1')).addArguments('--allow-system-access')).build();
  t.after(() => driver.quit());
  await driver.manage().setTimeouts({ script: 120000 });
  // Install the unpacked build. Packed temporary installs produced invalid
  // file-descriptor errors for content scripts in this macOS test environment.
  await driver.setContext('chrome');
  await driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    file.initWithPath(arguments[0]);
    AddonManager.installTemporaryAddon(file).then(() => done(null), error => done(error.message));
  `, resolve('dist'));
  await driver.setContext('content');
  await driver.get(`${origin}/manager.html`);
  await driver.wait(until.elementLocated(By.id('search')), 10000);
  const invoke = (code, ...args) => driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    const args = Array.from(arguments).slice(0, -1);
    (async () => { ${code} })().then(value => done({value}), error => done({error: error.message}));
  `, ...args).then((result) => { if (result.error) throw new Error(result.error); return result.value; });
  const send = (message) => invoke('return browser.runtime.sendMessage(args[0]);', message);
  const click = async (id) => driver.findElement(By.id(id)).click();
  const shortcut = async (letter = 'k') => {
    await driver.setContext('chrome');
    try {
      await driver.executeScript(`
        const keys = document.querySelector('keyset[id^="ext-keyset-id-cmt"]');
        const key = [...keys.children].find(el => el.getAttribute('key')?.toLowerCase() === arguments[1]);
        if (!key || !key.getAttribute('modifiers').includes(arguments[0])) throw new Error('Palette shortcut is not registered');
      `, process.platform === 'darwin' ? 'control' : 'alt', letter);
      const modifier = process.platform === 'darwin' ? Key.CONTROL : Key.ALT;
      await driver.actions().keyDown(modifier).keyDown(Key.SHIFT).sendKeys(letter.toUpperCase()).keyUp(Key.SHIFT).keyUp(modifier).perform();
    } finally { await driver.setContext('content'); }
  };
  const snapshot = () => send({ type: 'snapshot' });
  const action = (action, ids, extra = {}) => send({ type: 'act', request: { action, ids, ...extra } });
  const state = await invoke(`
    const a = await browser.tabs.create({url: args[0] + '/duplicate', active: false});
    const b = await browser.tabs.create({url: args[0] + '/duplicate', active: false});
    const c = await browser.tabs.create({url: args[0] + '/other', active: false});
    return {a: a.id, b: b.id, c: c.id};
  `, base);

  await t.test('real pin, mute, discard, close, and pinned protection', async () => {
    assert.deepEqual((await action('pin', [state.a])).done, [state.a]);
    assert.equal((await invoke('return browser.tabs.get(args[0]);', state.a)).pinned, true);
    await action('unpin', [state.a]);
    await action('mute', [state.a]);
    assert.equal((await invoke('return browser.tabs.get(args[0]);', state.a)).mutedInfo.muted, true);
    await action('unmute', [state.a]);
    await action('discard', [state.c]);
    assert.equal((await invoke('return browser.tabs.get(args[0]);', state.c)).discarded, true);
    await assert.rejects(action('close', [state.b]), /confirm/i);
    await action('pin', [state.a]);
    assert.equal((await action('close', [state.a], { confirmed: true })).skipped.length, 1);
    await action('close', [state.c], { confirmed: true });
    assert.ok(!(await snapshot()).tabs.some((tab) => tab.id === state.c));
  });

  await t.test('duplicate extras and UI close confirmation', async () => {
    await driver.get(`${origin}/manager.html`);
    await driver.wait(until.elementLocated(By.css(`[data-select="${state.b}"]`)), 10000);
    await click('select-extras');
    const selected = await driver.executeScript('return [...document.querySelectorAll("[data-select]:checked")].map(el => Number(el.dataset.select));');
    assert.deepEqual(selected, [state.b]);
    await driver.findElement(By.css('[data-action="close"]')).click();
    assert.equal((await snapshot()).tabs.some((tab) => tab.id === state.b), true);
    await click('confirm-close');
    await driver.wait(async () => !(await snapshot()).tabs.some((tab) => tab.id === state.b), 10000);
  });

  await t.test('overlay shortcut, isolation, Escape, and focus restoration', async () => {
    await driver.get(`${base}/overlay`);
    await click('focus');
    await shortcut();
    const host = await driver.wait(until.elementLocated(By.id('cmt-overlay')), 10000);
    assert.equal(await driver.executeScript('return document.querySelector("#cmt-overlay").shadowRoot;'), null);
    const shadow = await host.getShadowRoot();
    const frame = await shadow.findElement(By.css('iframe'));
    await driver.switchTo().frame(frame);
    await driver.wait(until.elementLocated(By.id('search')), 10000);
    await driver.findElement(By.css('[data-mode="recent"]')).click();
    assert.equal(await driver.findElement(By.css('[data-mode="recent"]')).getAttribute('aria-pressed'), 'true');
    await driver.findElement(By.css('[data-mode="pinned"]')).click();
    assert.equal((await driver.findElements(By.css('.tab-row'))).length, 1);
    await driver.findElement(By.id('search')).sendKeys('duplicate');
    await driver.wait(async () => (await driver.findElements(By.css('.tab-row'))).length === 1, 10000);
    await driver.findElement(By.id('search')).sendKeys(Key.ESCAPE);
    await driver.switchTo().defaultContent();
    await driver.wait(async () => driver.executeScript('return !document.querySelector("#cmt-overlay");'), 10000);
    assert.equal(await driver.executeScript('return document.activeElement.id;'), 'focus');
  });

  await t.test('previous-tab command and keyboard Enter activate real tabs', async () => {
    await driver.get(`${origin}/manager.html`);
    await driver.wait(until.elementLocated(By.id('search')), 10000);
    await action('activate', [state.a]);
    // Keep the driver on its manager handle while switching real active tabs.
    const manager = await driver.getWindowHandle();
    await driver.switchTo().window(manager);
    await invoke('return browser.tabs.update(args[0], {active: true});', state.a);
    const managerId = await invoke('return (await browser.tabs.getCurrent()).id;');
    await invoke('return browser.tabs.update(args[0], {active: true});', managerId);
    await shortcut('j');
    await driver.wait(async () => (await invoke('return browser.tabs.get(args[0]);', state.a)).active, 10000);
    await driver.switchTo().window(manager);
    await invoke('return browser.tabs.update(args[0], {active: true});', managerId);
    await driver.findElement(By.id('search')).sendKeys('duplicate', Key.ENTER);
    await driver.wait(async () => (await invoke('return browser.tabs.get(args[0]);', state.a)).active, 10000);
  });

  await t.test('restricted-page shortcut opens the popup', async () => {
    await driver.get('about:config');
    await driver.setContext('chrome');
    await driver.executeScript(`gBrowser.selectedTab = [...gBrowser.tabs].find(tab => tab.linkedBrowser.currentURI.spec === 'about:config');`);
    await driver.setContext('content');
    await shortcut();
    // Firefox popup documents are not regular WebDriver windows. Inspect chrome in this disposable profile.
    await driver.setContext('chrome');
    try {
      await driver.wait(async () => driver.executeScript('return [...document.querySelectorAll("panel")].some(p => p.state === "open" && [...p.querySelectorAll("browser")].some(b => b.currentURI?.spec === arguments[0]));', `${origin}/popup.html`), 10000);
    } catch (error) {
      console.log('Popup diagnostic:', await driver.executeScript(`return {url: gBrowser.selectedBrowser.currentURI.spec, panels: [...document.querySelectorAll('panel')].map(p => ({id:p.id,state:p.state, browsers:[...p.querySelectorAll('browser')].map(b=>b.currentURI?.spec)})), errors:Services.console.getMessageArray().map(m=>m.message).slice(-8)};`));
      throw error;
    } finally { await driver.setContext('content'); }
  });

  await t.test('995 tabs: live counts, fuzzy search, and bounded rendering', async () => {
    await driver.get(`${origin}/manager.html`);
    await driver.wait(until.elementLocated(By.id('search')), 10000);
    await invoke(`
      const current = (await browser.runtime.sendMessage({type: 'snapshot'})).tabs.length;
      for (let i = current; i < 995; i++) await browser.tabs.create({url: 'https://example.invalid/reference/' + i, title: 'Reference ' + i, active: false, discarded: true});
      return true;
    `);
    await driver.wait(async () => (await driver.findElement(By.id('result-count')).getText()).includes('995 tabs'), 20000);
    assert.equal((await driver.findElements(By.css('.tab-row'))).length, 100);
    await click('select-all');
    assert.match(await driver.findElement(By.id('selection-count')).getText(), /995 selected/);
    await driver.findElement(By.id('search')).sendKeys('ref 994');
    await driver.wait(async () => (await driver.findElements(By.css('.tab-row'))).length === 1, 10000);
    assert.match(await driver.findElement(By.id('results')).getText(), /Reference 994/);
    await driver.findElement(By.id('search')).clear();
    await driver.findElement(By.id('search')).sendKeys('ref');
    await driver.wait(async () => (await driver.findElements(By.css('.tab-row'))).length === 100, 10000);
    await writeFile('artifacts/manager.png', await driver.takeScreenshot(), 'base64');
    console.log('Firefox version:', (await driver.getCapabilities()).get('browserVersion'));
  });
});
