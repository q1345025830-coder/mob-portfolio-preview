(() => {
  'use strict';
  const {projects,shorts}=window.reviewContent;
  // The public and local review data share media IDs, including responsive variants.
  const excluded = new Set(['new-year-4', 'retail-2', 'yangshuo-3']);
  for (const item of [...projects,...shorts]) {
    const keep = image => !excluded.has(image.media) && !image.src?.includes('/studies/');
    item.sections = item.sections.map(section => ({...section, main:section.main.filter(keep), supporting:section.supporting.filter(keep)}))
      .filter(section => section.main.length || section.supporting.length);
    if (item.archive) item.archive = item.archive.filter(keep);
  }
  const gridPath = new URL('../preview-3d/index.html', location.href);
  const referrer = document.referrer && new URL(document.referrer);
  if (referrer && referrer.origin === gridPath.origin && referrer.pathname === gridPath.pathname) {
    history.replaceState({...history.state, fromMobGrid:true}, '');
  }
  const main=document.querySelector('main');
  const viewer=document.querySelector('.viewer');
  const viewerStage=viewer.querySelector('.viewer-stage');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const copy={
    skip:['跳至内容','Skip to content'],
    work:['作品','Work'],about:['关于','About'],contact:['联系','Contact'],
    intro:['汽车品牌活动与空间设计','Automotive events & spatial design'],
    sub:['从发布会、试驾到展览空间。','Launches, drive experiences and exhibitions.'],
    cases:['完整案例','Case studies'],shorts:['短篇作品','Short works'],
    spiral:['螺旋','Spiral'],list:['列表','List'],mode:['浏览模式','View mode'],
    previous:['上一张','Previous'],next:['下一张','Next'],close:['关闭','Close'],
    view:['查看详情','View project'],back:['返回作品','Back to work'],
    browse:['滚动或滑动浏览','Scroll or swipe to explore'],
    pauseOrbit:['暂停巡游','Pause auto-scroll'],resumeOrbit:['继续巡游','Resume auto-scroll'],
    stepper:['项目切换','Project navigation'],collection:['作品分类','Work collections'],
    zoom:['放大','Zoom in'],zoomOut:['缩小','Zoom out'],gallery:['项目图集','Project gallery'],
    images:['浏览图集','Browse images'],open:['查看高清图','View full resolution'],
    read:['向下阅读','Read the case'],
    video:['播放动画','Play animation'],play:['播放','Play'],
    design:['设计说明','Design notes'],designHeading:['设计灵感与说明','Inspiration & design'],
    related:['下一件作品','Next project'],contactEmpty:['联系信息待补充。','Contact details to be supplied.']
  };
  function load(key,fallback) {
    try {return JSON.parse(sessionStorage.getItem('emc-review-'+key)) ?? fallback;}
    catch {return fallback;}
  }
  function save(key,value) {
    try {sessionStorage.setItem('emc-review-'+key,JSON.stringify(value));}
    catch { /* Browser storage can be disabled for local files. */ }
  }
  let lang=load('lang','zh')==='en'?'en':'zh';
  let state={group:'cases',mode:'spiral',cases:0,shorts:0,y:0,...load('home',{})};
  let autoPaused=load('autoplay-paused',false)===true;
  let route='';
  let transition=null;
  let stepper=null;
  let gallery=[];
  let galleryIndex=0;
  let zoomed=false;
  let focusBeforeViewer=null;
  let pendingFocus=null;
  const coverFlights=new WeakMap();
  const coverSources=new Map();
  let caseReveal=null;
  const word=key=>copy[key][lang==='zh'?0:1];
  const tr=value=>value?.[lang] ?? value?.zh ?? '';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const coverLink=p=>'#case/'+p.id;
  const activeGroup=()=>state.group==='shorts'?shorts:projects;
  const current=()=>activeGroup()[state[state.group]] ?? activeGroup()[0];
  const position=()=>activeGroup().indexOf(current());
  const projectFor=hash=>[...projects,...shorts].find(p=>hash===coverLink(p));
  const imageIndex=figure=>gallery.indexOf(figure);
  function imageInfo(figure) {
    if (figure.media) {
      const [width,height,full,variants]=window.reviewMedia[figure.media];
      return {width,height,full:'media/'+full,src:'media/'+variants[0][0],
        srcset:variants.map(([f,w])=>'media/'+f+' '+w+'w').join(', ')};
    }
    const prefix=src=>src?.startsWith('../')?src:'../'+src;
    return {...figure,src:prefix(figure.src),full:prefix(figure.full||figure.src),
      srcset:figure.srcset?.split(', ').map(prefix).join(', ')};
  }
  function picture(figure,sizes,priority=false,extra='') {
    const i=imageInfo(figure);
    return '<img src="'+escape(i.src)+'" '+(i.srcset?'srcset="'+escape(i.srcset)+'" sizes="'+sizes+'" ':'')+
      (i.width?'width="'+i.width+'" height="'+i.height+'" ':'')+
      'alt="'+escape(tr(figure.alt||figure.caption))+'" '+(priority?'fetchpriority="high"':'loading="lazy"')+' decoding="async" '+extra+'>';
  }
  function figureMarkup(figure,kind='primary',priority=false) {
    const hero=kind==='hero';
    const sizes=hero?'(max-width: 760px) 94vw, (max-width: 1500px) 94vw, 1400px':
      kind==='support'?'(max-width: 760px) 88vw, 30vw':
      kind==='comparison'?'(max-width: 760px) 94vw, 46vw':
      kind==='paired'?'(max-width: 760px) 94vw, 65vw':'(max-width: 760px) 94vw, 92vw';
    const index=imageIndex(figure);
    return '<figure class="case-figure '+kind+(figure.role==='reference'?' reference':'')+'"><button class="image-open" data-image="'+index+'" type="button" aria-label="'+escape(word('open')+' · '+tr(figure.caption))+'">'+
      picture(figure,sizes,priority,hero?'data-case-cover':'')+'<span class="enlarge" aria-hidden="true">+</span></button><figcaption>'+escape(tr(figure.caption))+'</figcaption></figure>';
  }
  function applyCopy() {
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';
    document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=word(el.dataset.copy));
    const language=document.querySelector('.language');
    language.textContent=lang==='zh'?'EN':'中文';
    language.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换为中文');
    document.querySelector('#nav').setAttribute('aria-label',lang==='zh'?'作品集导航':'Portfolio navigation');
    for (const a of document.querySelectorAll('#nav a')) {
      if (a.hash===(route.startsWith('#case/')?'#work':route)) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    }
  }
  function modeButton(key,picked,kind) {
    const label=word(key);
    return '<button type="button" data-'+kind+'="'+key+'" aria-pressed="'+picked+'"><span class="button-label">'+
      '<span>'+label+'</span><span aria-hidden="true">'+label+'</span></span></button>';
  }
  function renderHome(returning=false,changingMode=false) {
    const list=activeGroup();
    const grid=state.mode==='list';
    const cards=list.map((p,index)=>{
      const active=index===position();
      const sizes=grid?'(max-width: 760px) 33vw, 24vw':'(max-width: 760px) 80vw, 38vw';
      return '<a class="'+(grid?'list-card':'orbit-card')+'" data-project="'+p.id+'" data-position="'+index+'" href="'+coverLink(p)+'" aria-label="'+escape(word('view')+' · '+tr(p.title))+'" '+(!grid&&!active?'tabindex="-1"':'')+'>'+
        '<div class="card-image">'+picture(p.cover,sizes,index===position())+'</div>'+
        (grid?'<div class="list-info"><span class="meta">'+escape([p.brand,tr(p.category)].filter(Boolean).join(' / '))+'</span><h2>'+escape(tr(p.title))+'</h2></div><span class="list-open" aria-hidden="true">↗</span>':'')+'</a>';
    }).join('');
    const intro='<div class="work-heading"><p class="eyebrow">AUTOMOTIVE / SPATIAL DESIGN</p><h1>'+word('intro')+'</h1></div>';
    const tabs='<div class="tabs" role="group" aria-label="'+word('collection')+'">'+
      modeButton('cases',state.group==='cases','group')+modeButton('shorts',state.group==='shorts','group')+
      '</div>';
    const modes='<div class="segments glass" role="group" aria-label="'+word('mode')+'">'+
      modeButton('spiral',!grid,'mode')+modeButton('list',grid,'mode')+'</div>';
    main.innerHTML=grid?'<div class="frame work-page catalog-page'+(changingMode?' mode-in':'')+'"><div class="work-intro">'+intro+'<p class="work-summary">'+word('sub')+'</p></div>'+
      '<div class="work-tools">'+tabs+modes+'</div><div class="catalog-layout"><div class="work-list">'+cards+'</div><aside class="list-preview" aria-hidden="true"></aside></div></div>':
      '<section class="orbit" aria-label="'+word('spiral')+'"><div class="orbit-stage"><div class="orbit-atmosphere" aria-hidden="true"></div><div class="orbit-cards">'+cards+'</div></div>'+
      '<div class="orbit-header frame"><div class="orbit-catalog">'+intro+tabs+'</div>'+modes+'</div>'+
      '<div class="orbit-footer frame"><div class="orbit-current" aria-live="polite"></div><div class="orbit-nav"><span class="orbit-help">'+word('browse')+'</span><div class="orbit-count"></div>'+
      '<div class="orbit-steps" role="group" aria-label="'+word('stepper')+'"><button type="button" class="orbit-auto" data-autoplay></button><button type="button" data-step="-1" aria-label="'+word('previous')+'">‹</button><button type="button" data-step="1" aria-label="'+word('next')+'">›</button></div></div></div></section>';
    if (grid) {
      const preview=main.querySelector('.list-preview');
      function show(project,animate) {
        if(preview.dataset.project===project.id) return;
        preview.dataset.project=project.id;
        preview.innerHTML=picture(project.cover,'(max-width: 760px) 0px, 32vw',true);
        if(animate&&!reduced.matches) preview.firstElementChild.animate([
          {opacity:.18,transform:'translateY(10px) scale(1.035)'},
          {opacity:1,transform:'translateY(0) scale(1)'}
        ],{duration:310,easing:'cubic-bezier(.2,.7,.1,1)'});
      }
      const links=main.querySelectorAll('.list-card');
      links.forEach((link,i)=>{
        link.style.setProperty('--row',String(i));
        link.addEventListener('pointerenter',()=>show(list[i],true));
        link.addEventListener('focus',()=>show(list[i],true));
      });
      show(current(),false);
      return;
    }
    const stage=main.querySelector('.orbit-stage');
    stepper=createOrbit(stage,list,returning);
  }
  function createOrbit(stage,list,returning) {
    const cards=[...stage.querySelectorAll('.orbit-card')];
    const orbit=stage.parentElement;
    const currentLabel=orbit.querySelector('.orbit-current');
    const count=orbit.querySelector('.orbit-count');
    const autoButton=orbit.querySelector('[data-autoplay]');
    const controller=new AbortController();
    const {signal}=controller;
    let selected=position();
    let cursor=selected;
    let target=selected;
    let raf=0;
    let wheelTimer=0;
    let idleTimer=0;
    let autoRunning=false;
    let lastFrame=0;
    let direction=1;
    let hovering=false;
    let pointer=null;
    let draggedAt=-Infinity;
    let isMobile=window.innerWidth<=760;
    let width=stage.clientWidth;
    let height=stage.clientHeight;
    let gpu=null;
    function disableCanvas() {
      gpu?.destroy();
      gpu=null;
      orbit.classList.remove('has-canvas');
      orbit.dataset.renderer='css';
      cards.forEach(card=>{card.inert=false;syncEcho(card.querySelector('img'));});
      requestPaint();
    }
    function enableCanvas() {
      if(gpu || reduced.matches || location.protocol==='file:') return;
      gpu=window.createMobOrbitCanvas?.(stage,cards,requestPaint,disableCanvas) ?? null;
      orbit.classList.toggle('has-canvas',Boolean(gpu));
      orbit.dataset.renderer=gpu?'canvas':'css';
    }
    const wrap=index=>((index%list.length)+list.length)%list.length;
    const gap=(index,center)=>wrap(index-center+list.length/2)-list.length/2;
    const clamp01=value=>Math.min(1,Math.max(0,value));
    function paint() {
      if(gpu) {
        gpu.draw({width,height,mobile:isMobile,cursor,selected,direction});
        return;
      }
      const radius=width*(isMobile?.51:.285);
      const pitch=height*(isMobile?.21:.196);
      const effects=!reduced.matches;
      for (const [index,card] of cards.entries()) {
        const delta=gap(index,cursor);
        const distance=Math.abs(delta);
        const front=index===selected;
        const visible=distance<3.58;
        if (!visible && card.inert) continue;
        const angle=-delta*.94;
        const turn=Math.sin(angle);
        const facing=Math.cos(angle);
        const x=turn*radius;
        const y=-delta*pitch;
        const z=(facing-1)*(isMobile?295:650);
        const depth=front?0:Math.round(clamp01(.12+(distance-.38)/1.55)*4)/4;
        const trail=effects?depth*(isMobile?13:20)*direction:0;
        card.style.transform='translate3d(calc(-50% + '+x+'px),calc(-50% + '+y+'px),'+z+'px) rotateY('+(-turn*54)+'deg) rotateX('+(-turn*9)+'deg) rotateZ('+(-turn*10)+'deg)';
        card.style.zIndex=String(90-Math.round(distance*20));
        card.style.opacity=visible?String(clamp01((3.58-distance)*.66)*(1-depth*.20)):'0';
        const trailStyle=effects?depth*direction:0;
        if(card.dataset.trail!==String(trailStyle)) {
          card.dataset.trail=String(trailStyle);
          card.style.setProperty('--echo',String(effects?depth*.58:0));
          card.style.setProperty('--echo-x',(trail*.5)+'px');
          card.style.setProperty('--echo-y',(trail*.55)+'px');
        }
        card.style.pointerEvents=visible&&distance<2.8?'auto':'none';
        card.classList.toggle('is-front',front);
        card.tabIndex=front?0:-1;
        card.inert=!visible;
      }
    }
    function labels() {
      const p=list[selected];
      for(const [index,card] of cards.entries()) {
        card.classList.toggle('is-front',index===selected);
        card.tabIndex=index===selected?0:-1;
        if(gpu) card.inert=index!==selected;
      }
      orbit.style.setProperty('--orbit-light','rgb('+p.tone+')');
      currentLabel.innerHTML='<p class="meta">'+escape([p.brand,tr(p.category)].filter(Boolean).join(' / '))+'</p><h2><a href="'+coverLink(p)+'" data-project="'+p.id+'">'+escape(tr(p.title))+'</a></h2>'+
        '<a class="orbit-open" href="'+coverLink(p)+'" data-project="'+p.id+'">'+word('view')+'<span aria-hidden="true">↗</span></a>';
      count.textContent=String(selected+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0');
    }
    function syncEcho(img) {
      if(!gpu && img.currentSrc) img.parentElement.style.setProperty('--echo-image','url('+JSON.stringify(img.currentSrc)+')');
    }
    stage.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement) syncEcho(e.target);},true);
    stage.querySelectorAll('img').forEach(syncEcho);
    function select(phase) {
      const next=wrap(Math.round(phase));
      if(next===selected) return;
      selected=next;
      state[state.group]=selected;
      save('home',state);
      labels();
    }
    function requestPaint() {
      if(!raf) raf=requestAnimationFrame(animate);
    }
    function animate(time) {
      raf=0;
      const elapsed=lastFrame?Math.min(65,time-lastFrame):16.7;
      lastFrame=time;
      if(autoRunning) {
        cursor+=elapsed*(isMobile?.00029:.00045);
        target=cursor;
        select(cursor);
      } else {
        const distance=target-cursor;
        const ease=1-Math.exp(-elapsed/(isMobile?68:113));
        cursor=reduced.matches || Math.abs(distance)<.003 ? target : cursor+distance*ease;
      }
      paint();
      if(autoRunning || cursor!==target) requestPaint();
      else lastFrame=0;
    }
    function updateTarget(value) {
      if(value!==target) direction=Math.sign(value-target);
      target=value;
      select(value);
      if(reduced.matches) {cursor=target;paint();}
      else requestPaint();
    }
    function updateAutoButton() {
      autoButton.hidden=reduced.matches;
      autoButton.dataset.paused=String(autoPaused);
      const label=word(autoPaused?'resumeOrbit':'pauseOrbit');
      autoButton.setAttribute('aria-label',label);
      autoButton.title=label;
    }
    function canAuto() {
      return !signal.aborted && !autoPaused && !reduced.matches && !document.hidden &&
        !hovering && !pointer && !orbit.querySelector(':focus-visible:not([data-autoplay])');
    }
    function hold() {
      clearTimeout(idleTimer);
      if(!autoRunning) return;
      autoRunning=false;
      currentLabel.setAttribute('aria-live','polite');
    }
    function scheduleAuto(delay=2700) {
      clearTimeout(idleTimer);
      if(autoRunning || !canAuto()) return;
      const start=()=>{
        if(!canAuto()) return;
        autoRunning=true;
        lastFrame=0;
        direction=1;
        currentLabel.setAttribute('aria-live','off');
        requestPaint();
      };
      if(delay===0) start();
      else idleTimer=setTimeout(start,delay);
    }
    function onConstraintChange() {
      if(!canAuto()) hold();
      else scheduleAuto();
    }
    function coverAt(event) {
      if(!gpu) return null;
      const rect=stage.getBoundingClientRect();
      return gpu.hit(event.clientX-rect.left,event.clientY-rect.top);
    }
    function setHover(over) {
      if(hovering===over) return;
      hovering=over;
      onConstraintChange();
    }
    function hover(e) {
      if(e.pointerType==='touch') return;
      const hit=e.type==='pointerout'?e.relatedTarget:e.target;
      setHover(hit instanceof Element && orbit.contains(hit) &&
        Boolean(hit.closest('.orbit-card,.orbit-current') || (stage.contains(hit) && coverAt(e))));
    }
    orbit.addEventListener('pointerover',hover,{signal});
    orbit.addEventListener('pointerout',hover,{signal});
    orbit.addEventListener('focusin',onConstraintChange,{signal});
    orbit.addEventListener('focusout',()=>queueMicrotask(onConstraintChange),{signal});
    document.addEventListener('visibilitychange',onConstraintChange,{signal});
    reduced.addEventListener('change',()=>{
      if(reduced.matches) disableCanvas();
      else enableCanvas();
      cards.forEach(card=>syncEcho(card.querySelector('img')));
      labels();
      updateAutoButton();
      onConstraintChange();
      requestPaint();
    },{signal});
    autoButton.addEventListener('click',()=>{
      autoPaused=!autoPaused;
      save('autoplay-paused',autoPaused);
      updateAutoButton();
      if(autoPaused) hold();
      else scheduleAuto(180);
    },{signal});
    function step(delta) {
      hold();
      clearTimeout(wheelTimer);
      wheelTimer=0;
      updateTarget(Math.round(target)+delta);
      scheduleAuto();
    }
    function onWheel(e) {
      if(e.ctrlKey) return;
      const delta=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;
      if(!delta) return;
      e.preventDefault();
      hold();
      const scaled=(e.deltaMode?delta*26:delta)/146;
      if(reduced.matches) {
        if(!wheelTimer) step(Math.sign(scaled));
      } else updateTarget(target+Math.max(-1.05,Math.min(1.05,scaled)));
      clearTimeout(wheelTimer);
      wheelTimer=setTimeout(()=>{wheelTimer=0;updateTarget(Math.round(target));scheduleAuto();},reduced.matches?150:115);
    }
    stage.addEventListener('wheel',onWheel,{passive:false});
    stage.addEventListener('pointerdown',e=>{
      if(!e.isPrimary || e.button!==0) return;
      hold();
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,origin:cursor};
    });
    stage.addEventListener('dragstart',e=>e.preventDefault());
    stage.addEventListener('pointermove',e=>{
      if(pointer?.id!==e.pointerId) {
        if(gpu && e.pointerType!=='touch') hover(e);
        return;
      }
      if(!pointer.active && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>12) {
        pointer.active=true;
        stage.setPointerCapture(e.pointerId);
        clearTimeout(wheelTimer);
        cancelAnimationFrame(raf);
        raf=0;
      }
      if(pointer.active && !reduced.matches) {
        const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
        const drag=Math.abs(dx)>Math.abs(dy)?dx:dy;
        const fraction=Math.max(-.82,Math.min(.82,drag/(isMobile?155:240)));
        if(fraction) direction=-Math.sign(fraction);
        cursor=pointer.origin-fraction;
        paint();
      }
    });
    stage.addEventListener('pointerup',e=>{
      if(pointer?.id!==e.pointerId) return;
      const x=e.clientX-pointer.x,y=e.clientY-pointer.y;
      const d=Math.abs(x)>Math.abs(y)?x:y;
      if(pointer.active) draggedAt=performance.now();
      pointer=null;
      if(Math.abs(d)>36) {step(d<0?1:-1);draggedAt=performance.now();}
      else {requestPaint();scheduleAuto();}
    });
    stage.addEventListener('pointercancel',()=>{pointer=null;updateTarget(Math.round(target));scheduleAuto();});
    window.addEventListener('pointerup',e=>{
      if(pointer?.id!==e.pointerId) return;
      pointer=null;
      updateTarget(Math.round(target));
      scheduleAuto();
    },{signal});
    stage.addEventListener('click',e=>{
      if(performance.now()-draggedAt<350) {e.preventDefault();e.stopImmediatePropagation();return;}
      const link=coverAt(e);
      if(link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        go(link.hash,{link});
      }
    },true);
    function snapshot(id) {
      if(!gpu) return null;
      const card=cards.find(link=>link.dataset.project===id);
      const bounds=card&&gpu.bounds(card);
      if(!bounds) return null;
      const original=card.querySelector('img');
      const image=document.createElement('img');
      image.src=original.currentSrc||coverSources.get(id)||original.src;
      coverSources.set(id,image.src);
      image.alt='';
      image.className='orbit-flight';
      Object.assign(image.style,Object.fromEntries(Object.entries(bounds).map(([k,v])=>[k,v+'px'])));
      stage.append(image);
      gpu.omit(card);
      paint();
      coverFlights.set(image,()=>{
        image.remove();
        if(!stage.isConnected) return;
        gpu?.omit(null);
        paint();
      });
      return image;
    }
    const observer=new ResizeObserver(()=>{
      isMobile=window.innerWidth<=760;
      width=stage.clientWidth;
      height=stage.clientHeight;
      paint();
    });
    observer.observe(stage);
    enableCanvas();
    orbit.dataset.renderer=gpu?'canvas':'css';
    labels();
    updateAutoButton();
    paint();
    scheduleAuto(returning?850:0);
    return {step,hold,snapshot,destroy(){controller.abort();hold();observer.disconnect();cancelAnimationFrame(raf);clearTimeout(wheelTimer);gpu?.destroy();}};
  }
  function renderChapter(section,index) {
    const {main:images,supporting}=section;
    const title='<header class="chapter-heading"><h2>'+escape(tr(section.title))+'</h2><p>'+escape(tr(section.copy))+'</p></header>';
    if(section.comparison) {
      return '<section class="chapter comparison-chapter" id="chapter-'+index+'">'+title+
        '<div class="image-pair comparison-pair">'+images.map(img=>figureMarkup(img,'comparison')).join('')+'</div>'+
        supporting.map(img=>figureMarkup(img,'support')).join('')+'</section>';
    }
    const references=supporting.map(img=>figureMarkup(img,'support')).join('');
    return '<section class="chapter" id="chapter-'+index+'">'+
      (images.length?'<div class="chapter-spread">'+title+figureMarkup(images[0],'paired')+
        (references?'<div class="chapter-references">'+references+'</div>':'')+'</div>':
        title+'<div class="image-pair supporting-pair">'+references+'</div>')+
      (images.length>1?'<div class="'+(images.length>2?'image-pair':'feature-image')+'">'+images.slice(1).map(img=>figureMarkup(img,images.length>2?'paired':'primary')).join('')+'</div>':'')+
      '</section>';
  }
  function renderCase(p) {
    const chapters=p.sections;
    gallery=[...new Set([p.cover,...chapters.flatMap(s=>[...s.main,...s.supporting]),...(p.archive||[])])];
    const collection=p.short?shorts:projects;
    const next=collection[(collection.indexOf(p)+1)%collection.length];
    const sectionHead=[p.brand,tr(p.category),p.year].filter(Boolean).join(' / ');
    const caseAction='<div class="case-jumps"><button class="glass" data-jump="design-heading" type="button">'+word('design')+'</button>'+
      (p.short?'':'<button class="glass" data-jump="gallery-heading" type="button">'+word('images')+'</button>')+'</div>';
    main.innerHTML='<article class="case-page" style="--tone:'+p.tone+'"><div class="case-tools frame"><a class="glass back" href="#work"><span aria-hidden="true">‹</span> '+word('back')+'</a>'+
      (p.video?'<button class="glass" data-jump="case-film" type="button">▶ '+word('video')+'</button>':'')+caseAction+'</div><section class="case-screen" aria-label="'+escape(tr(p.title))+'">'+figureMarkup(p.cover,'hero',true)+
      '<div class="screen-bar frame"><span class="screen-meta">'+escape(sectionHead)+'</span><button class="screen-read" data-jump="case-intro" type="button">'+word('read')+' <span aria-hidden="true">↓</span></button></div></section>'+
      '<div class="case-paper"><div class="case-reading"><header class="case-heading" id="case-intro" tabindex="-1"><div><p class="eyebrow">'+escape(sectionHead)+'</p><h1>'+escape(tr(p.title))+'</h1></div>'+
      (p.lead?'<p class="case-lead">'+escape(tr(p.lead))+'</p>':'')+'</header>'+
      (p.video?'<section class="clip mob-clip" id="case-film" tabindex="-1"><h2>'+escape(tr(p.title))+' · '+word('video')+'</h2><video controls playsinline muted loop preload="none" poster="'+escape(imageInfo(p.cover).src)+'"><source src="media/'+p.id+'-preview.webm" type="video/webm"><source src="'+p.video+'" type="video/mp4"></video><a href="'+p.video+'">▶ 完整原片 · '+(p.id==='new-year'?'8':'10')+' 秒</a></section>':'')+
      '<div class="design-section"><h2 class="design-label eyebrow" id="design-heading" tabindex="-1">'+word('designHeading')+'</h2>'+
      chapters.map(renderChapter).join('')+'</div>'+

      (gallery.length<=1?'':'<section class="gallery" id="gallery"><header><h2 id="gallery-heading" tabindex="-1">'+word('gallery')+'</h2>'+(p.source?'<a href="'+p.source+'" target="_blank" rel="noopener">'+escape(tr(p.sourceLabel))+'</a>':'')+
        '</header><div class="gallery-grid">'+gallery.map((img,i)=>'<button type="button" data-image="'+i+'" aria-label="'+escape(word('open')+' · '+tr(img.caption))+'">'+picture(img,'(max-width: 760px) 28vw, 14vw')+'</button>').join('')+
        '</div></section>')+'</div></div>'+
      '<footer class="case-footer"><div class="frame case-footer-inner"><a class="back" href="#work"><span aria-hidden="true">‹</span> '+word('back')+'</a>'+
      '<a href="'+coverLink(next)+'" class="related">'+picture(next.cover,'(max-width: 760px) 87vw, 55vw')+
      '<div><span class="meta">'+word('related')+'</span><strong>'+escape(tr(next.title))+'</strong></div></a></div></footer></article>';
    const film=main.querySelector('.mob-clip video');
    if(film && !reduced.matches && !navigator.connection?.saveData){
      const observer=new IntersectionObserver(entries=>{
        if(!film.isConnected){observer.disconnect();return;}
        if(entries[0].isIntersecting) film.play().catch(()=>{});
        else film.pause();
      },{threshold:.35}); observer.observe(film);
    }
    if(!reduced.matches&&'IntersectionObserver' in window) {
      caseReveal=new IntersectionObserver(entries=>{
        for(const entry of entries) {
          if(!entry.isIntersecting) continue;
          entry.target.classList.remove('will-reveal');
          caseReveal?.unobserve(entry.target);
        }
      },{rootMargin:'0px 0px -7% 0px',threshold:.06});
      main.querySelectorAll('.case-paper .case-figure,.chapter-heading,.case-footer .related').forEach(node=>{
        node.classList.add('will-reveal');
        caseReveal.observe(node);
      });
    }
  }
  function renderInfo(hash) {
    const profile=window.portfolioProfile;
    const about=hash==='#about';
    const contacts=profile.contacts;
    const content=about?'<p>'+escape(tr(profile.summary))+'</p><ul>'+profile.areas.map(area=>'<li>'+escape(tr(area))+'</li>').join('')+'</ul>':
      contacts.length?'<ul>'+contacts.map(c=>'<li><a href="'+escape(c.href)+'">'+escape(c.label)+'</a></li>').join('')+'</ul>':'<p>'+word('contactEmpty')+'</p>';
    main.innerHTML='<section class="frame info-page"><p class="eyebrow">MOB / '+(about?'ABOUT':'CONTACT')+'</p><h1>'+word(about?'about':'contact')+'</h1>'+
      content+
      '<a class="glass back" href="#work"><span aria-hidden="true">‹</span> '+word('back')+'</a></section>';
  }
  function view(hash,{focus=false,changingMode=false}={}) {
    if (stepper) {stepper.destroy();stepper=null;}
    caseReveal?.disconnect();
    caseReveal=null;
    const returning=route.startsWith('#case/');
    const p=projectFor(hash);
    route=p || hash==='#about'||hash==='#contact'?hash:'#work';
    gallery=[];
    if (p) renderCase(p);
    else if (route==='#work') renderHome(returning,changingMode);
    else renderInfo(route);
    document.title=(p?tr(p.title):route==='#work'?word('intro'):word(route.slice(1)))+' — MOB';
    document.body.classList.toggle('is-orbit',route==='#work'&&state.mode==='spiral');
    document.body.classList.toggle('is-catalog',route==='#work'&&state.mode==='list');
    document.body.classList.toggle('is-case',Boolean(p));
    applyCopy();
    const y=route==='#work'?state.y:0;
    scrollTo(0,y);
    if(focus) {
      const card=pendingFocus && main.querySelector('[data-project="'+pendingFocus+'"]');
      (card || main).focus({preventScroll:true});
    }
  }
  function selectSnapshot(hash,fromLink) {
    if(route.startsWith('#case/')&&hash==='#work') {
      const cover=main.querySelector('[data-case-cover]');
      return cover?.getBoundingClientRect().bottom>Math.min(300,innerHeight*.40)?cover:null;
    }
    if(route.startsWith('#case/')&&fromLink?.matches('.related')) return fromLink.querySelector('img');
    if(route==='#work'&&projectFor(hash)&&fromLink) {
      const preview=main.querySelector('.list-preview[data-project="'+fromLink.dataset.project+'"] img');
      return stepper?.snapshot(fromLink.dataset.project) ||
        (preview?.getBoundingClientRect().width?preview:null) ||
        fromLink.querySelector('img') || main.querySelector('.orbit-card.is-front img');
    }
    return null;
  }
  function snapshotDestination(hash,previousRoute) {
    if(projectFor(hash)) return main.querySelector('[data-case-cover]');
    const previousId=previousRoute.split('/')[1];
    const preview=main.querySelector('.list-preview[data-project="'+previousId+'"] img');
    return stepper?.snapshot(previousId) ||
      (preview?.getBoundingClientRect().width?preview:null) ||
      main.querySelector('[data-project="'+previousId+'"] img');
  }
  const motionAllowed=()=>!reduced.matches&&typeof main.animate==='function';
  let caseMotion=null;
  function coverState(image) {
    if(!image) return null;
    const rect=image.getBoundingClientRect();
    if(!rect.width||!rect.height) return null;
    return {rect,src:image.currentSrc||image.src};
  }
  function animateCase(source,destination) {
    if(!motionAllowed()) return;
    const target=coverState(destination);
    const release=coverFlights.get(destination);
    const duration=innerWidth<=760?550:720;
    const ease='cubic-bezier(.2,.72,.2,1)';
    const reveal=main.animate([{opacity:.40},{opacity:1}],{duration,easing:ease});
    if(!source?.src||!target) {
      release?.();
      const cover=main.querySelector('[data-case-cover]');
      const arrival=cover?.animate([{transform:'scale(1.035)'},{transform:'scale(1)'}],{duration,easing:ease});
      const cancel=()=>{
        caseMotion=null;
        reveal.cancel();
        arrival?.cancel();
      };
      caseMotion=cancel;
      reveal.finished.catch(()=>{}).finally(()=>{if(caseMotion===cancel) caseMotion=null;});
      return;
    }
    const flight=document.createElement('img');
    flight.className='cover-transfer';
    flight.src=source.src;
    flight.alt='';
    flight.setAttribute('aria-hidden','true');
    const from=source.rect,to=target.rect;
    Object.assign(flight.style,{
      left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',
      objectFit:getComputedStyle(destination).objectFit,objectPosition:getComputedStyle(destination).objectPosition
    });
    const oldVisibility=destination.style.visibility;
    destination.style.visibility='hidden';
    document.body.append(flight);
    const animation=flight.animate([
      {transform:'translate3d('+(from.left-to.left)+'px,'+(from.top-to.top)+'px,0) scale('+(from.width/to.width)+','+(from.height/to.height)+')',borderRadius:'12px'},
      {transform:'translate3d(0,0,0) scale(1)',borderRadius:getComputedStyle(destination).borderRadius}
    ],{duration,easing:ease,fill:'both'});
    const entryScroll=scrollY;
    let finished=false;
    function finish() {
      if(finished) return;
      finished=true;
      caseMotion=null;
      window.removeEventListener('scroll',onScroll);
      reduced.removeEventListener('change',onPreference);
      flight.remove();
      destination.style.visibility=oldVisibility;
      release?.();
      animation.cancel();
    }
    function onScroll() {if(Math.abs(scrollY-entryScroll)>12) finish();}
    function onPreference() {if(reduced.matches) {reveal.cancel();finish();}}
    window.addEventListener('scroll',onScroll,{passive:true});
    reduced.addEventListener('change',onPreference);
    caseMotion=()=>{reveal.cancel();finish();};
    animation.finished.then(finish,finish);
  }
  function go(hash,{link=null,push=true,focus=true}={}) {
    if(route===hash) return;
    transition?.skipTransition?.();
    caseMotion?.();
    if(route==='#work') {
      stepper?.hold();
      state.y=scrollY;
      if(link?.dataset.project) pendingFocus=link.dataset.project;
      save('home',state);
    }
    if(viewer.open) viewer.close();
    if(push && hash==='#work' && history.state?.fromWork) {history.back();return;}
    const previousRoute=route;
    const enteringCase=Boolean(projectFor(hash));
    const leavingCase=previousRoute.startsWith('#case/')&&hash==='#work';
    const motion=(enteringCase||leavingCase)&&motionAllowed();
    const before=motion?selectSnapshot(hash,link):null;
    const source=coverState(before);
    coverFlights.get(before)?.();
    if(push) history.pushState({fromWork:route==='#work'},'',hash);
    view(hash,{focus});
    if(motion) animateCase(source,source?snapshotDestination(hash,previousRoute):null);
  }
  function updateViewer() {
    const entry=gallery[galleryIndex];
    const img=viewer.querySelector('img');
    const full=imageInfo(entry);
    zoomed=false;
    viewer.classList.remove('zoomed');
    if(full.width) img.style.setProperty('--native-width',full.width+'px');
    else img.style.removeProperty('--native-width');
    img.src=full.full;
    img.alt=tr(entry.alt||entry.caption);
    viewer.querySelector('#viewer-caption').textContent=tr(entry.caption);
    viewer.querySelector('.viewer-count').textContent=(galleryIndex+1)+' / '+gallery.length;
    for (const button of viewer.querySelectorAll('[data-viewer="prev"],[data-viewer="next"]')) button.disabled=gallery.length===1;
    viewer.querySelector('[data-viewer="zoom"]').textContent=word('zoom');
    viewer.querySelector('[data-viewer="zoom"]').setAttribute('aria-pressed','false');
  }
  function galleryStep(dir) {
    galleryIndex=(galleryIndex+dir+gallery.length)%gallery.length;
    updateViewer();
  }
  function openViewer(index,trigger) {
    focusBeforeViewer=trigger;
    galleryIndex=index;
    updateViewer();
    document.body.classList.add('viewing');
    viewer.showModal();
  }
  let viewerTouch=null;
  let viewerDrag=null;
  viewerStage.addEventListener('touchstart',e=>{
    viewerTouch=e.touches.length===1?e.touches[0].clientX:null;
  },{passive:true});
  viewerStage.addEventListener('touchend',e=>{
    if(!zoomed && viewerTouch!==null) {
      const dx=e.changedTouches[0].clientX-viewerTouch;
      if(Math.abs(dx)>48) galleryStep(dx<0?1:-1);
    }
    viewerTouch=null;
  },{passive:true});
  viewerStage.addEventListener('pointerdown',e=>{
    if(!zoomed || e.pointerType!=='mouse' || e.button!==0) return;
    e.preventDefault();
    viewerDrag={x:e.clientX,y:e.clientY,left:viewerStage.scrollLeft,top:viewerStage.scrollTop};
    viewerStage.setPointerCapture(e.pointerId);
    viewerStage.classList.add('panning');
  });
  viewerStage.addEventListener('pointermove',e=>{
    if(viewerDrag) viewerStage.scrollTo(viewerDrag.left+viewerDrag.x-e.clientX,viewerDrag.top+viewerDrag.y-e.clientY);
  });
  viewerStage.addEventListener('lostpointercapture',()=>{
    viewerDrag=null;
    viewerStage.classList.remove('panning');
  });
  viewer.addEventListener('close',()=>{
    document.body.classList.remove('viewing');
    viewer.querySelector('img').removeAttribute('src');
    focusBeforeViewer?.focus({preventScroll:true});
  });
  viewer.addEventListener('click',e=>{
    const action=e.target.closest('[data-viewer]')?.dataset.viewer;
    if(action==='close'||e.target===viewer) viewer.close();
    if(action==='prev') galleryStep(-1);
    if(action==='next') galleryStep(1);
    if(action==='zoom') {
      zoomed=!zoomed;
      viewer.classList.toggle('zoomed',zoomed);
      e.target.textContent=word(zoomed?'zoomOut':'zoom');
      e.target.setAttribute('aria-pressed',String(zoomed));
      if(zoomed) viewerStage.scrollTo((viewerStage.scrollWidth-viewerStage.clientWidth)/2,(viewerStage.scrollHeight-viewerStage.clientHeight)/2);
    }
  });
  document.addEventListener('click',e=>{
    if(e.defaultPrevented) return;
    const button=e.target.closest('button');
    const link=e.target.closest('a');
    if(link?.matches('.case-tools .back, .case-footer .back') && history.state?.fromMobGrid && !e.ctrlKey && !e.metaKey){
      e.preventDefault();history.back();return;
    }
    if(button?.matches('.language')) {
      state.y=route==='#work'?scrollY:state.y;
      const y=scrollY;
      lang=lang==='zh'?'en':'zh';
      save('lang',lang);
      view(route);
      scrollTo(0,y);
    }
    if(button?.dataset.group || button?.dataset.mode) {
      const key=button.dataset.group?'group':'mode';
      if(state[key]===button.dataset[key]) return;
      state[key]=button.dataset[key];
      state.y=0;
      save('home',state);
      const switchView=()=>{
        view('#work',{changingMode:true});
        main.querySelector('[data-'+key+'="'+state[key]+'"]').focus({preventScroll:true});
      };
      if(key==='mode'&&!reduced.matches&&document.startViewTransition) {
        stepper?.hold();
        transition?.skipTransition?.();
        const html=document.documentElement;
        html.classList.add('switching-mode');
        transition=document.startViewTransition(switchView);
        transition.finished.catch(()=>{}).finally(()=>html.classList.remove('switching-mode'));
      } else {
        switchView();
        if(motionAllowed()) main.animate([{opacity:.32},{opacity:1}],{duration:340,easing:'ease-out'});
      }
    }
    if(button?.dataset.step) stepper?.step(Number(button.dataset.step));
    if(button?.dataset.image!==undefined) openViewer(Number(button.dataset.image),button);
    if(button?.dataset.jump) {
      const heading=document.getElementById(button.dataset.jump);
      heading.focus({preventScroll:true});
      heading.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    }
    if(button?.dataset.video) {
      const video=document.createElement('video');
      video.controls=true;
      video.playsInline=true;
      video.poster=imageInfo(projectFor(route).cover).src;
      video.src=button.dataset.video;
      button.replaceWith(video);
      video.play().catch(()=>{});
    }
    if (!link || !link.getAttribute('href')?.startsWith('#') || link.matches('.skip') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(link.hash,{link});
  });
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey) return;
    const directions={ArrowLeft:-1,ArrowRight:1};
    const dir=directions[e.key];
    if(viewer.open && dir && !zoomed) {e.preventDefault();galleryStep(dir);}
    else if(stepper && main.contains(document.activeElement) && (dir || e.key==='ArrowDown' || e.key==='ArrowUp')) {
      e.preventDefault();
      stepper.step(dir || (e.key==='ArrowDown'?1:-1));
    }
  });
  window.addEventListener('popstate',()=>go(location.hash||'#work',{push:false}));
  window.addEventListener('pagehide',()=>{
    if(route==='#work') {state.y=scrollY;save('home',state);}
  });
  history.scrollRestoration='manual';
  view(location.hash||'#work');
  const previewRevision=document.querySelector('meta[name="mob-preview-revision"]')?.content;
  if(previewRevision) {
    const restored=load('preview-scroll',null);
    if(restored) {
      save('preview-scroll',null);
      if(restored.hash===location.hash) scrollTo(0,restored.y);
    }
    let checking=false;
    async function checkPreview() {
      if(document.hidden||checking) return;
      checking=true;
      try {
        const response=await fetch('/__mob_preview_revision',{cache:'no-store'});
        if(response.ok&&(await response.text())!==previewRevision) {
          save('preview-scroll',{hash:location.hash,y:scrollY});
          location.reload();
        }
      } catch { /* The preview server can be briefly unavailable during a restart. */ }
      finally {checking=false;}
    }
    window.setInterval(checkPreview,3500);
    document.addEventListener('visibilitychange',checkPreview);
  }
  if(projectFor(location.hash)&&scrollY<40) animateCase(null,null);
})();
