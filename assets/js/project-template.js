/* Captions describe visible renderings, not undocumented project claims. */
window.renderProject = ({project,t,esc,link,lang,image}) => {
  const next = window.portfolioProjects.find(item=>item.id===project.nextProjectId);
  const isShort = project.format === 'short';
  const workUrl = link('work.html') + (isShort ? '#short-work' : '');
  const notes = window.portfolioProjectNotes?.[project.id];
  const stories = window.portfolioProjectStories?.[project.id];
  const locale = lang === 'en' ? 1 : 0;
  const imageIndex = id => project.images.findIndex(entry => entry.id === id);
  const fullWidth = '(max-width: 760px) 100vw, 90vw';
  const halfWidth = '(max-width: 760px) 100vw, 45vw';
  const figure = (i, cls='', showNote=true, sizes) => {
    const entry=project.images[i];
    const note = showNote && notes?.[entry.id]?.[locale];
    return `<figure class="figure case-figure ${cls}" data-image="${i}">
      <button class="zoom-trigger" data-index="${i}" aria-label="${esc(t('放大：','Enlarge: ')+entry.caption[lang])}">
        <span class="parallax-frame"><span class="image-depth">${image(entry,i,false,sizes)}</span><span class="expand-mark" aria-hidden="true">↗</span></span>
      </button>
      <figcaption>
        <span>${esc(entry.caption[lang])}</span>
        <span>${t('放大图片','Enlarge image')}</span>${note ? `<p class="figure-design-note">${esc(note)}</p>` : ''}
      </figcaption>
    </figure>`;
  };
  const renderViews = indices => {
    const paired = indices.length > 1;
    return `<div class="editorial-views${paired ? ' editorial-views--paired' : ''}">
      ${indices.map(i => figure(i, '', false, paired ? halfWidth : fullWidth)).join('')}
    </div>`;
  };
  const renderStory = ({main, supporting, title, copy}) => {
    const heading = `<h2>${esc(title[locale].replaceAll('|', ' '))}</h2>`;
    const description = `<p class="editorial-description">${esc(copy[locale])}</p>`;
    const indices = supporting.map(imageIndex);
    const reference = project.id === 'ct6-creative-exhibition' && main === 'fluid-a' ? `
      <figure class="story-study case-sourced-reference">
        <img src="preview-3d/research/ferrofluid.webp" loading="lazy" decoding="async" alt="${t('磁流体在液面上形成尖峰','Spikes rising from a pool of ferrofluid')}">
        <figcaption>${t('形态参考。对照上方两张圆罩方案，液面的尖峰从同一底部抬起，弯曲的尖顶留下细亮边。','Form reference. Compare the spikes in the two dome renderings above. Their tips rise from a shared base and catch narrow highlights.')}
          <a href="https://commons.wikimedia.org/wiki/File:Ferrofluid_spikes_(magnet_placed_underneath_the_fluid).jpg">ChemGeeks</a> · <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a> · ${t('同许可缩放转码','Resized and re-encoded under the same license')}
        </figcaption>
      </figure>` : '';
    return `<section class="editorial-story">
      <div class="editorial-heading">${heading}${description}</div>
      ${renderViews([imageIndex(main), ...indices])}
      ${reference}
    </section>`;
  };
  const featuredImages = new Set([0, ...(stories ?? []).flatMap(story => [story.main, ...story.supporting]).map(imageIndex)]);
  const remainingImages = project.images.map((_, i) => i).filter(i => !featuredImages.has(i));
  const chapter = (num,zh,en,sub) => `<div class="chapter-copy" data-reveal><span class="chapter-number">${num} /</span><h2>${t(zh,en)}</h2><span class="chapter-label">${sub}</span></div>`;
  return `
    <header class="detail-head case-head ${project.heading.layout==='stacked'?'case-head--stacked':''}">
      <a class="back" href="${workUrl}">← &nbsp; ${isShort ? t('短篇作品','SHORT PROJECTS') : 'ALL WORK'}</a>
      <div class="detail-title"><h1><span>${esc(project.heading.primary)}</span><span class="project-cn">${esc(project.heading.secondary || '')}</span></h1><div class="discipline">${esc(project.brand)}${project.year ? ' / '+esc(project.year) : ''}<br>${(project.categoryLines || ['EVENT EXPERIENCE','3D VISUALIZATION']).map(esc).join('<br>')}</div></div>
      <div class="case-headline"><span>${esc(project.heading.subtitle || '')}</span><span>${project.categoryLabel?esc(project.categoryLabel[lang]):t('汽车活动 · 三维视觉','AUTOMOTIVE · 3D VISUALIZATION')}</span></div>
    </header>
    <div class="gallery case-story${stories ? ' case-story--editorial' : ''}" aria-label="${t('精选项目画面','Selected project views')}">
      <section class="opening-view">${figure(0,'hero-figure',!stories)}</section>

      ${stories ? stories.map(renderStory).join('') : isShort ? project.images.slice(1).map((_, index) => figure(index + 1)).join('') : project.sections.map(section=>`<section class="story-section">
        ${chapter(section.number,section.title.zh,section.title.en,section.label)}
        ${section.blocks.map(block=>{
          if(block.type==='pair')return '<div class="paired-views">'+block.indices.map(i=>figure(i)).join('')+'</div>';
          if(block.type==='aside-image')return '<div class="plan-layout"><div class="plan-note" data-reveal><span class="eyebrow">'+esc(block.eyebrow)+'</span><p>'+esc(block.text[lang])+'</p></div>'+figure(block.index,'plan-figure')+'</div>';
          return figure(block.index,({'edge':'edge-figure','inset':'structure-figure','finale':'finale-figure','portrait':'portrait-figure'})[block.layout]||'');
        }).join('')}
      </section>`).join('')}
      ${stories && remainingImages.length ? `<section class="editorial-story editorial-more">
        <div class="editorial-heading"><h2>${t('项目影像','Project images')}</h2></div>
        ${renderViews(remainingImages)}
      </section>` : ''}
    </div>
    ${isShort || (stories && project.id !== 'volvo-xc70-exhibition') ? '' : `<section class="case-archive" aria-labelledby="archive-title">
      <div class="archive-heading" data-reveal><div><span class="eyebrow">IMAGE INDEX</span><h2 id="archive-title">${t('项目影像','Project images')}</h2></div><span>${project.images.length} ${project.imageLabel?esc(project.imageLabel[lang]):t('张渲染图','RENDERINGS')}</span></div>
      <div class="archive-grid">${project.images.map((entry,i)=>`<button class="archive-item zoom-trigger" data-index="${i}" aria-label="${esc(t('放大：','Enlarge: ')+entry.caption[lang])}"><span class="archive-image"><img src="${esc(entry.src.replace('-1600.jpg','-768.jpg'))}" width="${entry.width}" height="${entry.height}" alt="${esc(entry.alt[lang])}" loading="lazy" decoding="async"></span><span class="archive-caption"><span>${String(i+1).padStart(2,'0')}</span><span>${esc(entry.caption[lang])}</span><span aria-hidden="true">↗</span></span></button>`).join('')}</div>
    </section>`}
    <section class="project-facts case-facts" aria-label="${t('项目信息','Project information')}">
      <div><div class="fact-label">PROJECT</div><div class="fact-value">${esc(project.title)}</div></div>
      <div><div class="fact-label">BRAND${project.year ? ' / YEAR' : ''}</div><div class="fact-value">${esc(project.brand)}${project.year ? ' / '+esc(project.year) : ''}</div></div>
      <div><div class="fact-label">CATEGORY</div><div class="fact-value">${(project.categoryLines || ['Automotive / Event Experience','3D Visualization']).map(esc).join('<br>')}</div></div>
    </section>
    <div class="detail-end case-end"><a href="${workUrl}">← &nbsp; ${isShort ? t('返回短篇作品','BACK TO SHORT PROJECTS') : t('返回全部作品','ALL WORK')}</a>${next?`<a class="next-project" href="${link(next.href)}"><small>NEXT PROJECT</small>${esc(lang==='en'&&next.titleEn?next.titleEn:next.title)} <span aria-hidden="true">↗</span></a>`:isShort?'':`<span class="next-project" aria-disabled="true"><small>NEXT PROJECT</small>${t('后续作品待更新','More work to come')} <span aria-hidden="true">↗</span></span>`}</div>`;
};
