const grid = new URL('../index.html', location.href);
const referrer = document.referrer ? new URL(document.referrer) : null;
if (history.length > 1 && referrer?.origin === grid.origin && referrer.pathname === grid.pathname) {
  history.replaceState({ ...history.state, fromPreviewGrid: true }, '');
}

for (const link of document.querySelectorAll('[data-grid-return]')) {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || !history.state?.fromPreviewGrid || history.length < 2) return;
    event.preventDefault();
    history.back();
  });
}
