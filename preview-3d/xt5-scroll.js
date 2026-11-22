export function installWheelScroll(viewer) {
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame = 0;
  let startTime = 0;
  let lastWrite = 0;
  let origin = 0;
  let destination = 0;
  let lastWheel = -Infinity;
  let precision = false;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function advance(now) {
    if (Math.abs(scrollY - lastWrite) > 1) {
      stop();
      return;
    }
    const time = Math.max(0, Math.min(1, (now - startTime) / 770));
    const position = destination - (destination - origin) * (1 - time) ** 4.6;
    const done = Math.abs(destination - position) < 1;
    window.scrollTo({ top: done ? destination : position, behavior: 'instant' });
    lastWrite = scrollY;
    if (done) stop();
    else frame = requestAnimationFrame(advance);
  }

  function wheel(event) {
    if (!enabled.matches || viewer.open || event.defaultPrevented || !event.cancelable
      || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
      stop();
      return;
    }
    const mode = event.deltaMode;
    const delta = event.deltaY;
    if (event.timeStamp - lastWheel > 145) precision = false;
    lastWheel = event.timeStamp;
    // Small or fractional pixel pulses and their trailing momentum stay native.
    precision ||= mode === WheelEvent.DOM_DELTA_PIXEL && (Math.abs(delta) < 38 || !Number.isInteger(delta));
    if (precision) {
      stop();
      return;
    }

    event.preventDefault();
    const unit = mode === WheelEvent.DOM_DELTA_LINE ? 16
      : mode === WheelEvent.DOM_DELTA_PAGE ? innerHeight : 1;
    const current = scrollY;
    const previous = frame && Math.sign(delta) === Math.sign(destination - current) ? destination : current;
    const end = document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight;
    destination = Math.max(0, Math.min(end, previous + delta * unit));
    // Apply the small initial movement separately, then ease out the remaining travel.
    origin = current + (destination - previous) * .09;
    startTime = performance.now();
    window.scrollTo({ top: origin, behavior: 'instant' });
    lastWrite = scrollY;
    if (!frame) frame = requestAnimationFrame(advance);
  }

  window.addEventListener('wheel', wheel, { passive: false });
  for (const name of ['pointerdown', 'keydown', 'pagehide', 'resize']) {
    window.addEventListener(name, stop);
  }
  enabled.addEventListener('change', stop);
}
