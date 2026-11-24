import { clamp, createScene, layoutFor, requestCover, viewForTile } from './surface.js';

const stage = document.querySelector('.stage');
const links = [...stage.querySelectorAll('.project')];
const projectIds = links.map(link => link.dataset.project);
const work = document.querySelector('#work');
const grid = document.querySelector('#work-grid');
const list = document.querySelector('#work-list');
const resume = document.querySelector('#resume');
const scroller = document.querySelector('main');
const viewSwitch = document.querySelector('.view-switch');
const sectionButtons = [...document.querySelectorAll('[data-section]')];
const viewButtons = [...viewSwitch.querySelectorAll('[data-view]')];
const reset = document.querySelector('.reset');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const stateKey = 'mobPreviewGrid';
const view = { x: 0, y: 0, pull: 0, driftX: 0, driftY: 0 };
const velocity = { x: 0, y: 0 };
const smoothing = (rate, seconds) => 1 - Math.exp(-rate * seconds);
let layout = layoutFor(innerWidth, innerHeight, projectIds);
let preferredKey;
let scene, press, mouse, hovered, returned, leaving;
let ready = false, gridStarted = false, suppressClick = false, restoring = false;
let frame = 0, lastFrame = 0, exitTimer = 0;
let section = 'work', workView = 'grid';
const scrollOffsets = { grid: 0, list: 0, resume: 0 };
const visibleMode = () => section === 'resume' ? 'resume' : workView;
const gridVisible = () => visibleMode() === 'grid';
history.scrollRestoration = 'manual';

const projectRows = list.querySelector('.project-rows');
const listLinks = new Map();

function label(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function projectArrow() {
  const arrow = label('row-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  return arrow;
}

for (const link of links) {
  const title = link.querySelector('.name').textContent;
  const brand = link.querySelector('.brand').textContent;
  const kind = link.querySelector('.kind').textContent;
  const year = link.querySelector('.year').textContent;
  const id = link.dataset.project;
  const row = document.createElement('a');
  row.className = 'project-row';
  row.href = link.href;
  row.dataset.project = id;
  if (link.dataset.caseTheme) row.dataset.caseTheme = link.dataset.caseTheme;
  row.append(label('row-name', title), label('row-brand', brand), label('row-kind', kind), label('row-year', year), projectArrow());
  const item = document.createElement('li');
  item.append(row);
  projectRows.append(item);
  listLinks.set(id, row);
}
list.querySelector('.project-count').textContent = links.length + ' 项';

function updatePanels() {
  const isGrid = gridVisible();
  work.hidden = section !== 'work';
  grid.hidden = !isGrid;
  list.hidden = visibleMode() !== 'list';
  resume.hidden = section !== 'resume';
  scroller.tabIndex = section === 'resume' ? 0 : -1;
  viewSwitch.hidden = section === 'resume';
  document.title = section === 'resume' ? '黄彬 · 简历 · MOB' : '作品空间 · MOB';
  for (const button of sectionButtons) button.setAttribute('aria-pressed', String(button.dataset.section === section));
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === workView));
  if (isGrid && !gridStarted) startGrid();
  document.body.classList.toggle('is-spatial', isGrid && ready);
  if (isGrid) refreshLayout();
}

function saveEntry(projectId, updateHash = false) {
  scrollOffsets[visibleMode()] = scroller.scrollTop;
  const url = new URL(location.href);
  if (updateHash) url.hash = section === 'resume' ? 'resume' : '';
  history.replaceState({
    ...history.state,
    [stateKey]: { x: view.x, y: view.y, projectId, cell:preferredKey, gridSize: links.length, workView, scrollOffsets: { ...scrollOffsets } },
  }, '', url);
}

function switchMode(nextSection, nextView, updateHash = true) {
  if (leaving || (nextSection === section && nextView === workView)) return;
  scrollOffsets[visibleMode()] = scroller.scrollTop;
  endPress(null, false);
  stopGlide();
  mouse = null;
  view.pull = view.driftX = view.driftY = 0;
  clearReturned();
  section = nextSection;
  workView = nextView;
  updatePanels();
  scroller.scrollTop = scrollOffsets[visibleMode()];
  saveEntry(null, updateHash);
}

