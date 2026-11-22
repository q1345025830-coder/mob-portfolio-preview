(() => {
  const base = new URL('.', document.currentScript.src);
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
    if (!main || main.querySelector('.mob-references')) return;
    const target = main.querySelector('.chapter, .editorial-story, .story, .image-section') || main.querySelector('.opening-view, .case-heading');
    if (!target) return;
    prepare(main.querySelector('img'));
    const section = document.createElement('section');
    section.className = 'mob-references';
    const heading = document.createElement('h2');heading.textContent = '视觉参考';section.append(heading);
    const group = document.createElement('div'); group.className='mob-reference-grid';section.append(group);
    for(const [asset, caption, author, url, license] of record.references){
      const figure=document.createElement('figure'), image=document.createElement('img');
      image.src=new URL('research/'+asset+'.webp',base);image.loading='lazy';image.alt=caption;image.width=720;image.height=450;
      const text=document.createElement('figcaption');text.textContent=caption;
      const source=document.createElement('a');source.href='https://polyhaven.com/a/'+asset;source.textContent='Poly Haven · '+asset.replaceAll('_',' ')+' · CC0';
      if(author){source.href=url;source.textContent=author+' · '+license;}
      text.append(source);
      if(license==='CC BY-SA 2.0'){const terms=document.createElement('a');terms.href='https://creativecommons.org/licenses/by-sa/2.0/';terms.textContent='同许可缩放转码';text.append(terms);}figure.append(image,text);group.append(figure);
    }
    target.after(section);
  }
  document.addEventListener('error', e => {
    const im=e.target;
    if(!(im instanceof HTMLImageElement) || !im.currentSrc || im.parentElement?.parentElement?.querySelector('.mob-retry')) return;
    const holder=im.closest('figure') || im.parentElement;if(!holder)return;
    const retry=document.createElement('button');retry.className='mob-retry';retry.textContent='重新载入图片';
    retry.onclick=()=>{const u=new URL(im.currentSrc);u.searchParams.set('retry',Date.now());im.removeAttribute('srcset');im.src=u;retry.remove()};holder.append(retry);
  },true);
  if(location.pathname.includes('/review/'))new MutationObserver(enrich).observe(document.querySelector('main'),{childList:true});
  enrich();
})();
