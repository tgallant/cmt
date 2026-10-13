export function hostOf(tab) {
  try { return new URL(tab.url).hostname; } catch { return ''; }
}

const MATCH = 16;
const CONSECUTIVE = 4;
const BOUNDARY = 8;
const GAP_OPEN = 6;
const GAP_EXTEND = 2;
const MIN_FUZZY_QUALITY = 0.65;

function boundaryBonus(text, at) {
  if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1])) return BOUNDARY;
  return /\p{Ll}/u.test(text[at - 1]) && /\p{Lu}/u.test(text[at]) ? 7 : 0;
}

// Literal scores are 2–3; accepted fuzzy scores are 0.65–1.
// Use the same best-alignment and quality rules for every searchable field.
function fuzzyScore(text, word) {
  const lower = text.toLowerCase();
  let literal = -Infinity;
  for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + 1)) {
    literal = Math.max(literal, 2 + boundaryBonus(text, at) / BOUNDARY);
    if (literal === 3) return literal;
  }
  if (Number.isFinite(literal)) return literal;

  // Cheap presence check before allocating score rows. This greedy pass does
  // not choose the alignment used for scoring.
  let at = -1;
  for (let i = 0; i < word.length; i++) {
    at = lower.indexOf(word[i], at + 1);
    if (at < 0) return -Infinity;
  }
  let previous = new Float64Array(lower.length).fill(-Infinity);
  let current = new Float64Array(lower.length).fill(-Infinity);
  for (let j = 0; j < lower.length; j++) {
    if (lower[j] === word[0]) previous[j] = MATCH + 2 * boundaryBonus(text, j);
  }
  for (let i = 1; i < word.length; i++) {
    current.fill(-Infinity);
    let gap = -Infinity;
    for (let j = i; j < lower.length; j++) {
      // A skipped run costs GAP_OPEN, then GAP_EXTEND for each extra character.
      // Unlike the old matcher, this penalty never stops increasing.
      if (j >= 2) gap = Math.max(gap - GAP_EXTEND, previous[j - 2] - GAP_OPEN);
      if (lower[j] !== word[i]) continue;
      const bonus = boundaryBonus(text, j);
      current[j] = MATCH + Math.max(previous[j - 1] + Math.max(bonus, CONSECUTIVE), gap + bonus);
    }
    [previous, current] = [current, previous];
  }
  let best = -Infinity;
  for (const score of previous) best = Math.max(best, score);
  const strong = word.length * MATCH + 2 * BOUNDARY + (word.length - 1) * CONSECUTIVE;
  const quality = best / strong;
  return quality >= MIN_FUZZY_QUALITY ? Math.min(quality, 1) : -Infinity;
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
    rows.push({ tab, literalWords: scores.filter((score) => score >= 2).length, score: scores.reduce((sum, score) => sum + score, 0) });
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
    else result = b.literalWords - a.literalWords || b.score - a.score;
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
