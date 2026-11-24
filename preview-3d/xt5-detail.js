import { installWheelScroll } from './xt5-scroll.js';

const stateKey = 'mobXt5FromGrid';
const gridUrl = new URL('index.html', import.meta.url);
const referrer = document.referrer ? new URL(document.referrer) : null;
if (history.length > 1 && referrer?.origin === gridUrl.origin && referrer.pathname === gridUrl.pathname) {
  history.replaceState({ ...history.state, [stateKey]: true }, '');
}

const root = document.documentElement;
if (root.dataset.caseEnter === 'waiting') {
  const begin = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (root.dataset.caseEnter === 'waiting') root.dataset.caseEnter = 'ready';
  }));
  const deadline = setTimeout(begin, 420);
  const hero = document.querySelector('.hero-figure img');
  hero.decode().catch(() => {}).then(() => {
    clearTimeout(deadline);
    begin();
  });
}

function plainClick(event) {
  return !event.defaultPrevented && event.button === 0
    && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

for (const link of document.querySelectorAll('[data-return-grid]')) {
  link.addEventListener('click', event => {
    if (!plainClick(event) || !history.state?.[stateKey] || history.length <= 1) return;
    event.preventDefault();
    history.back();
  });
}

for (const link of document.querySelectorAll('a[href^="#"]')) {
  const target = document.getElementById(link.hash.slice(1));
  link.addEventListener('click', event => {
    if (!target || !plainClick(event)) return;
    event.preventDefault();
    // Keep fragment jumps in the current detail entry so Back still reaches the grid.
    history.replaceState(history.state, '', link.hash);
    target.scrollIntoView();
    target.focus({ preventScroll: true });
  });
}

const viewer = document.querySelector('#viewer');
installWheelScroll(viewer);
const gallery = [...document.querySelectorAll('.gallery-item')];
const picture = viewer.querySelector('.viewer-picture');
const image = picture.querySelector('img');
const caption = viewer.querySelector('#viewer-caption');
const count = viewer.querySelector('.viewer-count');
const zoom = viewer.querySelector('[data-zoom]');
let current = 0;
let trigger;

function setZoom(zoomed) {
  picture.classList.toggle('is-zoomed', zoomed);
  zoom.setAttribute('aria-pressed', String(zoomed));
  zoom.textContent = zoomed ? '还原' : '放大';
  picture.scrollTo({
    left: zoomed ? (picture.scrollWidth - picture.clientWidth) / 2 : 0,
    top: zoomed ? (picture.scrollHeight - picture.clientHeight) / 2 : 0,
    behavior: 'instant',
  });
}

function showImage(index) {
  current = (index + gallery.length) % gallery.length;
  const item = gallery[current];
  caption.textContent = item.querySelector('.gallery-caption').textContent;
  count.textContent = String(current + 1).padStart(2, '0') + ' / ' + gallery.length;
  image.alt = item.querySelector('img').alt;
  image.src = item.href;
  setZoom(false);
}

document.addEventListener('click', event => {
  const link = event.target.closest('[data-view-image]');
  if (!link || !plainClick(event) || typeof viewer.showModal !== 'function') return;
  event.preventDefault();
  trigger = link;
  showImage(Number(link.dataset.viewImage));
  viewer.showModal();
});

viewer.querySelector('[data-close-viewer]').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () => {
  image.removeAttribute('src');
  trigger?.focus({ preventScroll: true });
  trigger = null;
});
for (const button of viewer.querySelectorAll('[data-image-step]')) {
  button.addEventListener('click', () => showImage(current + Number(button.dataset.imageStep)));
}
zoom.addEventListener('click', () => setZoom(!picture.classList.contains('is-zoomed')));
viewer.addEventListener('keydown', event => {
  if (picture.classList.contains('is-zoomed')) return;
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  showImage(current + step);
});

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('has-entered');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  for (const copy of document.querySelectorAll('[data-copy-in]')) {
    copy.classList.add('observe-copy');
    reveal.observe(copy);
  }
}

