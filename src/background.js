import { createService } from './service.js';
import { createAccess } from './access.js';

const service = createService(browser);
const access = createAccess(browser.runtime.getURL(''));
const ready = browser.tabs.query({ active: true }).then((tabs) => {
  for (const tab of tabs) service.recordActivation({ tabId: tab.id, windowId: tab.windowId });
});
browser.tabs.onActivated.addListener(service.recordActivation);
browser.commands.onCommand.addListener((command, tab) => {
  if (!tab) return;
  if (command === 'open-palette') access.issue(tab.id);
  const task = command === 'open-palette' ? service.openPalette(tab.id, tab.url) : ready.then(() => service.previous(tab.windowId));
  task.catch((error) => console.error('CMT command failed:', error.message || error));
});
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (sender.id !== browser.runtime.id) return;
  if (message.type === 'overlay-context' && !sender.url?.startsWith(browser.runtime.getURL(''))) return access.context(sender.tab?.id);
  if (message.type === 'end-overlay' && message.token && access.context(sender.tab?.id)?.token === message.token) { access.revoke(sender.tab.id); return; }
  if (!access.allowed(sender)) throw new Error('Open CMT with its command or toolbar button.');
  await ready;
  const windowId = sender.tab?.windowId ?? (await browser.windows.getLastFocused()).id;
  if (message.type === 'snapshot') return service.snapshot(windowId);
  if (message.type === 'act') return service.act(message.request);
  if (message.type === 'previous') return service.previous(windowId);
  if (message.type === 'manager') {
    const url = browser.runtime.getURL('manager.html');
    const existing = (await browser.tabs.query({})).find((tab) => tab.url === url && tab.windowId === windowId);
    if (existing) return service.act({ action: 'activate', ids: [existing.id] });
    await browser.tabs.create({ url, windowId });
  }
});
browser.tabs.onRemoved.addListener((tabId) => access.revoke(tabId));
let timer;
function changed() {
  clearTimeout(timer);
  timer = setTimeout(() => browser.runtime.sendMessage({ type: 'tabs-changed' }).catch(() => {}), 100);
}
for (const event of [browser.tabs.onCreated, browser.tabs.onRemoved, browser.tabs.onUpdated, browser.tabs.onMoved, browser.tabs.onAttached, browser.tabs.onDetached, browser.tabs.onActivated]) event.addListener(changed);
