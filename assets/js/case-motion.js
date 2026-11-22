/* Subtle depth only for this case study. No scroll interception or timer loops. */
(() => {
  if(!document.body.dataset.project || !document.querySelector('.case-story'))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const frames=[...document.querySelectorAll('.case-story .parallax-frame')];
  const visible=new Set();
  if('IntersectionObserver' in window){
    const observeText=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observeText.unobserve(entry.target);}
    }),{threshold:.1});
    if(!reduced.matches)document.querySelectorAll('[data-reveal]').forEach(el=>{el.classList.add('reveal-ready');observeText.observe(el);});
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>e.isIntersecting?visible.add(e.target):visible.delete(e.target));queue();
    },{rootMargin:'100px'});
    frames.forEach(frame=>observer.observe(frame));
  }
  let pending=false;
  function update(){
    pending=false;
    if(reduced.matches)return;
    visible.forEach(frame=>{
      const rect=frame.getBoundingClientRect();
      const progress=Math.max(-1,Math.min(1,(rect.top+rect.height/2-innerHeight/2)/innerHeight));
      frame.style.setProperty('--image-offset',(progress*5).toFixed(2)+'px');
      frame.style.setProperty('--depth-scale','1.025');
    });
  }
  function queue(){if(!pending){pending=true;requestAnimationFrame(update);}}
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});
  reduced.addEventListener('change',()=>{
    if(reduced.matches){frames.forEach(frame=>{frame.style.removeProperty('--image-offset');frame.style.removeProperty('--depth-scale');});document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('is-visible'));}
    else queue();
  });
})();
