import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountUI } from '../src/ui.js';

async function setup(count = 5, result) {
  const dom = new JSDOM('<main id="app"></main>', { url: 'https://test/' });
  const tabs = Array.from({ length: count }, (_, n) => ({ id: n + 1, windowId: 1, title: n === 0 ? '<img src=x onerror=alert(1)>' : `Reference ${n}`, url: `https://example.org/${n}`, pinned: n === 1, lastAccessed: n }));
  const calls = [];
  const ui = await mountUI(dom.window.document, {
    snapshot: async () => ({ tabs, windowId: 1 }),
    act: async (action) => { calls.push(action); return result ?? { done: action.ids, skipped: [], failed: [] }; },
    dismiss: () => calls.push('dismiss'), manager: () => calls.push('manager'), previous: async () => {},
  });
  const doc = dom.window.document;
  const click = (selector) => doc.querySelector(selector).click();
  const input = (selector, value) => { const el = doc.querySelector(selector); el.value = value; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const key = (key, props = {}) => doc.querySelector('#search').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, ...props }));
  return { doc, ui, calls, click, input, key, dom };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('action issues remain readable in a report that clears after success', async () => {
  const result = { done: [], skipped: [], failed: [{ id: 1, reason: 'Tab is gone.' }] };
  const { doc, click } = await setup(5, result);
  click('#select-all');
  click('[data-action="pin"]');
  await tick();
  assert.equal(doc.querySelector('#failures-panel').hidden, false);
  assert.match(doc.querySelector('#failures').textContent, /Tab 1: Tab is gone/);
  result.failed = [];
  click('[data-action="pin"]');
  await tick();
  assert.equal(doc.querySelector('#failures-panel').hidden, true);
  assert.equal(doc.querySelector('#failures').hidden, true);
});

test('titles render as text and search filters results', async () => {
  const { doc, input } = await setup();
  assert.equal(doc.querySelector('img'), null);
  assert.ok(doc.body.textContent.includes('<img src=x'));
  input('#search', 'ref 3');
  assert.equal(doc.querySelectorAll('.tab-row').length, 1);
});
test('modes, keyboard navigation, Enter and Escape work', async () => {
  const { doc, click, key, calls } = await setup();
  click('[data-mode="pinned"]');
  assert.equal(doc.querySelectorAll('.tab-row').length, 1);
  key('Enter');
  await tick();
  assert.equal(calls[0].ids[0], 2);
  click('[data-mode="all"]');
  key('ArrowDown');
  assert.equal(doc.activeElement.dataset.activate, '2');
  key('Escape');
  assert.ok(calls.includes('dismiss'));
  key('3', { ctrlKey: true, shiftKey: true, code: 'Digit3' });
  assert.equal(doc.querySelectorAll('.tab-row').length, 1);
});
test('select all covers results beyond the first page; actions retain selection', async () => {
  const { doc, click, calls } = await setup(995);
  assert.equal(doc.querySelectorAll('.tab-row').length, 100);
  click('#select-all');
  assert.match(doc.querySelector('#selection-count').textContent, /995/);
  click('[data-action="pin"]');
  await tick();
  assert.equal(calls[0].ids.length, 995);
});
test('Shift range uses all result IDs and clear selection works', async () => {
  const { doc, dom, click } = await setup();
  click('[data-select="2"]');
  doc.querySelector('[data-select="5"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }));
  assert.match(doc.querySelector('#selection-count').textContent, /4 selected/);
  click('#clear-selection');
  assert.match(doc.querySelector('#selection-count').textContent, /0 selected/);
});
test('close is not sent until confirmed; cancellation keeps tabs unchanged', async () => {
  const { doc, click, calls } = await setup();
  click('#select-all');
  click('[data-action="close"]');
  assert.equal(calls.length, 0);
  assert.equal(doc.querySelector('#confirm-panel').hidden, false);
  assert.equal(doc.querySelector('#results').hasAttribute('inert'), true);
  click('#cancel-close');
  assert.equal(doc.querySelector('#results').hasAttribute('inert'), false);
  assert.equal(calls.length, 0);
  click('[data-action="close"]');
  click('#allow-pinned');
  click('#confirm-close');
  await tick();
  assert.equal(calls[0].confirmed, true);
  assert.equal(calls[0].includePinned, true);
});
