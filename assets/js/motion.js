/* Motion System V1 — progressive enhancement; content remains usable without it. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isProject = document.body.dataset.page === 'project';
  const en = document.documentElement.lang === 'en';
  const gallery = document.querySelector('.gallery');
  document.querySelectorAll('.project-visual .image-wrap').forEach(wrap => {
    const corners = document.createElement('span');
    corners.className = 'corners';
    corners.setAttribute('aria-hidden', 'true');
    wrap.append(corners);
  });
  // Navigation stays native; supporting browsers may use cross-document view transitions.
  document.body.classList.add('motion-enter');
  addEventListener('pageshow', () => document.body.classList.add('motion-enter'));
  if (!isProject || !gallery) return;
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span></span>';
  document.body.prepend(bar);
  let scheduled = false;
  function updateReading() {
    scheduled = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.firstElementChild.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
  }
  function queueReading() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateReading); }
  }
  addEventListener('scroll', queueReading, { passive: true });
  addEventListener('resize', queueReading, { passive: true });
  updateReading();

  const figures = [...gallery.querySelectorAll('.figure')];
  const status = document.createElement('div');
  status.className = 'gallery-status';
  status.innerHTML = `<span class="gallery-count" aria-live="polite"></span><span class="gallery-track" aria-hidden="true"><span></span></span><span>${en ? 'IMAGES' : '项目图片'}</span>`;
  gallery.before(status);
  function setGalleryIndex(index) {
    status.querySelector('.gallery-count').textContent = `${String(index+1).padStart(2,'0')} / ${String(figures.length).padStart(2,'0')}`;
    status.querySelector('.gallery-track span').style.transform = `scaleX(${(index + 1) / figures.length})`;
  }
  setGalleryIndex(0);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    if (!reduced.matches) figures.forEach(f => { f.classList.add('reveal-ready'); observer.observe(f); });
    reduced.addEventListener('change', e => {
      if (e.matches) figures.forEach(f => f.classList.add('is-visible'));
    });
  }
  let indexScheduled = false;
  function syncGalleryIndex() {
    indexScheduled = false;
    const target = innerHeight * .45;
    let closest = 0, distance = Infinity;
    figures.forEach((figure, index) => {
      const rect = figure.getBoundingClientRect();
      const d = target < rect.top ? rect.top-target : target > rect.bottom ? target-rect.bottom : 0;
      if (d < distance) { distance = d; closest = index; }
    });
    setGalleryIndex(closest);
  }
  function queueIndex() {
    if (!indexScheduled) { indexScheduled = true; requestAnimationFrame(syncGalleryIndex); }
  }
  addEventListener('scroll', queueIndex, {passive:true});
  addEventListener('resize', queueIndex, {passive:true});
  // Only horizontal, intentional swipes move between vertically arranged images.
  let start = null;
  gallery.addEventListener('touchstart', e => {
    if (e.touches.length === 1) start = {x:e.touches[0].clientX,y:e.touches[0].clientY, figure:e.target.closest('.figure')};
    else start = null;
  }, {passive:true});
  gallery.addEventListener('touchend', e => {
    if (!start || !start.figure || e.changedTouches.length !== 1) { start = null; return; }
    const dx=e.changedTouches[0].clientX-start.x, dy=e.changedTouches[0].clientY-start.y;
    if (Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5) {
      const next=Math.max(0,Math.min(figures.length-1,figures.indexOf(start.figure)+(dx<0?1:-1)));
      figures[next].scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'center'});
      setGalleryIndex(next);
    }
    start=null;
  }, {passive:true});
  gallery.addEventListener('touchcancel', () => { start=null; }, {passive:true});

  const facts = document.querySelector('.project-facts');
  const details = document.createElement('details');
  details.className = 'project-details';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = en ? 'PROJECT DETAILS' : '项目信息';
  facts.before(details);
  details.append(summary, facts);
  details.addEventListener('toggle', queueReading);
})();
