export function hostOf(tab) {
  try { return new URL(tab.url).hostname; } catch { return ''; }
}

// A subsequence matcher: reward adjacent letters and word boundaries.
function fuzzyScore(text, word) {
  text = text.toLowerCase();
  let at = -1;
  let score = 0;
  for (const letter of word) {
    const next = text.indexOf(letter, at + 1);
    if (next < 0) return -Infinity;
    score += 10 + (next === at + 1 ? 8 : 0) + (next === 0 || /[\s/._-]/.test(text[next - 1]) ? 5 : 0);
    score -= Math.min(next - at - 1, 10);
    at = next;
  }
  return score;
}

function groups(tabs) {
  const result = new Map();
  for (const tab of tabs) {
    if (!tab.url) continue;
    const group = result.get(tab.url) || [];
    group.push(tab);
    result.set(tab.url, group);
  }
  return result;
}

export function duplicateExtras(tabs) {
  const extras = new Set();
  for (const group of groups(tabs).values()) {
    group.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(!!b.active) - Number(!!a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0) || a.id - b.id);
    for (const tab of group.slice(1)) extras.add(tab.id);
  }
  return tabs.filter((tab) => extras.has(tab.id)).map((tab) => tab.id);
}

export function queryTabs(tabs, { search = '', filters = {}, sort = 'relevance', mode = 'all', now = Date.now() } = {}) {
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const counts = new Map([...groups(tabs)].map(([url, group]) => [url, group.length]));
  const rows = [];
  for (const tab of tabs) {
    if (mode === 'pinned' && !tab.pinned) continue;
    if (filters.windowId && tab.windowId !== Number(filters.windowId)) continue;
    if (filters.host && !hostOf(tab).toLowerCase().includes(filters.host.toLowerCase())) continue;
    if (['pinned', 'discarded', 'audible'].some((key) => filters[key] && !tab[key])) continue;
    if (filters.duplicate && counts.get(tab.url) < 2) continue;
    if (filters.duplicate && !counts.has(tab.url)) continue;
    if (filters.olderDays && (!tab.lastAccessed || now - tab.lastAccessed < Number(filters.olderDays) * 86400000)) continue;
    const scores = words.map((word) => Math.max(fuzzyScore(tab.title || '', word), fuzzyScore(tab.url || '', word)));
    if (scores.some((score) => !Number.isFinite(score))) continue;
    rows.push({ tab, score: scores.reduce((sum, score) => sum + score, 0) });
  }
  const order = mode === 'recent' && sort === 'relevance' ? 'recent' : sort;
  rows.sort((a, b) => {
    const x = a.tab;
    const y = b.tab;
    let result = 0;
    if (order === 'recent') result = (y.lastAccessed || 0) - (x.lastAccessed || 0);
    else if (order === 'oldest') result = (x.lastAccessed || Infinity) - (y.lastAccessed || Infinity);
    else if (order === 'title') result = (x.title || '').localeCompare(y.title || '');
    else if (order === 'host') result = hostOf(x).localeCompare(hostOf(y));
    else if (order === 'order') result = x.windowId - y.windowId || x.index - y.index;
    else result = b.score - a.score;
    return result || a.tab.id - b.tab.id;
  });
  return rows.map(({ tab }) => tab);
}

export function selectRange(selection, ids, anchor, target) {
  const a = ids.indexOf(anchor);
  const b = ids.indexOf(target);
  const result = new Set(selection);
  if (a < 0 || b < 0) return result.add(target);
  for (const id of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) result.add(id);
  return result;
}
