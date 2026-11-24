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

  let started = false;
  let bridge;
  function showBridge() {
    if (!intent.title || !document.body || bridge) return;
    bridge = document.createElement('div');
    bridge.className = 'mob-arrival-bridge';
    bridge.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.className = 'mob-handoff-title';
    title.textContent = intent.title;
    bridge.append(title);
    document.body.prepend(bridge);
  }

  function releaseHero(hero) {
    const image = hero.querySelector('img');
    if (!image) return;
    hero.dataset.mobHero = 'waiting';
    const reveal = () => { hero.dataset.mobHero = 'ready'; };
    const decode = () => image.decode().then(reveal, reveal);
    if (image.complete) {
      if (image.naturalWidth) decode();
      else if (image.currentSrc) reveal();
    }
    image.addEventListener('load', decode, { once: true });
    image.addEventListener('error', reveal, { once: true });
  }

  function start(final = false) {
    if (started) return;
    showBridge();
    const heading = document.querySelector('main h1');
    const hero = document.querySelector('main :is(.opening-view, .hero-figure, .case-screen, article > figure:first-of-type)');
    if (!final && (!heading || !hero?.querySelector('img'))) return;
    started = true;
    observer.disconnect();
    if (!heading || reduced.matches) {
      delete root.dataset.mobArrival;
      bridge?.remove();
      return;
    }

    // This entry owns the handoff. Avoid a second, browser-managed transition on return.
    const optOut = document.createElement('style');
    optOut.textContent = '@view-transition { navigation: none; }';
    document.head.append(optOut);

    const title = heading.closest('[data-arrive="title"]') || heading;
    const metadata = document.querySelectorAll('main :is([data-arrive="meta"], .detail-head .discipline, .case-headline, .case-heading .facts)');
    title.dataset.mobPhase = 'title';
    for (const node of metadata) node.dataset.mobPhase = 'meta';
    if (hero) {
      hero.dataset.mobPhase = 'hero';
      releaseHero(hero);
    }

    // Some review cases retain the heading below a full opening photograph.
    const review = hero?.matches('.case-screen') && title.getBoundingClientRect().top >= innerHeight;
    const release = () => {
      if (root.dataset.mobArrival !== 'holding') return;
      root.dataset.mobArrival = 'playing';
      if (bridge) {
        bridge.classList.add(review ? 'is-review' : 'is-clearing');
        if (review) setTimeout(() => bridge.classList.add('is-clearing'), 330);
        setTimeout(() => bridge.remove(), review ? 700 : 420);
      }
    };
    const deadline = setTimeout(release, 240);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(deadline);
      release();
    }));
  }

  const observer = new MutationObserver(() => start());
  observer.observe(root, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', () => start(true), { once: true });
  const clear = () => {
    delete root.dataset.mobArrival;
    bridge?.remove();
  };
  reduced.addEventListener('change', () => { if (reduced.matches) clear(); });
  addEventListener('pageshow', event => { if (event.persisted) clear(); });
})();
