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
  async function setViewport(width, height) {
    const chromeSize = await driver.executeScript('return {width: outerWidth - innerWidth, height: outerHeight - innerHeight};');
    await driver.manage().window().setRect({ width: width + chromeSize.width, height: height + chromeSize.height });
    await driver.wait(async () => driver.executeScript('return Math.abs(innerWidth - arguments[0]) <= 1 && Math.abs(innerHeight - arguments[1]) <= 1;', width, height), 10000);
  }
  async function layout() {
    return driver.executeScript(`
      const bounds = (el) => {
        const rect = el.getBoundingClientRect();
        return {top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height};
      };
      const app = document.querySelector('#app');
      return {
        viewport: {width: innerWidth, height: innerHeight},
        document: {height: document.scrollingElement.scrollHeight, width: document.scrollingElement.scrollWidth},
        app: {height: app.scrollHeight, width: app.scrollWidth, clientHeight: app.clientHeight, clientWidth: app.clientWidth},
        results: {...bounds(document.querySelector('#results')), scrollHeight: document.querySelector('#results').scrollHeight, clientHeight: document.querySelector('#results').clientHeight},
        controls: ['header', 'nav', '#search', '#filters', '.selection-bar', '.actions', '#result-count', 'footer', '.help'].map(selector => ({selector, ...bounds(document.querySelector(selector))})),
        fields: ['window-filter', 'host-filter', 'age-filter', 'sort'].map(id => ({id, ...bounds(document.getElementById(id))})),
        checks: [...document.querySelectorAll('#filters input[type=checkbox]')].map(bounds),
        panels: [...document.querySelectorAll('.panel-details[open] .details-content')].map(bounds),
      };
    `);
  }
  function assertFits(metrics) {
    assert.ok(metrics.document.height <= metrics.viewport.height + 1, `Document must not scroll: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.document.width <= metrics.viewport.width + 1, 'Document must not scroll sideways');
    assert.ok(metrics.app.height <= metrics.app.clientHeight + 1, 'Controls must fit, not be clipped inside the app');
    assert.ok(metrics.app.width <= metrics.app.clientWidth + 1, 'Controls must not overflow sideways');
    assert.ok(metrics.results.height >= 48, 'At least one result must fit');
    assert.ok(metrics.results.scrollHeight > metrics.results.clientHeight, 'Only the results list needs to scroll');
    const footer = metrics.controls.find((control) => control.selector === 'footer');
    for (const panel of metrics.panels) {
      assert.ok(panel.bottom <= footer.top, 'Help and reports must not cover the page buttons');
      assert.ok(panel.top >= 0, 'Help and reports must stay within the palette');
    }
    for (const control of metrics.controls) {
      assert.ok(control.top >= -1 && control.bottom <= metrics.viewport.height + 1, `${control.selector} must remain visible`);
      assert.ok(control.left >= -1 && control.right <= metrics.viewport.width + 1, `${control.selector} must fit horizontally`);
    }
  }
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

  await t.test('filter fields align and the manager fits its viewport', async () => {
    await driver.get(`${origin}/manager.html`);
    await setViewport(1073, 919);
    await driver.wait(until.elementLocated(By.css('.tab-row')), 10000);
    await driver.findElement(By.css('#filters summary')).click();
    const metrics = await layout();
    console.log('Filter fields:', metrics.fields.map(({id, width, height, top}) => `${id}: ${width}×${height} at y=${top}`).join(', '));
    for (const field of metrics.fields) {
      assert.ok(Math.abs(field.height - metrics.fields[0].height) <= 1, `${field.id} must have the same height as the select`);
      assert.ok(Math.abs(field.width - metrics.fields[0].width) <= 1, `${field.id} must have the same width as the select`);
      assert.ok(Math.abs(field.top - metrics.fields[0].top) <= 1, `${field.id} must align with the select`);
    }
    for (const check of metrics.checks) assert.equal(check.height, metrics.checks[0].height);
    assertFits(metrics);
  });

  await t.test('narrow filter rows stay aligned without horizontal overflow', async () => {
    await driver.get(`${origin}/manager.html`);
    await setViewport(560, 900);
    await driver.wait(until.elementLocated(By.css('.tab-row')), 10000);
    await driver.findElement(By.css('#filters summary')).click();
    const metrics = await layout();
    for (const field of metrics.fields) {
      assert.ok(Math.abs(field.width - metrics.fields[0].width) <= 1);
      assert.equal(field.height, metrics.fields[0].height);
    }
    assert.equal(metrics.fields[0].top, metrics.fields[1].top);
    assert.equal(metrics.fields[2].top, metrics.fields[3].top);
    assert.ok(metrics.fields[2].top > metrics.fields[0].top);
    assertFits(metrics);
  });

  for (const size of [{name: 'normal', width: 1073, height: 919}, {name: 'short', width: 850, height: 760}]) {
    await t.test(`${size.name} overlay scrolls results, not the palette`, async () => {
      await driver.switchTo().defaultContent();
      await driver.get(`${base}/layout`);
      await setViewport(size.width, size.height);
      await click('focus');
      await shortcut();
      const host = await driver.wait(until.elementLocated(By.id('cmt-overlay')), 10000);
      const frame = await (await host.getShadowRoot()).findElement(By.css('iframe'));
      await driver.switchTo().frame(frame);
      await driver.wait(until.elementLocated(By.css('.tab-row')), 10000);
      assertFits(await layout());
      await driver.findElement(By.css('#filters summary')).click();
      assertFits(await layout());
      await writeFile(`artifacts/overlay-${size.name}.png`, await driver.takeScreenshot(), 'base64');
      await driver.findElement(By.css('.help summary')).click();
      assertFits(await layout());
      await click('page-next');
      assert.match(await driver.findElement(By.id('page-count')).getText(), /Page 2/);
      assertFits(await layout());
      await click('page-back');
      await driver.executeScript('document.querySelector("#results").scrollTop = 200;');
      assert.ok(await driver.executeScript('return document.querySelector("#results").scrollTop > 0 && document.scrollingElement.scrollTop === 0;'));
      await writeFile(`artifacts/overlay-${size.name}-help.png`, await driver.takeScreenshot(), 'base64');
      await driver.findElement(By.id('search')).sendKeys(Key.ESCAPE);
      await driver.switchTo().defaultContent();
    });
  }

  await t.test('popup filters, help, and failure details fit without a page scrollbar', async () => {
    await driver.switchTo().defaultContent();
    await driver.get(`${origin}/popup.html`);
    await setViewport(760, 590);
    await driver.wait(until.elementLocated(By.css('.tab-row')), 10000);
    assertFits(await layout());
    await driver.findElement(By.css('#filters summary')).click();
    assertFits(await layout());
    await driver.findElement(By.css('.help summary')).click();
    assertFits(await layout());
    await driver.findElement(By.css('.help summary')).click();
    await driver.executeScript(`
      document.querySelector('#status').textContent = 'close: 0 done, 0 skipped, 100 failed.';
      const failures = document.querySelector('#failures');
      failures.textContent = Array.from({length: 100}, (_, n) => 'Tab ' + n + ': Tab is gone.').join('\\n');
      failures.hidden = false;
      const panel = document.querySelector('#failures-panel');
      if (panel) { panel.hidden = false; panel.open = true; }
    `);
    assertFits(await layout());
    await driver.findElement(By.css('.help summary')).click();
    assert.equal((await driver.findElements(By.css('.panel-details[open]'))).length, 1, 'Help and reports must not overlap');
    assertFits(await layout());
    await driver.findElement(By.css('#failures-panel summary')).click();
    assert.equal((await driver.findElements(By.css('.panel-details[open]'))).length, 1);
    await writeFile('artifacts/popup-layout.png', await driver.takeScreenshot(), 'base64');
  });

  await t.test('search rejects weak matches and uses the best alignment in full URLs and titles', async () => {
    await driver.get(`${origin}/manager.html`);
    await driver.wait(until.elementLocated(By.id('search')), 10000);
    const loose = [...'youtube'].join('x'.repeat(30));
    const fixtures = await invoke(`
      const rows = [
        {title: args[1], url: args[0] + '/search-noise'},
        {title: 'Unrelated checkout', url: args[0] + '/?token=' + args[1]},
        {title: 'YouTube guide', url: args[0] + '/search-exact'},
        {title: 'you t u b e', url: args[0] + '/search-compact'},
        {title: 'you t u b e — YouTube guide', url: args[0] + '/search-literal'},
        {title: 'm' + '.'.repeat(80) + ' Mozilla', url: args[0] + '/search-alignment'},
        {title: 'Mozilla', url: args[0] + '/search-alignment-copy'},
        {title: 'Notes', url: args[0] + '/?label=YouTube'},
      ];
      const tabs = [];
      for (const row of rows) tabs.push(await browser.tabs.create({...row, active: false, discarded: true}));
      return tabs.map(tab => tab.id);
    `, base, loose);
    const resultIds = () => driver.executeScript('return [...document.querySelectorAll("#results [data-activate]")].map(el => Number(el.dataset.activate));');
    const search = async (text, count) => {
      const field = await driver.findElement(By.id('search'));
      await field.clear();
      await field.sendKeys(text);
      assert.match(await driver.findElement(By.id('result-count')).getText(), new RegExp(`^${count} matches /`));
    };
    try {
      await driver.wait(async () => (await driver.findElement(By.id('result-count')).getText()).includes('1003 tabs'), 10000);
      await search('youtube', 4);
      assert.deepEqual(await resultIds(), [fixtures[2], fixtures[4], fixtures[7], fixtures[3]]);
      await writeFile('artifacts/search-relevance.png', await driver.takeScreenshot(), 'base64');
      await search('mzla', 2);
      assert.deepEqual(await resultIds(), [fixtures[5], fixtures[6]]);
      await search('ytb', 4);
      assert.deepEqual((await resultIds()).sort((a, b) => a - b), [fixtures[2], fixtures[3], fixtures[4], fixtures[7]]);
    } finally {
      await invoke('return browser.tabs.remove(args[0]);', fixtures);
    }
  });
});