for (const button of sectionButtons) {
  button.addEventListener('click', () => switchMode(button.dataset.section, workView));
}
for (const button of viewButtons) {
  button.addEventListener('click', () => switchMode('work', button.dataset.view));
}
window.addEventListener('hashchange', () => switchMode(location.hash === '#resume' ? 'resume' : 'work', workView, false));

function plainClick(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
list.addEventListener('click', event => {
  const link = event.target.closest('a[data-project]');
  if (!link || !plainClick(event)) return;
  if (leaving) {
    event.preventDefault();
    return;
  }
  saveEntry(link.dataset.project);
  if (!link.dataset.caseTheme || reduced.matches) return;
  event.preventDefault();
  exitToProject(link);
});

function stopGlide() {
  velocity.x = velocity.y = 0;
}

function relativePoint(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  return { x: clientX - rect.left - stage.clientLeft, y: clientY - rect.top - stage.clientTop };
}

function linkAt(clientX, clientY) {
  const point = relativePoint(clientX, clientY);
  if (point.x < 0 || point.y < 0 || point.x >= layout.width || point.y >= layout.height) return null;
  return scene?.hit(point.x, point.y) || null;
}

function highlight(link) {
  if (hovered !== link) {
    hovered?.classList.remove('is-active');
    hovered = link;
    hovered?.classList.add('is-active');
  }
}

function tick(now) {
  frame = 0;
  const seconds = lastFrame ? Math.min(.045, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;
  let moving = false;
  if (!press && !leaving && !reduced.matches) {
    const fraction = smoothing(4.3, seconds);
    const next = { x: view.x + velocity.x * fraction / 4.3, y: view.y + velocity.y * fraction / 4.3 };

    for (const axis of ['x', 'y']) {
      view[axis] = next[axis];
      velocity[axis] = velocity[axis] * (1 - fraction);
      if (Math.abs(velocity[axis]) < .01) velocity[axis] = 0;
      moving ||= velocity[axis] !== 0;
    }
  }

  const allowDrift = !press && !leaving && mouse && !reduced.matches;
  const target = allowDrift ? relativePoint(mouse.x, mouse.y) : null;
  const goals = {
    pull: reduced.matches ? 0 : press?.dragging ? 1 : press ? view.pull : 0,
    driftX: target ? -clamp((target.x / layout.width - .5) * 44, -22, 22) : press ? view.driftX : 0,
    driftY: target ? -clamp((target.y / layout.height - .5) * 32, -16, 16) : press ? view.driftY : 0,
  };
  for (const property of ['pull', 'driftX', 'driftY']) {
    const delta = goals[property] - view[property];
    const epsilon = property === 'pull' ? .002 : .075;
    view[property] = reduced.matches || Math.abs(delta) < epsilon
      ? goals[property]
      : view[property] + delta * smoothing(12, seconds);
    moving ||= view[property] !== goals[property];
  }

  const hover = !press && !leaving && mouse ? linkAt(mouse.x, mouse.y) : null;
  const focused = document.activeElement?.matches('.project:focus-visible') ? document.activeElement : null;
  highlight(leaving || hover || focused || returned || null);
  scene?.draw(layout, view, press ? null : hovered, hover === hovered && mouse ? relativePoint(mouse.x,mouse.y) : null, preferredKey);
  // A stationary pointer can be crossed by a moving card even after the last animation step.
  if (moving || (mouse && !press && !leaving && hover !== linkAt(mouse.x, mouse.y))) redraw();
  else lastFrame = 0;
}

function redraw() {
  if (ready && gridVisible() && !frame) frame = requestAnimationFrame(tick);
}

function refreshLayout() {
  if (!gridVisible() || !stage.clientWidth || !stage.clientHeight) return;
  if (layout.width !== stage.clientWidth || layout.height !== stage.clientHeight) {
    const wasHome = view.x === layout.homeX && view.y === layout.homeY;
    layout = layoutFor(stage.clientWidth, stage.clientHeight, projectIds);
    if (press) endPress(null, false);
    if (wasHome) Object.assign(view, { x: layout.homeX, y: layout.homeY });
  }
  redraw();
}

function fallback() {
  ready = false;
  cancelAnimationFrame(frame);
  frame = lastFrame = 0;
  stopGlide();
  press = mouse = null;
  highlight(null);
  stage.classList.remove('is-ready', 'is-dragging');
  document.body.classList.remove('is-spatial');
  scene?.destroy();
  scene = null;
  for (const link of links) {
    requestCover(link.querySelector('.artwork img'), '(max-width: 680px) calc(100vw - 64px), min(45vw, 510px)', 'auto', 'lazy');
  }
}

function clearReturned() {
  returned?.classList.remove('is-returned');
  returned = null;
}

function restoreEntry(resetOnReload = false) {
  clearTimeout(exitTimer);
  leaving = null;
  delete document.body.dataset.caseTheme;
  delete document.body.dataset.caseTransition;
  stage.classList.remove('is-leaving', 'is-case-leaving', 'is-dragging');
  clearReturned();
  stopGlide();
  press = mouse = null;
  suppressClick = false;
  view.pull = view.driftX = view.driftY = 0;
  const resetGrid = resetOnReload && !location.hash;
  const state = resetGrid ? null : history.state?.[stateKey];
  preferredKey = state?.cell;
  section = location.hash === '#resume' ? 'resume' : 'work';
  workView = state?.workView === 'list' ? 'list' : 'grid';
  for (const mode of Object.keys(scrollOffsets)) {
    const offset = state?.scrollOffsets?.[mode];
    scrollOffsets[mode] = Number.isFinite(offset) ? offset : 0;
  }
  updatePanels();
  const x = Number.isFinite(state?.x) ? state.x : layout.homeX;
  const y = Number.isFinite(state?.y) ? state.y : layout.homeY;
  const gridLink = links.find(link => link.dataset.project === state?.projectId);
  const mode = visibleMode();
  returned = (mode === 'resume' ? null
    : mode === 'list' ? listLinks.get(state?.projectId) : gridLink) || null;
  const position = gridLink && state.gridSize !== links.length
    ? viewForTile(layout, gridLink.dataset.project)
    : { x, y };
  Object.assign(view, position);
  scroller.scrollTop = scrollOffsets[mode];
  if (resetGrid) saveEntry(null);
  if (returned) {
    restoring = true;
    returned.classList.add('is-returned');
    returned.focus({ preventScroll: true });
    restoring = false;
  }
  redraw();
}

function sample(event) {
  return { x: event.clientX, y: event.clientY, time: performance.now() };
}

stage.addEventListener('pointerdown', event => {
  if (!ready || press || leaving || !event.isPrimary || event.button !== 0) return;
  // Catching a moving surface is a pause gesture. A subsequent press can open a card.
  suppressClick = Math.hypot(velocity.x, velocity.y) > .12;
  clearReturned();
  stopGlide();
  const start = sample(event);
  press = { id: event.pointerId, start, x: view.x, y: view.y, samples: [start], dragging: false };
  redraw();
});

window.addEventListener('pointermove', event => {
  if (!ready || !gridVisible() || leaving) return;
  if (event.pointerType !== 'touch' && stage.contains(event.target)) {
    mouse = { x: event.clientX, y: event.clientY };
  }
  if (press?.id === event.pointerId) {
    const point = sample(event);
    const dx = point.x - press.start.x, dy = point.y - press.start.y;
    if (!press.dragging && Math.hypot(dx, dy) > (event.pointerType === 'touch' ? 10 : 7)) {
      press.dragging = true;
      stage.classList.add('is-dragging');
      stage.setPointerCapture(event.pointerId);
    }
    if (press.dragging) {
      view.x = press.x - dx / layout.stepX;
      view.y = press.y - dy / layout.stepY;
    }
    press.samples.push(point);
    // Keep the last point just outside the velocity window for interpolation at its edge.
    while (press.samples.length > 2 && point.time - press.samples[1].time > 105) press.samples.shift();
  }
  redraw();
});

stage.addEventListener('pointerleave', () => {
  mouse = null;
  redraw();
});
stage.addEventListener('dragstart', event => {
  if (ready) event.preventDefault();
});

function endPress(event, release) {
  if (!press || (event && event.pointerId !== press.id)) return;
  const drag = press;
  press = null;
  if (stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
  stage.classList.remove('is-dragging');
  if (drag.dragging) {
    suppressClick = true;
    if (release && !reduced.matches) {
      const end = sample(event);
      // Holding still before release cancels the launch even after a fast earlier move.
      const last = drag.samples.at(-1);
      if (end.time - last.time <= 105) {
        const first = drag.samples.find(point => end.time - point.time <= 105) || last;
        const seconds = Math.max(.025, (end.time - first.time) / 1000);
        velocity.x = clamp((first.x - end.x) / layout.stepX / seconds, -4, 4);
        velocity.y = clamp((first.y - end.y) / layout.stepY / seconds, -4, 4);
      }
    }
  }
  redraw();
}

window.addEventListener('pointerup', event => {
  const tap = event.pointerType === 'touch' && press?.id === event.pointerId
    && !press.dragging && !suppressClick && !leaving && performance.now() - press.start.time < 500;
  const link = tap ? linkAt(event.clientX, event.clientY) : null;
  const startedOnLink = link && linkAt(press.start.x, press.start.y) === link;
  endPress(event, true);
  if (!startedOnLink) return;
  const point = relativePoint(event.clientX,event.clientY);
  preferredKey = scene.cellAt(point.x,point.y);

  // The browser may withhold a compatibility click after a touch drag.
  // Open only when this new press starts and ends on the same projected card.
  saveEntry(link.dataset.project);
  if (reduced.matches) {
    leaving = link;
    location.assign(link.href);
  } else {
    exitToProject(link);
  }
});
window.addEventListener('pointercancel', event => endPress(event, false));
stage.addEventListener('lostpointercapture', event => {
  if (event.target === stage) endPress(event, false);
});
window.addEventListener('blur', () => endPress(null, false));

stage.addEventListener('focusin', event => {
  const link = event.target.closest('.project');
  if (!link || restoring || !ready || press || !link.matches(':focus-visible')) return;
  clearReturned();
  stopGlide();
  preferredKey = null;
  Object.assign(view, viewForTile(layout, link.dataset.project, view));
  redraw();
});
stage.addEventListener('focusout', redraw);

stage.addEventListener('keydown', event => {
  if (!ready || press || leaving || event.metaKey || event.ctrlKey || event.altKey) return;
  const step = { ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, -.15], ArrowDown: [0, .15] }[event.key];
  if (!step) return;
  event.preventDefault();
  clearReturned();
  stopGlide();
  view.x += step[0];
  view.y += step[1];
  redraw();
});

stage.addEventListener('click', event => {
  const fromPointer = event.detail !== 0;
  if (leaving || (fromPointer && suppressClick)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  const anchor = event.target.closest('.project');
  const link = ready && fromPointer ? linkAt(event.clientX, event.clientY) : anchor;
  if (!link) {
    if (anchor) event.preventDefault();
    return;
  }
  if (ready && fromPointer) {
    const point=relativePoint(event.clientX,event.clientY);
    preferredKey=scene.cellAt(point.x,point.y);
  }
  saveEntry(link.dataset.project);
  if (reduced.matches) {
    if (ready) { event.preventDefault(); location.assign(link.href); }
    return;
  }
  event.preventDefault();
  exitToProject(link);
});

function exitToProject(link) {
  leaving = link;
  stopGlide();
  const { caseTheme } = link.dataset;
  const entersCase = Boolean(caseTheme) || link.hasAttribute('data-case-transition');
  if (caseTheme) document.body.dataset.caseTheme = caseTheme;
  if (entersCase) document.body.dataset.caseTransition = "active";
  if (gridVisible()) {
    stage.classList.add('is-leaving');
    stage.classList.toggle('is-case-leaving', entersCase);
    redraw();
  }
  exitTimer = setTimeout(() => location.assign(link.href), entersCase ? 260 : 175);
}

reset.addEventListener('click', () => {
  if (leaving) return;
  endPress(null, false);
  clearReturned();
  stopGlide();
  view.x = layout.homeX;
  view.y = layout.homeY;
  view.pull = view.driftX = view.driftY = 0;
  redraw();
});
reduced.addEventListener('change', () => {
  if (reduced.matches) {
    stopGlide();
    view.pull = view.driftX = view.driftY = 0;
  }
  redraw();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) restoreEntry();
});
window.addEventListener('pagehide', () => saveEntry(history.state?.[stateKey]?.projectId));

function startGrid() {
  gridStarted = true;
  scene = createScene(stage, links, { onRedraw: redraw, onFallback: fallback });
  if (scene) {
    ready = true;
    stage.classList.add('is-ready');
  } else {
    fallback();
  }
}
restoreEntry(performance.getEntriesByType('navigation')[0]?.type === 'reload');
new ResizeObserver(refreshLayout).observe(stage);
