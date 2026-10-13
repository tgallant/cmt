(async () => {
  if (globalThis.cmtDismiss) { globalThis.cmtDismiss(); return; }
  const context = await browser.runtime.sendMessage({ type: 'overlay-context' });
  if (!context) return;
  const priorFocus = document.activeElement;
  const host = document.createElement('div');
  host.id = 'cmt-overlay';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;box-sizing:border-box;';
  const frame = document.createElement('iframe');
  frame.src = `${browser.runtime.getURL('overlay.html')}?token=${encodeURIComponent(context.token)}`;
  frame.title = 'CMT tab palette';
  frame.style.cssText = 'width:min(980px,100%);height:90vh;border:1px solid #606b75;border-radius:6px;box-shadow:0 20px 80px #000;background:#101417;';
  function dismiss() {
    host.remove();
    window.removeEventListener('message', onMessage);
    window.removeEventListener('keydown', onKey, true);
    delete globalThis.cmtDismiss;
    browser.runtime.sendMessage({ type: 'end-overlay', token: context.token }).catch(() => {});
    if (priorFocus?.isConnected) priorFocus.focus();
  }
  function onMessage(event) {
    if (event.source === frame.contentWindow && event.origin === new URL(frame.src).origin && event.data?.cmt === 'dismiss') dismiss();
  }
  function onKey(event) { if (event.key === 'Escape') { event.preventDefault(); dismiss(); } }
  globalThis.cmtDismiss = dismiss;
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dismiss(); });
  backdrop.append(frame);
  shadow.append(backdrop);
  document.documentElement.append(host);
  frame.addEventListener('load', () => frame.focus());
})();
