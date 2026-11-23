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
  function enrich() {
    const id = projectId(), record = catalog.cases[id];
    root.classList.toggle('mob-themed', Boolean(record));
    root.dataset.mobProject=id||'';
    if (!record) return;
    root.style.setProperty('--mob-tone',record.tone);
    const main = document.querySelector('main');
    if (!main) return;
    const image = main.querySelector('img');
    if (image && !image.classList.contains('mob-loaded')) prepare(image);

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
  if(location.pathname.includes('/review/'))new MutationObserver(enrich).observe(document.querySelector('main'),{childList:true});
  enrich();
})();
