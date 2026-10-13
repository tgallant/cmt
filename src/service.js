const actions = new Set(['activate', 'pin', 'unpin', 'mute', 'unmute', 'discard', 'close']);

export function createService(api) {
  const history = new Map();
  async function snapshot(windowId) {
    const tabs = await api.tabs.query({});
    const own = api.runtime.getURL('');
    return { windowId, tabs: tabs.filter((tab) => !tab.url?.startsWith(own)) };
  }
  async function act({ action, ids, confirmed = false, includePinned = false }) {
    if (!actions.has(action)) throw new Error('Unknown action.');
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) throw new Error('Invalid tab selection.');
    if (action === 'close' && !confirmed) throw new Error('Confirm before you close tabs.');
    const result = { done: [], skipped: [], failed: [] };
    for (const id of new Set(ids)) {
      try {
        const tab = await api.tabs.get(id);
        if (action === 'close' && tab.pinned && !includePinned) {
          result.skipped.push({ id, reason: 'Pinned tab is protected.' });
          continue;
        }
        if (action === 'discard' && (tab.active || tab.audible)) {
          result.skipped.push({ id, reason: 'Active or audible tab cannot be discarded.' });
          continue;
        }
        if (action === 'activate') {
          await api.tabs.update(id, { active: true });
          await api.windows.update(tab.windowId, { focused: true });
        } else if (action === 'close') await api.tabs.remove(id);
        else if (action === 'discard') await api.tabs.discard(id);
        else if (action === 'pin' || action === 'unpin') await api.tabs.update(id, { pinned: action === 'pin' });
        else await api.tabs.update(id, { muted: action === 'mute' });
        result.done.push(id);
      } catch (error) { result.failed.push({ id, reason: error.message }); }
    }
    return result;
  }
  function recordActivation({ tabId, windowId }) {
    const recent = history.get(windowId) || [];
    history.set(windowId, [tabId, ...recent.filter((id) => id !== tabId)].slice(0, 50));
  }
  async function previous(windowId) {
    const active = (await api.tabs.query({ active: true, windowId })).find((tab) => tab.active && tab.windowId === windowId);
    for (const id of history.get(windowId) || []) {
      if (id === active?.id) continue;
      const result = await act({ action: 'activate', ids: [id] });
      if (result.done.length) return result;
    }
    return { done: [], skipped: [], failed: [] };
  }
  function openPalette(tabId, url = '') {
    // Open known restricted pages while the command's user gesture is active.
    if (/^(about:|moz-extension:|view-source:)/.test(url) || /^https:\/\/addons\.mozilla\.org\//.test(url)) return api.browserAction.openPopup();
    return api.tabs.executeScript(tabId, { file: '/content.js' }).catch(() => api.browserAction.openPopup());
  }
  return { snapshot, act, recordActivation, previous, openPalette };
}
