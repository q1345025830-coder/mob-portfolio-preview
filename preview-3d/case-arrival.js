(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || performance.getEntriesByType('navigation')[0]?.type !== 'navigate') return;

  const locationKey = location.pathname + location.search + location.hash;
  const returnPath = new URL('index.html', document.currentScript.src).pathname;
  const from = document.referrer ? new URL(document.referrer) : null;
  let intent;
  try {
    intent = JSON.parse(sessionStorage.getItem('mobCaseArrival'));
    sessionStorage.removeItem('mobCaseArrival');
  } catch {
    if (from?.origin === location.origin && from.pathname === returnPath) {
      intent = { destination: locationKey, sentAt: Date.now() };
    }
  }
  if (intent?.destination !== locationKey || Date.now() - intent.sentAt > 45000) return;
  root.dataset.mobArrival = 'holding';
  if (intent.color && CSS.supports('color', intent.color)) root.style.setProperty('--mob-handoff', intent.color);

  function start() {
    const heading = document.querySelector('main h1');
    if (!heading || reduced.matches) {
      delete root.dataset.mobArrival;
      return;
    }
    const hero = document.querySelector('main :is(.opening-view, .hero-figure, .case-screen, article > figure:first-of-type)');
    const title = heading.closest('[data-arrive="title"]') || heading;
    const metadata = document.querySelectorAll('main :is([data-arrive="meta"], .detail-head .discipline, .case-headline, .case-heading .facts)');
    title.dataset.mobPhase = 'title';
    for (const node of metadata) node.dataset.mobPhase = 'meta';
    if (hero) hero.dataset.mobPhase = 'hero';

    // The review layout keeps its main heading below the opening photograph.
    // Present the same title over the color during entry, then leave the original reading order intact.
    let reviewTitle;
    if (hero?.matches('.case-screen') && title.getBoundingClientRect().top >= innerHeight) {
      reviewTitle = document.createElement('div');
      reviewTitle.className = 'mob-review-arrival';
      reviewTitle.setAttribute('aria-hidden', 'true');
      reviewTitle.textContent = heading.textContent;
      hero.insertAdjacentElement('beforebegin', reviewTitle);
      setTimeout(() => reviewTitle.remove(), 940);
    }

    const release = () => {
      if (root.dataset.mobArrival === 'holding') root.dataset.mobArrival = 'playing';
    };
    const deadline = setTimeout(release, 300);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(deadline);
      release();
    }));
  }
  addEventListener('DOMContentLoaded', start, { once: true });
  addEventListener('pageshow', event => {
    if (event.persisted) delete root.dataset.mobArrival;
  });
})();
