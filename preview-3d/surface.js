// The subdivided quad and outline test are adapted from review/orbit-canvas.js.
const vertexSource = `
  attribute vec2 aPoint;
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = vec4(aPoint, 0.0, 1.0);
  }
`;
const fragmentSource = `
  precision mediump float;
  uniform sampler2D uImage;
  uniform vec4 uTone;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(uImage, vUv).rgb * uTone.rgb;
    gl_FragColor = vec4(color * uTone.a, uTone.a);
  }
`;

const gridColumns = 5;

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const wrap = (value, count) => ((value % count) + count) % count;

export function layoutFor(width, height, projectIds) {
  const narrow = width <= 680;
  const stepX = narrow ? Math.max(1, width * .51) : clamp(width * .248, 242, 555);
  const stepY = narrow ? Math.max(height * .365, 162) : clamp(height * .365, 217, 410);
  const columns = Math.min(gridColumns, projectIds.length);
  const rows = Math.ceil(projectIds.length / columns);
  // Fill the short last row with existing projects so both edges tile continuously.
  const slots = Array.from({length: columns * rows}, (_, i) =>
    projectIds[i] ?? projectIds[(i * 7) % projectIds.length]);
  const rowEdges = Array.from({length: rows+1}, (_, i) => narrow || i <= 1 ? i - 1 : i - .75);
  const periodY = rowEdges.at(-1) - rowEdges[0];
  return {width,height,narrow,stepX,stepY,columns,rows,slots,rowEdges,periodY,
    homeX:narrow ? .5 : (columns-1)/2,homeY:narrow ? 1 : 0};
}

export function viewForTile(layout, id, view = {x:layout.homeX,y:layout.homeY}) {
  let best, distance = Infinity;
  layout.slots.forEach((slot, i) => {
    if (slot !== id) return;
    const col = i % layout.columns, row = Math.floor(i/layout.columns);
    const center = (layout.rowEdges[row]+layout.rowEdges[row+1])/2;
    const x = col + Math.round((view.x-col)/layout.columns)*layout.columns;
    const y = center + Math.round((view.y-center)/layout.periodY)*layout.periodY;
    const d = Math.hypot(x-view.x,y-view.y);
    if (d < distance) { distance=d; best={x,y}; }
  });
  return best;
}

function visibleCells(layout, view) {
  const {width,height,stepX,stepY,columns,rows,periodY,rowEdges,slots,narrow} = layout;
  const reachX = width / stepX * .9 + 1, reachY = height / stepY * .7 + 1;
  const cells = [];
  for (let band=Math.floor((view.y-reachY+1)/periodY);band<=Math.floor((view.y+reachY+1)/periodY);band++) {
    for (let r=0;r<rows;r++) {
      const top=(band*periodY+rowEdges[r])*stepY, bottom=(band*periodY+rowEdges[r+1])*stepY;
      if (bottom < (view.y-reachY)*stepY || top > (view.y+reachY)*stepY) continue;
      for (let c=Math.floor(view.x-reachX);c<=Math.ceil(view.x+reachX);c++) {
        const col=wrap(c,columns), id=slots[r*columns+col];
        const sizes=narrow ? [.94,.96,.92,.95,.93] : [.92,.95,.86,.93,.89];
        cells.push({id,key:c+','+(band*rows+r),x:c*stepX,y:(top+bottom)/2,width:sizes[(r+col)%5]*stepX,
          cell:{left:(c-.5)*stepX,right:(c+.5)*stepX,top,bottom}});
      }
    }
  }
  return cells;
}

