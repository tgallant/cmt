import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebDriver } from 'selenium-webdriver';
import { resizeViewport } from './browser/viewport.js';

// Fake only the remote browser geometry. Use Selenium's real condition wait.
function browserGeometry(chromeAfterResize = () => ({ width: 0, height: 86 })) {
  let geometry = { innerWidth: 850, innerHeight: 760, outerWidth: 850, outerHeight: 846 };
  const requests = [];
  const driver = {
    async executeScript() { return { ...geometry }; },
    manage: () => ({ window: () => ({
      async setRect(rect) {
        requests.push(rect);
        const chrome = chromeAfterResize(rect);
        geometry = { outerWidth: rect.width, outerHeight: rect.height, innerWidth: rect.width - chrome.width, innerHeight: rect.height - chrome.height };
      },
    }) }),
    wait(...args) { return WebDriver.prototype.wait.call(this, ...args); },
  };
  return { driver, requests, geometry: () => geometry };
}
const fast = { timeout: 50, pollInterval: 0 };

test('viewport resizing reaches the requested size with stable browser chrome', async () => {
  const browser = browserGeometry();
  await resizeViewport(browser.driver, 760, 590, fast);
  assert.equal(browser.geometry().innerWidth, 760);
  assert.equal(browser.geometry().innerHeight, 590);
});
test('viewport resizing corrects the 12-pixel chrome-height change seen in Linux CI', async () => {
  const browser = browserGeometry(() => ({ width: 0, height: 74 }));
  await resizeViewport(browser.driver, 760, 590, fast);
  assert.equal(browser.geometry().innerWidth, 760);
  assert.equal(browser.geometry().innerHeight, 590);
  assert.deepEqual(browser.requests, [{ width: 760, height: 676 }, { width: 760, height: 664 }]);
});
test('an already correct viewport is not resized', async () => {
  const browser = browserGeometry();
  await resizeViewport(browser.driver, 850, 760, fast);
  assert.deepEqual(browser.requests, []);
});
test('an unreachable viewport fails rather than accepting a larger size', async () => {
  const browser = browserGeometry((rect) => ({ width: rect.width - 760, height: rect.height - 602 }));
  await assert.rejects(resizeViewport(browser.driver, 760, 590, fast), /Viewport must reach 760×590/);
  assert.equal(browser.geometry().innerHeight, 602);
});
test('browser resize errors propagate without being hidden by retries', async () => {
  const error = new Error('Browser window is unavailable');
  const browser = browserGeometry(() => { throw error; });
  await assert.rejects(resizeViewport(browser.driver, 760, 590, fast), (actual) => actual === error);
});
