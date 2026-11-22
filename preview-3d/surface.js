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
const horizontalSegments = 14;
const verticalSegments = 16;

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export function clampView(layout, x, y) {
  const { left, right, top, bottom } = layout.pan;
  const centerX = clamp(x, left, right);
  const finalRow = layout.partialRow;
  // Blend into the shallower edge once the view moves past the occupied columns.
  const extra = finalRow ? finalRow.height * clamp(centerX - finalRow.right, 0, 1) : 0;
  return { x: centerX, y: clamp(y, top, Math.max(top, bottom - extra)) };
}

export function layoutFor(width, height, projectIds) {
  const narrow = width <= 680;
  const stepX = narrow ? Math.max(1, width * .51) : clamp(width * .248, 242, 555);
  const stepY = narrow ? Math.max(height * .365, 162) : clamp(height * .365, 217, 410);
  const columns = Math.min(gridColumns, projectIds.length);
  const rows = Math.ceil(projectIds.length / gridColumns);
  const lastRowColumns = projectIds.length - (rows - 1) * gridColumns;
  const xLines = Array.from({ length: columns + 1 }, (_, i) => (i - .5) * stepX);
  const yLines = Array.from({ length: rows + 1 }, (_, i) => (narrow || i <= 1 ? i - 1 : i - .75) * stepY);
  const sizes = narrow ? [.94, .96, .92, .95, .93] : [.92, .95, .86, .93, .89];
  const tiles = {};
  const centers = projectIds.map((id, index) => {
    const r = Math.floor(index / gridColumns), c = index % gridColumns;
    const cell = { left: xLines[c], right: xLines[c + 1], top: yLines[r], bottom: yLines[r + 1] };
    const x = (cell.left + cell.right) / 2, y = (cell.top + cell.bottom) / 2;
    tiles[id] = { cell, x, y, width: sizes[(r + c) % sizes.length] * stepX };
    return { x: x / stepX, y: y / stepY };
  });
  const left = Math.min(...centers.map(center => center.x));
  const right = Math.max(...centers.map(center => center.x));
  const top = Math.min(...centers.map(center => center.y));
  const bottom = Math.max(...centers.map(center => center.y));
  // Keep the outer tiles in reach without panning half the viewport past the board.
  const sideInset = Math.min(narrow ? .5 : width * .194 / stepX, (right - left) / 2);
  const halfHeight = (bottom - top) / 2;
  const pan = {
    left: left + sideInset,
    right: right - sideInset,
    top: top + Math.min(height * .125 / stepY, halfHeight),
    bottom: bottom - Math.min(height * .175 / stepY, halfHeight),
  };
  const partialRow = rows > 1 && lastRowColumns < columns ? {
    right: lastRowColumns - 1,
    height: bottom - centers[(rows - 2) * gridColumns].y,
  } : null;
  return {
    width, height, narrow, tiles, xLines, yLines, stepX, stepY, pan, lastRowColumns, partialRow,
    homeX: narrow ? pan.left : (pan.left + pan.right) / 2,
    homeY: narrow ? clamp(1, pan.top, pan.bottom) : 0,
  };
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

export function viewForTile(layout, id) {
  const { x, y } = layout.tiles[id];
  return clampView(layout, x / layout.stepX, y / layout.stepY);
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
  const fromSeam = y - (narrow ? stepY : 0);
  const bend = fromSeam / (1 + .32 * (fromSeam / stepY) ** 2);
  const bow = bend * zoom * edge * (narrow ? .055 : .192);
  // Bend relative to the middle seam in the same plane as the tiles.
  // Moving the view can carry a seam past the center without reversing its bend.
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
  picture.srcset = picture.dataset.srcset;
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
  const guidePoints = 1 + Math.max(gridColumns * horizontalSegments,
    Math.ceil(links.length / gridColumns) * verticalSegments);
  const line = new Float32Array(guidePoints * 4);
  const cards = links.map(link => ({
    link, id: link.dataset.project,
    texture: null, picture: link.querySelector('img'),
    artwork: link.querySelector('.artwork'), labels: [...link.querySelectorAll('.project-meta')],
  }));
  let shapes = [];
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

  function drawGuides(layout, view) {
    const { xLines, yLines, lastRowColumns } = layout;
    const color = [.65, .64, .62, .34];
    for (const [row, y] of yLines.entries()) {
      const end = row === yLines.length - 1 ? lastRowColumns : xLines.length - 1;
      const points = xLines.slice(0, end).flatMap((x, i) =>
        horizontalEdge(x, xLines[i + 1], y, layout, view, horizontalSegments).slice(i === 0 ? 0 : 1));
      drawLine(points, layout, color);
    }
    for (const [col, x] of xLines.entries()) {
      const end = yLines.length - (col <= lastRowColumns ? 1 : 2);
      const points = yLines.slice(0, end).flatMap((y, i) =>
        verticalEdge(x, y, yLines[i + 1], layout, view, verticalSegments).slice(i === 0 ? 0 : 1));
      drawLine(points, layout, color);
    }
  }

  function loadNearby(cards, layout, dpr, view) {
    const atHome = view.x === layout.homeX && view.y === layout.homeY && view.pull < .02;
    const reach = atHome ? 0 : Math.min(124, layout.stepX * .30);
    const queue = cards.filter(entry => !entry.card.requested && entry.distance <= reach)
      .sort((a, b) => a.distance - b.distance || b.area - a.area);
    for (const { card, art, distance } of queue.slice(0, Math.max(0, 4 - pending))) {
      pending++;
      card.requested = card.pending = true;
      const effectiveWidth = (art.right - art.left) * dpr / (devicePixelRatio || 1);
      requestCover(card.picture, Math.ceil(effectiveWidth) + 'px', distance === 0 ? 'high' : 'low');
    }
  }

  function draw(layout, view, active) {
    if (!layout.width || !layout.height || gl.isContextLost()) return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3300000 / (layout.width * layout.height)));
    const width = Math.round(layout.width * dpr), height = Math.round(layout.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawGuides(layout, view);

    const projected = cards.map(card => {
      const tile = layout.tiles[card.id];
      const aspect = Number(card.picture.getAttribute('width')) / Number(card.picture.getAttribute('height'));
      const { art, corners } = tileContent(tile, aspect, layout.narrow);
      const center = project((art.left + art.right) / 2, (art.top + art.bottom) / 2, layout, view);
      const box = projectedBounds(art, layout, view);
      const area = Math.max(0, Math.min(box.right, layout.width) - Math.max(0, box.left))
        * Math.max(0, Math.min(box.bottom, layout.height) - Math.max(0, box.top));
      const visible = viewportDistance(projectedBounds(tile.cell, layout, view), layout) < 8;
      card.link.classList.toggle('is-offscreen', !visible);
      return { card, art, corners, center, area, visible, distance: viewportDistance(box, layout) };
    });
    loadNearby(projected, layout, dpr, view);
    const ordered = projected.filter(entry => entry.visible)
      .sort((a, b) => a.center.scale - b.center.scale);
    shapes = ordered.map(({ card, art, corners, center }, layer) => {
      const outline = [];
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= columns; col++) {
          const i = row * stride + col;
          const point = project(
            art.left + col / columns * (art.right - art.left),
            art.top + row / rows * (art.bottom - art.top),
            layout, view,
          );
          mesh[i * 4] = point.x / layout.width * 2 - 1;
          mesh[i * 4 + 1] = 1 - point.y / layout.height * 2;
          if (rim.has(i)) outline[i] = point;
        }
      }
      const polygon = perimeter.map(i => outline[i]);
      positionLink(card, polygon, corners, layout, view, layer + 1);
      const brightness = .995 - (1 - center.scale) * .29 + (active === card.link ? .065 : 0);
      gl.bindTexture(gl.TEXTURE_2D, card.loaded ? card.texture : solid);
      const shade = card.loaded ? brightness : .069;
      gl.uniform4f(tone, shade, shade, shade, 1);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      const selected = active === card.link;
      drawLine([...polygon, polygon[0]], layout, selected ? [.97, .54, .44, .91] : [.66, .59, .52, .31]);
      return { link: card.link, outline: polygon };
    });
  }

  return {
    draw,
    hit(x, y) { return pickSurface(shapes, x, y); },
    destroy() {
      events.abort();
      cards.forEach(card => {
        if (card.texture) gl.deleteTexture(card.texture);
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
