import { queryTabs, duplicateExtras, selectRange, hostOf } from './model.js';

const pageSize = 100;

export async function mountUI(doc, api) {
  const root = doc.querySelector('#app');
  // This template has no tab data. Untrusted values use textContent below.
  root.innerHTML = `
    <header><h1>CMT <span>/ tab console</span></h1><button id="manager">Open manager</button><button id="dismiss" aria-label="Close palette">Esc</button></header>
    <nav aria-label="Tab view"><button data-mode="all" aria-pressed="true">1 All</button><button data-mode="recent" aria-pressed="false">2 Recent</button><button data-mode="pinned" aria-pressed="false">3 Pinned</button><button id="previous-tab">Previous tab</button></nav>
    <label class="search-label" for="search">Search titles and URLs</label><input id="search" type="search" autocomplete="off" spellcheck="false" placeholder="Type letters in order…" aria-controls="results">
    <details id="filters"><summary>Filters and sort</summary><div class="filter-grid">
      <label>Window<select id="window-filter"><option value="">All windows</option><option value="current">Current window</option></select></label>
      <label>Host<input id="host-filter" placeholder="example.org"></label>
      <label>Not accessed for (days)<input id="age-filter" type="number" min="1" placeholder="30"></label>
      <label>Sort<select id="sort"><option value="relevance">Relevance</option><option value="recent">Recent first</option><option value="oldest">Oldest first</option><option value="title">Title</option><option value="host">Host</option><option value="order">Tab order</option></select></label>
      <label><input id="pinned-filter" type="checkbox">Pinned</label><label><input id="discarded-filter" type="checkbox">Discarded</label><label><input id="audible-filter" type="checkbox">Audible</label><label><input id="duplicate-filter" type="checkbox">Exact duplicates</label>
      <button id="reset-filters">Reset filters</button>
    </div></details>
    <section class="selection-bar" aria-label="Selection"><span id="selection-count">0 selected</span><button id="select-all">Select all matches</button><button id="clear-selection">Clear selection</button><button id="select-extras">Select duplicate extras</button></section>
    <p class="safety-note">Warning: Discard or close can lose unsaved page data.</p>
    <section class="actions" aria-label="Tab actions"><button data-action="pin">Pin</button><button data-action="unpin">Unpin</button><button data-action="mute">Mute</button><button data-action="unmute">Unmute</button><button data-action="discard">Discard</button><button data-action="close" class="danger">Close…</button></section>
    <section id="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" hidden tabindex="-1"><h2 id="confirm-title">Close selected tabs?</h2><p id="confirm-count"></p><p>Unsaved page data can be lost. Pinned tabs stay open by default.</p><label><input type="checkbox" id="allow-pinned">Also close pinned tabs</label><div><button id="cancel-close">Cancel</button><button id="confirm-close" class="danger">Close tabs</button></div></section>
    <p id="result-count"></p><ul id="results" aria-label="Matching tabs"></ul>
    <footer><button id="page-back">← Previous page</button><span id="page-count"></span><button id="page-next">Next page →</button></footer>
    <p id="status" role="status" aria-live="polite"></p><pre id="failures" hidden></pre>
    <details class="help"><summary>Keys and safety</summary><p>↑ ↓ Move · Enter Switch · Space Select · Shift+Space Select range</p><p>Ctrl/Command+Shift+1/2/3 View · Ctrl/Command+Shift+A Select all matches · Ctrl/Command+K Search · Esc Close</p><p>Selection stays when filters change. Actions affect all selected tabs. Discard frees memory. It does not close a tab. Active and audible tabs are not discarded.</p><p>Duplicate extras keep one exact URL copy. Pinned copies come first, then active copies, then recent copies. Age uses last access, not creation time.</p></details>`;
  const $ = (selector) => doc.querySelector(selector);
  let tabs = [];
  let windowId;
  let mode = 'all';
  let selected = new Set();
  let rows = [];
  let cursor = 0;
  let page = 0;
  let anchor;
  let pendingClose = [];
  let busy = false;
  let revision = 0;

  function status(text) { $('#status').textContent = text; }
  function selectionInfo() {
    const visible = new Set(rows.map((tab) => tab.id));
    const hidden = [...selected].filter((id) => !visible.has(id)).length;
    $('#selection-count').textContent = `${selected.size} selected${hidden ? ` (${hidden} outside filters)` : ''}`;
    for (const button of doc.querySelectorAll('[data-action]')) button.disabled = busy || !selected.size;
    for (const checkbox of doc.querySelectorAll('[data-select]')) checkbox.checked = selected.has(Number(checkbox.dataset.select));
  }
  function draw() {
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
    cursor = Math.min(cursor, Math.max(0, rows.length - 1));
    const list = $('#results');
    list.replaceChildren();
    const fragment = doc.createDocumentFragment();
    for (const [offset, tab] of rows.slice(page * pageSize, (page + 1) * pageSize).entries()) {
      const row = doc.createElement('li');
      row.className = 'tab-row';
      if (page * pageSize + offset === cursor) row.classList.add('current');
      const checkbox = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.select = tab.id;
      checkbox.setAttribute('aria-label', `Select ${tab.title || tab.url}`);
      checkbox.checked = selected.has(tab.id);
      const button = doc.createElement('button');
      button.dataset.activate = tab.id;
      button.className = 'tab-target';
      const title = doc.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || tab.url || 'Untitled tab';
      const meta = doc.createElement('span');
      meta.className = 'tab-meta';
      const flags = [tab.pinned && 'PIN', tab.discarded && 'DISCARDED', tab.audible && 'AUDIO', tab.mutedInfo?.muted && 'MUTED', tab.active && 'ACTIVE', tab.incognito && 'PRIVATE'].filter(Boolean);
      const age = tab.lastAccessed ? `${Math.max(0, Math.floor((Date.now() - tab.lastAccessed) / 86400000))}d` : 'age unknown';
      meta.textContent = `${flags.join(' ')} · W${tab.windowId} · ${hostOf(tab) || tab.url || ''} · ${age}`;
      button.title = tab.url || '';
      button.append(title, meta);
      row.append(checkbox, button);
      fragment.append(row);
    }
    list.append(fragment);
    $('#result-count').textContent = `${rows.length} matches / ${tabs.length} tabs`;
    $('#page-count').textContent = `Page ${page + 1} / ${Math.max(1, Math.ceil(rows.length / pageSize))}`;
    $('#page-back').disabled = page === 0;
    $('#page-next').disabled = (page + 1) * pageSize >= rows.length;
    selectionInfo();
  }
  function query(reset = true) {
    if (reset) { cursor = 0; page = 0; }
    rows = queryTabs(tabs, {
      search: $('#search').value, mode, sort: $('#sort').value,
      filters: { windowId: $('#window-filter').value === 'current' ? windowId : $('#window-filter').value, host: $('#host-filter').value, olderDays: Math.max(0, Number($('#age-filter').value)), pinned: $('#pinned-filter').checked, discarded: $('#discarded-filter').checked, audible: $('#audible-filter').checked, duplicate: $('#duplicate-filter').checked },
    });
    draw();
  }
  async function refresh() {
    const request = ++revision;
    try {
      const snapshot = await api.snapshot();
      if (request !== revision) return;
      tabs = snapshot.tabs;
      windowId = snapshot.windowId;
      const live = new Set(tabs.map((tab) => tab.id));
      selected = new Set([...selected].filter((id) => live.has(id)));
      const select = $('#window-filter');
      const value = select.value;
      while (select.options.length > 2) select.remove(2);
      for (const id of new Set(tabs.map((tab) => tab.windowId))) {
        const option = doc.createElement('option');
        option.value = id;
        option.textContent = `Window ${id}`;
        select.append(option);
      }
      select.value = value;
      query(false);
    } catch (error) { status(`Cannot read tabs: ${error.message}`); }
  }
  async function run(action, ids = [...selected], options = {}) {
    if (busy) return;
    busy = true;
    selectionInfo();
    status(`Working: ${action} ${ids.length} tabs…`);
    try {
      const result = await api.act({ action, ids, ...options });
      const issues = [...result.skipped, ...result.failed];
      status(`${action}: ${result.done.length} done, ${result.skipped.length} skipped, ${result.failed.length} failed.`);
      $('#failures').textContent = issues.map((issue) => `Tab ${issue.id}: ${issue.reason}`).join('\n');
      $('#failures').hidden = !issues.length;
      if (action === 'activate' && result.done.length) api.dismiss();
      await refresh();
    } catch (error) { status(`Action failed: ${error.message}`); }
    finally { busy = false; selectionInfo(); }
  }
  function toggle(id, range = false) {
    if (range && anchor !== undefined) selected = selectRange(selected, rows.map((tab) => tab.id), anchor, id);
    else { if (selected.has(id)) selected.delete(id); else selected.add(id); anchor = id; }
    selectionInfo();
  }
  function setMode(value) {
    mode = value;
    for (const button of doc.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    query();
    $('#search').focus();
  }
  function modal(open) {
    $('#confirm-panel').hidden = !open;
    for (const child of root.children) {
      if (child.id !== 'confirm-panel') child.toggleAttribute('inert', open);
    }
  }
  function cancelClose() {
    modal(false);
    pendingClose = [];
    $('[data-action="close"]').focus();
  }
  root.addEventListener('input', (event) => { if (event.target.closest('#filters') || event.target.id === 'search') query(); });
  root.addEventListener('change', (event) => { if (event.target.closest('#filters')) query(); });
  root.addEventListener('click', (event) => {
    const target = event.target.closest('button, input');
    if (!target || (!$('#confirm-panel').hidden && !target.closest('#confirm-panel'))) return;
    if (target.dataset.select) { toggle(Number(target.dataset.select), event.shiftKey); return; }
    if (target.dataset.activate) { run('activate', [Number(target.dataset.activate)]); return; }
    if (target.dataset.mode) { setMode(target.dataset.mode); return; }
    if (target.dataset.action) {
      if (target.dataset.action !== 'close') run(target.dataset.action);
      else {
        pendingClose = [...selected];
        $('#confirm-count').textContent = `${pendingClose.length} tabs selected.`;
        $('#allow-pinned').checked = false;
        modal(true);
        $('#cancel-close').focus();
      }
      return;
    }
    if (target.id === 'select-all') { selected = new Set([...selected, ...rows.map((tab) => tab.id)]); selectionInfo(); }
    else if (target.id === 'clear-selection') { selected.clear(); selectionInfo(); }
    else if (target.id === 'select-extras') {
      // Use all tabs to choose the keeper, then restrict extras to current matches.
      const matches = new Set(rows.map((tab) => tab.id));
      selected = new Set(duplicateExtras(tabs).filter((id) => matches.has(id)));
      selectionInfo();
    } else if (target.id === 'cancel-close') cancelClose();
    else if (target.id === 'confirm-close') {
      const ids = pendingClose;
      const includePinned = $('#allow-pinned').checked;
      cancelClose();
      run('close', ids, { confirmed: true, includePinned });
    } else if (target.id === 'dismiss') api.dismiss();
    else if (target.id === 'manager') api.manager();
    else if (target.id === 'previous-tab') api.previous().then(() => api.dismiss()).catch((error) => status(error.message));
    else if (target.id === 'page-next' || target.id === 'page-back') { page += target.id === 'page-next' ? 1 : -1; cursor = page * pageSize; draw(); }
    else if (target.id === 'reset-filters') {
      for (const input of doc.querySelectorAll('#filters input')) { input.value = ''; input.checked = false; }
      $('#window-filter').value = '';
      $('#sort').value = 'relevance';
      query();
    }
  });
  doc.addEventListener('keydown', (event) => {
    if (!$('#confirm-panel').hidden) {
      if (event.key === 'Escape') { event.preventDefault(); cancelClose(); }
      if (event.key === 'Tab') {
        const controls = [$('#allow-pinned'), $('#cancel-close'), $('#confirm-close')];
        const index = controls.indexOf(doc.activeElement);
        event.preventDefault();
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); api.dismiss(); return; }
    const viewKey = event.code?.replace('Digit', '') || event.key;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && ['1', '2', '3'].includes(viewKey)) { event.preventDefault(); setMode(['all', 'recent', 'pinned'][Number(viewKey) - 1]); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search').focus(); return; }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); $('#select-all').click(); return; }
    const atResults = event.target.id === 'search' || event.target.dataset.activate;
    if (!atResults || !rows.length) return;
    if (event.target.dataset.activate) cursor = rows.findIndex((tab) => tab.id === Number(event.target.dataset.activate));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      page = Math.floor(cursor / pageSize);
      draw();
      $(`[data-activate="${rows[cursor].id}"]`).focus();
    } else if (event.key === 'Enter' && event.target.id === 'search') { event.preventDefault(); run('activate', [rows[cursor].id]); }
    else if (event.key === ' ' && event.target.dataset.activate) { event.preventDefault(); toggle(rows[cursor].id, event.shiftKey); }
  });
  await refresh();
  $('#search').focus();
  return { refresh };
}

if (typeof browser !== 'undefined' && typeof document !== 'undefined') {
  const kind = document.body.dataset.kind;
  const send = (message) => browser.runtime.sendMessage(message);
  const api = {
    snapshot: () => send({ type: 'snapshot' }),
    act: (request) => send({ type: 'act', request }),
    previous: () => send({ type: 'previous' }),
    manager: () => send({ type: 'manager' }),
    dismiss: () => {
      if (kind === 'overlay') parent.postMessage({ cmt: 'dismiss' }, '*');
      else if (kind === 'popup') window.close();
      else document.querySelector('#search').focus();
    },
  };
  mountUI(document, api).then((ui) => {
    browser.runtime.onMessage.addListener((message) => { if (message.type === 'tabs-changed') ui.refresh(); });
  });
}
