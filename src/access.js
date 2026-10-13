export function createAccess(base) {
  const tokens = new Map();
  function issue(tabId) {
    const token = crypto.randomUUID();
    tokens.set(tabId, token);
    return token;
  }
  function revoke(tabId) { tokens.delete(tabId); }
  function context(tabId) {
    const token = tokens.get(tabId);
    return token ? { token } : null;
  }
  function allowed(sender) {
    if (!sender.url?.startsWith(base)) return false;
    const url = new URL(sender.url);
    if (url.pathname === '/manager.html' || url.pathname === '/popup.html') return true;
    return url.pathname === '/overlay.html' && !!tokens.get(sender.tab?.id) && url.searchParams.get('token') === tokens.get(sender.tab?.id);
  }
  return { issue, revoke, context, allowed };
}
