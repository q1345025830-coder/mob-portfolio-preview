(() => {
  'use strict';
  const page = document.body.dataset.page;
  const en = new URLSearchParams(location.search).get('lang') === 'en';
  const lang = en ? 'en' : 'zh';
  const t = (zh, english) => en ? english : zh;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link = (file) => `${file}${en ? (file.includes('?') ? '&lang=en' : '?lang=en') : ''}`;
  const projectId = new URLSearchParams(location.search).get('id') || document.body.dataset.project;
  const project = window.portfolioProjects.find(p => p.id === projectId) || (page === 'project' && !document.body.dataset.project ? window.portfolioLegacyProjects[0] : window.portfolioProjects[0]);
  const languageUrl = new URL(location.href); en ? languageUrl.searchParams.delete('lang') : languageUrl.searchParams.set('lang','en');
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  const navItems = [['index.html','HOME','home'],['work.html','WORK','work'],['about.html','ABOUT','about'],['contact.html','CONTACT','contact']];
  const header = `<a class="skip" href="#main">${t('跳至内容','Skip to content')}</a><div class="shell"><header class="header"><a class="wordmark" href="${link('index.html')}" aria-label="${t('作品集首页','Portfolio home')}">3D PORTFOLIO</a><button class="menu" aria-label="${t('打开导航','Open navigation')}" aria-expanded="false" aria-controls="navigation"><span></span><span></span></button><nav class="nav" id="navigation" aria-label="${t('主导航','Main navigation')}">${navItems.map(([file,title,id])=>`<a href="${link(file)}" ${(page===id || page==='project' && id==='work')?'class="active" aria-current="'+(page===id?'page':'location')+'"':''}>${page==='home' && !en ? ({home:'首页',work:'作品',about:'关于',contact:'联系'})[id] : title}</a>`).join('')}<a class="lang" href="${esc(languageUrl.pathname.split('/').pop()+languageUrl.search)}" lang="${en?'zh-CN':'en'}" aria-label="${t('Switch to English','切换中文')}">${en?'中文 / EN':'中 / EN'}</a></nav></header></div>`;
  const footer = `<footer class="footer"><span>3D PORTFOLIO</span><span>AUTOMOTIVE · SPATIAL · VISUAL</span><a href="#top" aria-label="${t('返回顶部','Back to top')}">↑ TOP</a></footer>`;
  const placeholder = (i, cover=false) => `<div class="placeholder" role="img" aria-label="${t('待提供的原始项目图片，非作品预览','Original project image not yet supplied; not a work preview')}"><span class="slot">CADILLAC / ${cover?'COVER':String(i+1).padStart(2,'0')}</span><span class="await">${t('原始渲染图待导入','Awaiting original rendering')}</span></div>`;
  const image = (entry,i,cover=false,sizes='(max-width: 760px) 100vw, 1440px') => entry.src ? `<img src="${esc(entry.src)}" alt="${esc(entry.alt[lang])}" ${entry.srcset ? `srcset="${esc(entry.srcset)}" sizes="${sizes}" width="${entry.width}" height="${entry.height}"` : ''} ${i===0?'fetchpriority="high"':'loading="lazy"'} decoding="async">` : placeholder(i,cover);
  function projectRow(p) { return `<article class="project-row" data-project-id="${esc(p.id)}"><div class="project-meta"><span class="number">${esc(p.number)}</span><h2><a href="${link(p.href)}">${esc(en && p.titleEn ? p.titleEn : p.title)}</a></h2><p>${esc(p.discipline)}</p><span class="mini-rule"></span></div><a class="project-visual" href="${link(p.href)}" aria-label="${t('查看项目','View project')}"><div class="image-wrap">${image(p.images.find(entry=>entry.id===p.coverImageId)||p.images[0],0,true)}</div><div class="visual-caption"><span>${p.categoryLabel?esc(p.categoryLabel[lang]):t('汽车 / 三维视觉','AUTOMOTIVE / 3D VISUALIZATION')}</span><span class="view">${t('查看项目','VIEW PROJECT')} <b>↗</b></span></div></a></article>`; }
  const listedProjects = window.portfolioProjects.filter(p => p.format !== 'short' && (page==='work' || p.selected!==false));
  if (page === 'home') listedProjects.sort((a,b)=>(a.homeOrder ?? 0)-(b.homeOrder ?? 0));
  function homeProject(p, featured = false) {
    const title = esc(en && p.titleEn ? p.titleEn : p.title);
    const cover = p.images.find(entry => entry.id === p.coverImageId) || p.images[0];
    const category = p.categories?.includes('exhibition')
      ? t('展览空间', 'Exhibition space')
      : t('汽车活动', 'Automotive event');
    const heading = featured ? 'h2' : 'h3';
    const sizes = featured
      ? '(max-width: 760px) calc(100vw - 48px), (max-width: 1440px) 89vw, 1280px'
      : '(max-width: 760px) calc(100vw - 48px), (max-width: 1440px) 44vw, 628px';
    return `<article class="home-project ${featured?'home-featured':''}" data-project-id="${esc(p.id)}">
      <a class="home-project-link" href="${link(p.href)}">
        <div class="home-image">${image(cover,featured?0:1,true,sizes)}</div>
        <div class="home-project-info">
          <div><${heading}>${title}</${heading}><p>${p.format==='short'?esc(p.categoryLabel?.[lang]||category):category}</p></div>
          <span class="home-case-action">${featured?t('查看案例','View case'):''}<span aria-hidden="true">↗</span></span>
        </div>
      </a>
    </article>`;
  }
  let content = '';
  if (page === 'project' && projectId && !window.portfolioProjects.some(p=>p.id===projectId)) {
    content = '<section class="simple"><div class="eyebrow">PROJECT</div><h1>'+t('作品未找到','PROJECT NOT FOUND')+'</h1><a class="arrow-link" href="'+link('work.html')+'">← '+t('返回全部作品','ALL WORK')+'</a></section>';
  } else if (page === 'home') {
    const featured = listedProjects.find(p => p.id === 'xt5-creative-exhibition') || listedProjects[0];
    content = `<section class="hero home-intro"><div class="hero-layout">
      <h1>${t('<span>汽车品牌体验</span><span>与空间设计</span>','<span>Automotive brand experience</span><span>& spatial design</span>')}</h1>
      <div class="hero-note"><p>${t('汽车发布会、展览空间<br>与三维视觉','Automotive launches, exhibition spaces<br>and 3D visualization')}</p>
      <a class="arrow-link" href="#works">${t('浏览作品','Explore work')} <span aria-hidden="true">↓</span></a></div>
    </div></section>
    ${homeProject(featured,true)}
    <section id="works" class="home-works" aria-labelledby="home-works-title">
      <div class="home-works-head"><h2 id="home-works-title">${t('更多作品','More work')}</h2>
      <a href="${link('work.html')}">${t('全部作品','All work')} <span aria-hidden="true">↗</span></a></div>
      <div class="home-grid">${listedProjects.filter(p=>p!==featured).map(p=>homeProject(p)).join('')}</div>
    </section>`;
  } else if (page === 'work') {
    const shortProjects = window.portfolioProjects.filter(p => p.format === 'short');
    content = `<section class="hero"><div class="eyebrow">${t('项目索引','PROJECT INDEX')}</div><div class="hero-layout"><h1>ALL<br>WORK</h1><div class="hero-note"><p>${t('汽车活动、发布会与展览空间。<br>以三维视觉呈现品牌体验。','3D design for automotive events,<br>launches and exhibition spaces.')}</p><a class="arrow-link" href="#works">${t('浏览作品','EXPLORE WORK')} <span class="arrow">↓</span></a></div></div></section><section id="works" aria-label="${t('作品','Work')}"><div class="section-top"><span>${shortProjects.length?t('完整项目','FULL PROJECTS'):'ALL PROJECTS'}</span>${shortProjects.length?`<a href="#short-work">${t('短篇作品','Short Projects')} ↓</a>`:''}<span class="count">${String(listedProjects.length).padStart(2,'0')} ${t('个项目','PROJECT')}</span></div><div class="work-taxonomy">${[...new Set(listedProjects.flatMap(p=>p.categories||[]))].map(c=>'<span>'+esc(c.toUpperCase())+'</span>').join('')}</div>${listedProjects.map(projectRow).join('')}</section>`;
    if (shortProjects.length) {
      content += `<section id="short-work" class="home-works" aria-labelledby="short-work-title">
        <div class="home-works-head"><h2 id="short-work-title">${t('短篇作品','Short Projects')}</h2></div>
        <div class="home-grid">${shortProjects.map(p => homeProject(p)).join('')}</div>
      </section>`;
    }
  } else if (page === 'project' && project.template === 'editorial') {
    content = window.renderProject({project,t,esc,link,lang,image});
  } else if (page === 'project') {
    content = `<section class="detail-head"><a class="back" href="${link('work.html')}">← &nbsp; ALL WORK</a><div class="detail-title"><h1>${esc(project.title)}</h1><div class="discipline">AUTOMOTIVE<br>3D VISUALIZATION</div></div>${project.description?`<p class="detail-description">${esc(project.description[lang])}</p>`:''}</section><section class="gallery" aria-label="${t('项目渲染图','Project renderings')}">${project.images.map((entry,i)=>`<figure class="figure ${esc(entry.layout)}">${entry.src?`<button class="zoom-trigger" data-index="${i}" aria-label="${t('放大图片','Enlarge image')} ${i+1}">${image(entry,i)}</button>`:image(entry,i)}<figcaption><span>${String(i+1).padStart(2,'0')} / ${String(project.images.length).padStart(2,'0')}</span><span>${entry.src?t('点击放大 ↗','EXPAND ↗'):t('原图待提供','ORIGINAL PENDING')}</span></figcaption></figure>`).join('')}</section><section class="project-facts" aria-label="${t('项目信息','Project information')}"><div><div class="fact-label">PROJECT</div><div class="fact-value">Cadillac</div></div><div><div class="fact-label">ROLE</div><div class="fact-value">${project.role?esc(project.role[lang]):t('待本人确认','Pending confirmation')}</div></div></section><div class="detail-end"><a href="${link('work.html')}">← &nbsp; ${t('全部作品','ALL WORK')}</a><a href="${link('contact.html')}">${t('联系','CONTACT')} &nbsp; ↗</a></div>`;

  } else if (page === 'about') {
    const profile=window.portfolioProfile;
    content=`<section class="simple about-intro"><div class="eyebrow">ABOUT</div><h1>DESIGNING<br>EXPERIENCES.</h1><p>${esc(profile.summary[lang])}</p></section>
      <section class="profile-section" data-reveal><span class="profile-index">01 / EXPERTISE</span><div><h2>${t('专业方向','Areas of practice')}</h2><ul class="expertise-list">${profile.areas.map((area,i)=>'<li><span>0'+(i+1)+'</span>'+esc(area[lang])+'</li>').join('')}</ul></div></section>
      <section class="profile-section" data-reveal><span class="profile-index">02 / EXPERIENCE</span><div><h2>${t('工作经历','Experience')}</h2>${profile.experience.length?profile.experience.map(e=>'<article class="experience-entry"><p>'+esc(e.company)+'</p><p>'+esc(e.role[lang])+'</p><span>'+esc(e.period)+'</span></article>').join(''):'<p class="content-pending">'+t('详细工作经历待补充。','Career details to be supplied.')+'</p>'}</div></section>
      <div class="page-links"><a href="${link('work.html')}">${t('查看作品','VIEW WORK')} ↗</a><a href="${link('contact.html')}">${t('联系','CONTACT')} ↗</a></div>`;
  } else {
    const contacts=window.portfolioProfile.contacts;
    content=`<section class="simple contact-intro"><div class="eyebrow">CONTACT</div><h1>LET’S<br>CONNECT.</h1><p>${t('汽车品牌活动、空间与三维视觉。','Automotive events, spaces and 3D visualization.')}</p><div class="contact-channel">${contacts.length?contacts.map(c=>'<a href="'+esc(c.href)+'">'+esc(c.label)+' ↗</a>').join(''):'<span>'+t('联系信息待补充。','Contact information to be supplied.')+'</span>'}</div></section><div class="page-links"><a href="${link('work.html')}">${t('浏览作品','EXPLORE WORK')} ↗</a><a href="${link('about.html')}">ABOUT ↗</a></div>`;
  }
  document.body.id='top';
  const markup = `${header}<div class="shell"><main id="main">${content}</main>${footer}</div><dialog class="lightbox" aria-label="${t('项目图片查看器','Project image viewer')}"><div class="lightbox-inner"><div class="lightbox-bar"><span>${esc(en && project.titleEn ? project.titleEn : project.title)}</span><button class="close-lightbox" aria-label="${t('关闭图片查看器','Close image viewer')}">CLOSE ×</button></div><div class="lightbox-stage"></div><div class="lightbox-progress" aria-hidden="true"><span></span></div><div class="lightbox-bottom"><button class="previous" aria-label="${t('上一张','Previous image')}">←</button><span class="lightbox-count"></span><button class="zoom-toggle">${t('放大','ZOOM +')}</button><button class="next" aria-label="${t('下一张','Next image')}">→</button></div></div></dialog>`;
  if (document.body.dataset.prerendered !== lang || document.body.dataset.project === 'dynamic') document.body.innerHTML = markup;
  const menu=document.querySelector('.menu'), nav=document.querySelector('.nav');
  const closeMenu=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',t('打开导航','Open navigation'));};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?t('关闭导航','Close navigation'):t('打开导航','Open navigation'));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  matchMedia('(min-width:761px)').addEventListener('change',closeMenu);
  const dialog=document.querySelector('.lightbox'),stage=document.querySelector('.lightbox-stage');
  let current=0,previousFocus=null;

  let imageRequest=0;
  const viewerStatus=document.createElement('span');viewerStatus.className='viewer-status';viewerStatus.setAttribute('role','status');document.querySelector('.lightbox-bar').append(viewerStatus);
  function showImage(i){
    const entries=project.images,direction=i<current?-1:1;
    let target=(i+entries.length)%entries.length;
    for(let n=0;n<entries.length&&!entries[target].src;n++)target=(target+direction+entries.length)%entries.length;
    if(!entries[target].src)return;
    current=target;
    stage.classList.remove('zoomed');
    const entry=entries[current],request=++imageRequest;
    const img=new Image();img.alt=entry.alt[lang];
    viewerStatus.textContent=t('载入中','Loading');
    img.onload=()=>{if(request!==imageRequest)return;stage.replaceChildren(img);viewerStatus.textContent='';};
    img.onerror=()=>{if(request===imageRequest)viewerStatus.textContent=t('图片未能载入，请切换或重试','Unable to load. Please try another image.');};
    img.src=entry.full||entry.src;
    document.querySelector('.lightbox-count').textContent=String(current+1).padStart(2,'0')+' / '+String(entries.length).padStart(2,'0');
    document.querySelector('.lightbox-progress span').style.transform='scaleX('+((current+1)/entries.length)+')';
    document.querySelector('.zoom-toggle').textContent=t('放大','ZOOM +');
    stage.scrollTo(0,0);
  }
  document.querySelectorAll('.zoom-trigger').forEach(button=>button.addEventListener('click',()=>{
    previousFocus=button;showImage(Number(button.dataset.index));dialog.showModal();document.body.style.overflow='hidden';
  }));
  document.querySelector('.close-lightbox').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.style.overflow='';imageRequest++;viewerStatus.textContent='';stage.replaceChildren();previousFocus?.focus({preventScroll:true});});
  document.querySelector('.previous').addEventListener('click',()=>showImage(current-1));document.querySelector('.next').addEventListener('click',()=>showImage(current+1));
  const toggleZoom=()=>{const zoomed=stage.classList.toggle('zoomed');document.querySelector('.zoom-toggle').textContent=zoomed?t('适合屏幕','FIT'):t('放大','ZOOM +');};
  document.querySelector('.zoom-toggle').addEventListener('click',toggleZoom);stage.addEventListener('dblclick',toggleZoom);
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();showImage(current+1);}if(e.key==='ArrowLeft'){e.preventDefault();showImage(current-1);}});
  let startTouch=null;stage.addEventListener('touchstart',e=>{startTouch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});stage.addEventListener('touchend',e=>{if(!startTouch||stage.classList.contains('zoomed')){startTouch=null;return;}const dx=e.changedTouches[0].clientX-startTouch.x,dy=e.changedTouches[0].clientY-startTouch.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)showImage(current+(dx<0?1:-1));startTouch=null;},{passive:true});stage.addEventListener('touchcancel',()=>{startTouch=null;},{passive:true});
})();
