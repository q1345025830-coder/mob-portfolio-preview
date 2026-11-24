(() => {
  const catalog = window.mobResearch;
  const root = document.documentElement;
  function projectId() {
    const file = location.pathname.split('/').pop();
    if (location.pathname.includes('/review/')) return location.hash.split('/')[1];
    if (file === 'project.html') return new URLSearchParams(location.search).get('id');
    return catalog.routes[file];
  }
  let pending, loading;
  function prepare(image) {
    clearTimeout(pending);
    loading?.remove();
    if (!image) return;
    if (image.complete && image.naturalWidth) {image.classList.add('mob-loaded');return;}
    image.addEventListener('load',()=>image.classList.add('mob-loaded'),{once:true});
    const clear = () => { clearTimeout(pending); loading?.remove(); };
    pending = setTimeout(() => {
      loading = document.createElement('div');
      loading.className = 'mob-load'; loading.setAttribute('role','status');
      loading.textContent = '正在载入首图…'; document.body.append(loading);
      setTimeout(clear, 2200);
    }, 340);
    image.decode().then(clear,clear);
  }
  let activeHero, upcoming;
  function prepareUpcoming(main, hero) {
    if (activeHero === hero) return;
    activeHero = hero;
    upcoming?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const observe = () => {
      if (activeHero !== hero || !main.isConnected) return;
      upcoming = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const image = entry.target;
          if (!image.complete) image.loading = 'eager';
          observer.unobserve(image);
        }
      }, { rootMargin: '0px 0px 680px 0px' });
      for (const image of main.querySelectorAll('img[loading="lazy"]')) {
        if (image !== hero && !image.complete) upcoming.observe(image);
      }
    };
    if (hero.complete) observe();
    else {
      hero.addEventListener('load', observe, { once:true });
      hero.addEventListener('error', observe, { once:true });
    }
  }


  const moduleRoot = new URL(".", document.currentScript.src);
  const workUrl = new URL("index.html", moduleRoot);
  const reviewPage = location.pathname.includes('/review/');
  const logos = {CADILLAC:['cadillac-crest.svg','cadillac'], VOLVO:['volvo-wordmark.svg#dark','volvo']};
  const referrer = document.referrer && new URL(document.referrer);
  if (referrer && referrer.origin === workUrl.origin && referrer.pathname === workUrl.pathname && history.length > 1) {
    history.replaceState({ ...history.state, mobBrandFromWork: true }, '');
  }

  function installBrandReturn(id, record) {
    const header = document.querySelector(reviewPage ? '.case-tools' : '.case-header, .site-bar, .header');
    if (!header) return;
    const old = header.querySelector('[data-brand-return]');
    if (!id) return;
    if (old?.dataset.brandReturn === id) return;
    const review = window.reviewContent;
    const projects = [...(window.portfolioProjects || []), ...(review?.projects || []), ...(review?.shorts || [])];
    const brand = record?.brand || projects.find(project => project.id === id)?.brand || 'MOB';
    const match = logos[brand];
    const link = document.createElement('a');
    link.className = 'case-brand-return';
    link.dataset.brandReturn = id;
    link.href = workUrl.href;
    link.setAttribute('aria-label', brand + (root.lang === 'en' ? ' · Return to work' : ' · 返回作品'));
    if (match) {
      const logo = document.createElement('img');
      logo.className = 'case-brand-logo case-brand-logo--' + match[1];
      logo.src = new URL('case-media/' + match[0], moduleRoot).href;
      logo.alt = '';
      link.append(logo);
    } else link.textContent = brand;
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (history.state?.mobBrandFromWork || history.state?.mobXt5FromGrid || history.state?.fromMobGrid) {
        event.preventDefault();
        history.back();
      }
    });
    const original = old || header.querySelector(':scope > .brand-logo, :scope > .mark, :scope > .wordmark, :scope > .back');
    if (original) original.replaceWith(link);
    else header.prepend(link);
  }

  let readingHero, motion;
  function installReading(main, hero) {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    motion?.disconnect();
    motion = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('mob-media-awaiting');
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    for (const frame of main.querySelectorAll('.story .media-link, .editorial-story .case-figure, .chapter .case-figure')) {
      if (frame.contains(hero) || frame.closest('.gallery-grid,.story-study') || frame.getBoundingClientRect().top <= innerHeight) continue;
      frame.classList.add('mob-media-awaiting');
      motion.observe(frame);
    }
  }

  function enrich() {
    const id = projectId(), record = catalog.cases[id];
    root.classList.toggle('mob-themed', Boolean(record));
    root.dataset.mobProject=id||'';
    installBrandReturn(id, record);
    if (!id) return;
    if (record) root.style.setProperty('--mob-tone',record.tone);
    const main = document.querySelector('main');
    if (!main) return;
    const image = main.querySelector('img');
    if (image) {
      if (!image.classList.contains('mob-loaded')) prepare(image);
      prepareUpcoming(main, image);
      if (readingHero !== image) {
        readingHero = image;
        installReading(main, image);
        const navigated = performance.getEntriesByType("navigation")[0]?.type === "navigate";
        if (navigated && !root.dataset.caseEnter && !reviewPage) root.dataset.mobEntry = "ready";
      }
    }

  }
  function offerRetry(e) {
    const im=e.target;
    if(!(im instanceof HTMLImageElement) || !im.currentSrc) return;
    const holder=im.closest('figure') || im.parentElement;if(!holder || holder.querySelector('.mob-retry'))return;
    const retry=document.createElement('button');retry.className='mob-retry';retry.textContent='重新载入图片';
    retry.onclick=()=>{const u=new URL(im.currentSrc);u.searchParams.set('retry',Date.now());im.removeAttribute('srcset');im.src=u;retry.remove()};holder.append(retry);
  }
  document.addEventListener('error',offerRetry,true);
  for(const im of document.querySelectorAll('main img[src]')) if(im.complete && !im.naturalWidth) offerRetry({target:im});
  if (reviewPage) new MutationObserver(enrich).observe(document.querySelector('main'), { childList: true });
  if (projectId() || reviewPage) import(new URL('xt5-scroll.js', moduleRoot)).then(({ installWheelScroll }) => {
    installWheelScroll(document.querySelector('dialog'), () => Boolean(projectId()));
  });
  enrich();
})();