function tileContent(tile, aspect, narrow) {
  const { cell } = tile;
  const insetX = narrow ? 7 : 15;
  const insetY = narrow ? 7 : 11;
  const upperHeight = narrow ? 38 : 36;
  const lowerHeight = narrow ? 22 : 29;
  const gap = narrow ? 4 : 8;
  const bounds = {
    left: cell.left + insetX, right: cell.right - insetX,
    top: cell.top + insetY, bottom: cell.bottom - insetY,
  };
  const widthInside = bounds.right - bounds.left;
  const artTop = bounds.top + upperHeight + gap;
  const artBottom = bounds.bottom - lowerHeight - gap;
  const width = Math.min(tile.width, widthInside, (artBottom - artTop) * aspect);
  const height = width / aspect;
  const left = clamp(tile.x - width / 2, bounds.left, bounds.right - width);
  const top = clamp(tile.y - height / 2, artTop, artBottom - height);
  const art = { left, right: left + width, top, bottom: top + height };
  const split = bounds.left + widthInside * .40;
  const upper = { top: bounds.top, bottom: bounds.top + upperHeight };
  const lower = { top: bounds.bottom - lowerHeight, bottom: bounds.bottom };
  const corners = [
    { ...upper, left: bounds.left, right: Math.min(split - gap, bounds.left + 104) },
    { ...upper, left: Math.max(split, bounds.right - (narrow ? 146 : 230)), right: bounds.right },
    { ...lower, left: bounds.left, right: Math.min(split + gap, bounds.left + 104) },
    { ...lower, left: Math.max(split + gap * 2, bounds.right - 68), right: bounds.right },
  ];
  return { art, corners };
}


function project(x, y, layout, view) {
  const { width, height, narrow, stepX, stepY } = layout;
  const zoom = 1 / (1 + view.pull * (narrow ? .045 : .145));
  const dx = (x - view.x * stepX + view.driftX) * zoom;
  const dy = (y - view.y * stepY + view.driftY) * zoom;
  const u = (dx / (width * .54)) ** 2;
  const v = (dy / (height * .68)) ** 2;
  const scale = 1 / (1 + (narrow ? .070 : .168) * u / (1 + .63 * u) + (narrow ? .020 : .044) * v / (1 + .40 * v));
  const horizontal = dx * scale;
  const edge = Math.min(1.65, (2 * horizontal / width) ** 2);
  const fromSeam = y - view.y * stepY;
  const bend = fromSeam / (1 + .32 * (fromSeam / stepY) ** 2);
  const bow = bend * zoom * edge * (narrow ? .055 : .192);
  // Keep the lens centered on the viewport as the repeated plane moves beneath it.
  return {
    x: width * .5 + horizontal,
    y: height * (narrow ? .5 : .49) + dy + bow,
    scale,
  };
}

function contains(outline, x, y) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export function pickSurface(shapes, x, y) {
  // The last surface drawn is foremost. The same outlines delimit pointer targets.
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (contains(shapes[i].outline, x, y)) return shapes[i].link;
  }
  return null;
}

