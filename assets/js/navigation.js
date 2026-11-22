/* Cross-document opt-in must exist before the destination's first render. */
(() => {
  if (!/^https?:$/.test(location.protocol) || !document.startViewTransition) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const style = document.createElement('style');
  const update = () => { style.textContent = '@view-transition{navigation:'+(preference.matches?'none':'auto')+'}'; };
  update();document.head.append(style);preference.addEventListener('change',update);
})();