function shaderProgram(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (compiled) gl.attachShader(program, shader);
    gl.deleteShader(shader);
    if (!compiled) {
      gl.deleteProgram(program);
      return null;
    }
  }
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function textureFor(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function horizontalEdge(left, right, y, layout, view, segments = 14) {
  return Array.from({ length: segments + 1 }, (_, i) =>
    project(left + (right - left) * i / segments, y, layout, view));
}

function verticalEdge(x, top, bottom, layout, view, segments = 8) {
  return Array.from({ length: segments + 1 }, (_, i) =>
    project(x, top + (bottom - top) * i / segments, layout, view));
}

function projectedBounds(rect, layout, view) {
  const { left, right, top, bottom } = rect;
  const points = [top, (top + bottom) / 2, bottom]
    .flatMap(y => [left, (left + right) / 2, right].map(x => project(x, y, layout, view)));
  return {
    left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
  };
}

function viewportDistance(box, layout) {
  return Math.hypot(Math.max(0, box.left - layout.width, -box.right),
    Math.max(0, box.top - layout.height, -box.bottom));
}

export function requestCover(picture, sizes, priority = 'auto', loading = 'eager') {
  picture.loading = loading;
  picture.fetchPriority = priority;
  picture.sizes = sizes;
  if (picture.dataset.srcset) picture.srcset = picture.dataset.srcset;
  picture.src = picture.dataset.src;
}

function heightAt(line, x) {
  const index = line.findIndex(point => point.x >= x);
  if (index < 1) return line[index === 0 ? 0 : line.length - 1].y;
  const a = line[index - 1], b = line[index];
  return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
}

function screenCorner(corner, layout, view) {
  const top = horizontalEdge(corner.left, corner.right, corner.top, layout, view);
  const bottom = horizontalEdge(corner.left, corner.right, corner.bottom, layout, view);
  const left = Math.max(top[0].x, bottom[0].x) + 1;
  const right = Math.min(top.at(-1).x, bottom.at(-1).x) - 1;
  const width = right - left;
  if (width <= 0 || right <= 0 || left >= layout.width) return null;

  // Keep the text box inside the projected corner. Let the viewport clip it with
  // the cell so that a label never slides along the edge as the user pans.
  const slope = (heightAt(top, right) - heightAt(top, left)) / width;
  const levels = line => [left, ...line.map(p => p.x).filter(x => x > left && x < right), right]
    .map(x => heightAt(line, x) - slope * (x - left));
  const y = Math.max(...levels(top)) + 1;
  const end = Math.min(...levels(bottom)) - 1;
  const height = end - y;
  return height > 0 ? { left, width, y, height, slope } : null;
}

function positionLink(entry, outline, corners, layout, view, layer) {
  const xs = outline.map(point => point.x);
  const ys = outline.map(point => point.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const right = Math.max(...xs), bottom = Math.max(...ys);
  Object.assign(entry.link.style, {
    left: left + 'px', top: top + 'px', width: right - left + 'px', height: bottom - top + 'px',
    zIndex: String(layer),
  });
  entry.labels.forEach((label, i) => {
    const box = screenCorner(corners[i], layout, view);
    label.style.visibility = box ? '' : 'hidden';
    if (!box) return;
    Object.assign(label.style, {
      left: box.left - left + 'px', top: box.y - top + 'px', width: box.width + 'px',
      height: box.height + 'px', transform: 'matrix(1,' + box.slope + ',0,1,0,0)',
    });
  });
  entry.artwork.style.clipPath = 'polygon(' + outline.map(point => {
    return (point.x - left).toFixed(2) + 'px ' + (point.y - top).toFixed(2) + 'px';
  }).join(', ') + ')';
}

export function createScene(stage, links, { onRedraw, onFallback }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false });
  } catch {
    return null;
  }
  if (!gl) return null;
  const release = gl.getExtension('WEBGL_lose_context');
  const program = shaderProgram(gl);
  if (!program) {
    release?.loseContext();
    return null;
  }
  const events = new AbortController();
  const { signal } = events;
  const vertices = gl.createBuffer();
  const elements = gl.createBuffer();
  const position = gl.getAttribLocation(program, 'aPoint');
  const uv = gl.getAttribLocation(program, 'aUv');
  const tone = gl.getUniformLocation(program, 'uTone');
  const columns = 14, rows = 6, stride = columns + 1;
  const mesh = new Float32Array(stride * (rows + 1) * 4);
  const indices = [], perimeter = [];
  for (let col = 0; col <= columns; col++) perimeter.push(col);
  for (let row = 1; row <= rows; row++) perimeter.push(row * stride + columns);
  for (let col = columns - 1; col >= 0; col--) perimeter.push(rows * stride + col);
  for (let row = rows - 1; row > 0; row--) perimeter.push(row * stride);
  const rim = new Set(perimeter);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const i = row * stride + col;
      mesh[i * 4 + 2] = col / columns;
      mesh[i * 4 + 3] = row / rows;
      if (row < rows && col < columns) indices.push(i, i + 1, i + stride, i + 1, i + stride + 1, i + stride);
    }
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
  const solid = textureFor(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  const guidePoints = perimeter.length + 1;
  const line = new Float32Array(guidePoints * 4);
  const cards = links.map(link => ({
    link, id: link.dataset.project,
    texture: null, picture: link.querySelector('img'),
    artwork: link.querySelector('.artwork'), labels: [...link.querySelectorAll('.project-meta')],
  }));
  // Embed a small RGB copy of each cover so the first painted frame has imagery.
  for (const card of cards) {
    const pixels = Uint8Array.from(atob(card.picture.dataset.pixels), value => value.charCodeAt(0));
    card.texture = textureFor(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 32, 20, 0, gl.RGB, gl.UNSIGNED_BYTE, pixels);
  }
  const byId = new Map(cards.map(card => [card.id,card]));
  const copies = new Map();
  const fades = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let shapes = [];
  function instance(card, key) {
    if (copies.has(key)) return copies.get(key);
    const link = document.createElement('div');
    link.className = 'project repeat-cell';
    link.setAttribute('aria-hidden','true');
    const artwork = document.createElement('span');
    artwork.className = 'artwork';
    link.append(artwork);
    const labels = card.labels.map(label => {
      const copy = label.cloneNode(true);
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      copy.removeAttribute('id');
      link.append(copy);
      return copy;
    });
    card.link.parentNode.append(link);
    const entry = {link,artwork,labels};
    copies.set(key,entry);
    return entry;
  }
  let pending = 0;

  const finishRequest = card => {
    if (card.pending) pending--;
    card.pending = false;
  };
  const upload = card => {
    if (signal.aborted || gl.isContextLost()) return;
    finishRequest(card);
    card.texture ??= textureFor(gl);
    try {
      gl.bindTexture(gl.TEXTURE_2D, card.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, card.picture);
    } catch {
      onFallback();
      return;
    }
    const swatch = document.createElement('canvas');
    swatch.width = swatch.height = 3;
    const painter = swatch.getContext('2d');
    painter.drawImage(card.picture, 0, 0, 3, 3);
    const field = painter.getImageData(0, 0, 3, 3);
    for (let i = 0; i < field.data.length; i += 4) {
      const luma = .2126 * field.data[i] + .7152 * field.data[i + 1] + .0722 * field.data[i + 2];
      // Neutral or light covers still yield a dim background. Keep the original cover untouched.
      const shade = 13 + Math.min(36, luma * .22);
      for (let channel = 0; channel < 3; channel++) {
        field.data[i + channel] = Math.max(8, Math.min(62, shade + (field.data[i + channel] - luma) * .28));
      }
    }
    painter.putImageData(field, 0, 0);
    card.field ??= textureFor(gl);
    gl.bindTexture(gl.TEXTURE_2D, card.field);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,swatch);
    card.loaded = true;
    onRedraw();
  };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    onFallback();
  }, { signal });
  for (const card of cards) {
    card.picture.addEventListener('load', () => upload(card), { signal });
    card.picture.addEventListener('error', () => {
      finishRequest(card);
      if (!card.retried) {
        card.retried = true;
        setTimeout(() => {
          if (signal.aborted) return;
          const url = new URL(card.picture.dataset.src, document.baseURI);
          url.searchParams.set('retry', '1');
          card.picture.removeAttribute('srcset');
          card.picture.src = url.href;
        }, 900);
      }
      onRedraw();
    }, { signal });
  }
  stage.prepend(canvas);

  function drawLine(points, layout, color) {
    for (let i = 0; i < points.length; i++) {
      line[i * 4] = points[i].x / layout.width * 2 - 1;
      line[i * 4 + 1] = 1 - points[i].y / layout.height * 2;
    }
    gl.bindTexture(gl.TEXTURE_2D, solid);
    gl.uniform4fv(tone, color);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, line);
    gl.drawArrays(gl.LINE_STRIP, 0, points.length);
  }

  function loadNearby(cards, layout, dpr, view) {
    
    const reach = layout.stepX * .95;
    const queue = cards.filter(entry => !entry.card.requested && entry.distance <= reach)
      .sort((a, b) => a.distance - b.distance || b.area - a.area);
    for (const { card, art, distance } of queue.slice(0, Math.max(0, 6 - pending))) {
      if (card.requested) continue;
      pending++;
      card.requested = card.pending = true;
      const effectiveWidth = (art.right - art.left) * dpr / (devicePixelRatio || 1);
      requestCover(card.picture, Math.ceil(effectiveWidth) + 'px', distance === 0 ? 'high' : 'low');
    }
  }

  function draw(layout, view, active, pointer, preferredKey) {
    if (!layout.width || !layout.height || gl.isContextLost()) return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3300000 / (layout.width * layout.height)));
    const width = Math.round(layout.width * dpr), height = Math.round(layout.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);


    const projected = visibleCells(layout,view).map(tile => {
      const card = byId.get(tile.id);
      const aspect = Number(card.picture.getAttribute('width')) / Number(card.picture.getAttribute('height'));
      const { art, corners } = tileContent(tile, aspect, layout.narrow);
      const center = project((art.left + art.right) / 2, (art.top + art.bottom) / 2, layout, view);
      const box = projectedBounds(art, layout, view);
      const area = Math.max(0, Math.min(box.right, layout.width) - Math.max(0, box.left))
        * Math.max(0, Math.min(box.bottom, layout.height) - Math.max(0, box.top));
      const visible = viewportDistance(projectedBounds(tile.cell, layout, view), layout) < 8;

      return { tile, card, art, corners, center, area, visible, distance: viewportDistance(box, layout) };
    });
    loadNearby(projected, layout, dpr, view);
    const ordered = projected.filter(entry => entry.visible)
      .sort((a, b) => a.center.scale - b.center.scale);
    const primary = new Map();
    for (const entry of ordered) {
      const previous=primary.get(entry.card);
      const distance=e=>Math.hypot(e.center.x-layout.width/2,e.center.y-layout.height/2);
      if (!previous || entry.tile.key===preferredKey ||
          (previous.tile.key!==preferredKey && distance(entry)<distance(previous))) primary.set(entry.card,entry);
    }
    cards.forEach(card=>card.link.classList.toggle('is-offscreen',!primary.has(card)));
    const used = new Set(), painted = new Set();
    const meshRect = rect => {
      const outline = [];
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= columns; col++) {
          const i = row * stride + col;
          const point = project(
            rect.left + col / columns * (rect.right - rect.left),
            rect.top + row / rows * (rect.bottom - rect.top),
            layout, view,
          );
          mesh[i * 4] = point.x / layout.width * 2 - 1;
          mesh[i * 4 + 1] = 1 - point.y / layout.height * 2;
          if (rim.has(i)) outline[i] = point;
        }
      }
      return perimeter.map(i => outline[i]);
    };
    shapes = ordered.map((entry, layer) => {
      const {tile,card,art,corners,center}=entry;
      const cell = meshRect(tile.cell);
      const primaryCell = primary.get(card)===entry;
      const target = primaryCell ? card : instance(card,tile.key);
      if (!primaryCell) used.add(tile.key);
      target.link.dataset.cell = tile.key;
      target.link.dataset.instanceProject = card.id;
      const selected = active===card.link && (pointer ? contains(cell,pointer.x,pointer.y) : primaryCell);
      const old = fades.get(tile.key) || 0;
      const level = reduced.matches ? Number(selected) : old + (Number(selected)-old)*.34;
      if (Math.abs(level-Number(selected))>.012) onRedraw();
      if (level>.012) {
        fades.set(tile.key,level);
        painted.add(tile.key);
        gl.bindTexture(gl.TEXTURE_2D,card.field || solid);
        const flat=stage.dataset.hoverStyle==='flat';
        if (flat) gl.bindTexture(gl.TEXTURE_2D,solid);
        const tint = flat ? [.16, .31, .47] : [.94, .94, .97];
        gl.uniform4f(tone, ...tint, level * .90);
        gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh);
        gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      }
      drawLine(horizontalEdge(tile.cell.left,tile.cell.right,tile.cell.top,layout,view),layout,[.65,.64,.62,.34]);
      drawLine(verticalEdge(tile.cell.left,tile.cell.top,tile.cell.bottom,layout,view),layout,[.65,.64,.62,.34]);
      const polygon = meshRect(art);
      positionLink(target, polygon, corners, layout, view, layer + 1);
      const brightness = .995 - (1 - center.scale) * .29 + (selected ? .045 : 0);
      gl.bindTexture(gl.TEXTURE_2D, card.texture);
      const shade = brightness;
      gl.uniform4f(tone, shade, shade, shade, 1);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      drawLine([...polygon, polygon[0]], layout, selected ? [.97, .54, .44, .91] : [.66, .59, .52, .31]);
      return { link: card.link, outline: cell, key:tile.key };
    });
    for(const [key,copy] of copies) if(!used.has(key)){copy.link.remove();copies.delete(key)}
    for(const key of fades.keys()) if(!painted.has(key)) fades.delete(key);
  }

  return {
    draw,
    cellAt(x,y){return shapes.findLast(s=>contains(s.outline,x,y))?.key},
    hit(x, y) { return pickSurface(shapes, x, y); },
    destroy() {
      events.abort();
      copies.forEach(copy=>copy.link.remove());
      cards.forEach(card => {
        if (card.texture) gl.deleteTexture(card.texture);
        if (card.field) gl.deleteTexture(card.field);
        card.link.classList.remove('is-offscreen');
        card.link.removeAttribute('style');
        card.artwork.removeAttribute('style');
        card.labels.forEach(label => label.removeAttribute('style'));
      });
      gl.deleteTexture(solid);
      gl.deleteBuffer(vertices);
      gl.deleteBuffer(elements);
      gl.deleteProgram(program);
      canvas.remove();
      if (!gl.isContextLost()) release?.loseContext();
    },
  };
}
