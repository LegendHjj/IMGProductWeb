const preset = (style, name, category, color = '#ffffff', accent = '#d4b477', width = 7) => ({ style, name, category, color, accent, width });
export const PHOTO_FRAMES = [
  preset('none', 'No frame', 'Minimal'),
  preset('ornate', 'Vintage scrolls', 'Vintage'),
  preset('nouveau', 'Art Nouveau', 'Vintage'),
  preset('victorian', 'Victorian lace', 'Vintage'),
  preset('deco', 'Golden Art Deco', 'Vintage', '#d8b66d'),
  preset('antique', 'Antique gold', 'Vintage', '#9b7136', '#f0d9a0', 6),
  preset('cameo', 'Cameo oval', 'Vintage'),
  preset('scallop', 'Pearl lace', 'Vintage'),
  preset('floral', 'Rose garden', 'Floral', '#526b53', '#df93a3'),
  preset('botanical', 'Botanical', 'Floral', '#526b53', '#df93a3'),
  preset('wildflower', 'Wildflowers', 'Floral', '#688063', '#e7bb72', 5),
  preset('blossom', 'Blossom wreath', 'Floral', '#657c62', '#ebabc0', 5),
  preset('sketch', 'Hand drawn', 'Hand drawn', '#526b53'),
  preset('doodle', 'Doodle stars', 'Hand drawn', '#526b53', '#df93a3'),
  preset('scribble', 'Artist sketch', 'Hand drawn', '#172033', '#df93a3', 5),
  preset('stitch', 'Stitched border', 'Hand drawn', '#ffffff', '#172033', 5),
  preset('torn', 'Deckled paper', 'Vintage', '#f8f0de', '#d8cbb5', 5),
  preset('stamp', 'Postage stamp', 'Vintage', '#fff8ea', '#aa957a', 5),
  preset('polaroid', 'Instant photo', 'Minimal', '#fffdf8', '#d4b477', 8),
  preset('film', 'Film strip', 'Vintage', '#181818', '#fff4d9', 7),
  preset('double', 'Fine double', 'Minimal', '#ffffff'),
  preset('rounded', 'Rounded mat', 'Minimal', '#ffffff', '#d4b477', 5),
  preset('gallery', 'Gallery mat', 'Minimal', '#f9f5ee', '#a68a65', 8),
  preset('clean', 'Classic border', 'Minimal', '#ffffff')
];

function cornerTransforms(ctx, width, height, draw) {
  [[0, 0, 1, 1], [width, 0, -1, 1], [0, height, 1, -1], [width, height, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); draw(); ctx.restore();
  });
}

function scroll(ctx, band, elaborate) {
  ctx.beginPath();
  ctx.moveTo(band * .7, band * 4.5);
  ctx.bezierCurveTo(-band * .2, band * 2.5, band * 1.4, band * .6, band * 3.8, band * .7);
  ctx.bezierCurveTo(band * 2.4, band * .1, band * .7, band * .2, band * .8, band * 1.9);
  ctx.bezierCurveTo(band * .9, band * 3, band * 2.7, band * 2.6, band * 2.1, band * 1.5);
  ctx.bezierCurveTo(band * 1.9, band, band * 1.2, band * 1.4, band * 1.5, band * 1.8);
  ctx.stroke();
  ctx.save(); ctx.transform(0, 1, 1, 0, 0, 0);
  ctx.beginPath(); ctx.moveTo(band * .7, band * 4.5);
  ctx.bezierCurveTo(band * .1, band * 3.1, band * .6, band * 2.8, band * 1.7, band * 3.2);
  ctx.bezierCurveTo(band * 3.6, band * 4.1, band * 3.4, band * 1.9, band * 2.5, band * 2);
  ctx.bezierCurveTo(band * 1.6, band * 2.1, band * 2.3, band * 3.1, band * 2.7, band * 2.6);
  ctx.stroke(); ctx.restore();
  if (elaborate) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(band * (1.1 + i * .42), band * (3.3 + i * .4), band * .23, band * .55, -.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(band * (3.3 + i * .4), band * (1.1 + i * .42), band * .55, band * .23, -.7, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.beginPath(); ctx.moveTo(band * .4, band * .8);
  ctx.quadraticCurveTo(band * 1.3, band * .8, band * 1.2, band * 1.5);
  ctx.quadraticCurveTo(band * .4, band * 1.5, band * .4, band * .8); ctx.fill();
}

// Returns false for the original frame styles, which are rendered by the main renderer.
export function drawExtraFrame(ctx, w, h, frame) {
  const styles = ['ornate', 'nouveau', 'victorian', 'deco', 'antique', 'cameo', 'scallop', 'wildflower', 'blossom', 'scribble', 'stitch', 'torn', 'stamp', 'polaroid', 'film', 'rounded', 'gallery'];
  if (!styles.includes(frame.style)) return false;
  const s = Math.min(w, h), b = s * frame.width / 100, inset = b * .65;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = frame.color;
  ctx.lineWidth = Math.max(.6, s * .0025); ctx.lineJoin = ctx.lineCap = 'round';
  const rectangle = (offset, radius = 0) => { ctx.beginPath(); ctx.roundRect(offset, offset, w - 2 * offset, h - 2 * offset, radius); ctx.stroke(); };
  if (['ornate', 'nouveau', 'victorian'].includes(frame.style)) {
    rectangle(inset, b * (frame.style === 'nouveau' ? 3.5 : 2));
    ctx.lineWidth *= .5; rectangle(inset + b * .19, b * 2);
    ctx.lineWidth = Math.max(.8, s * .0035);
    cornerTransforms(ctx, w, h, () => scroll(ctx, b, frame.style === 'victorian'));
    if (frame.style === 'nouveau') {
      cornerTransforms(ctx, w, h, () => {
        ctx.beginPath(); ctx.moveTo(b * .8, b * 5); ctx.bezierCurveTo(b * 2.8, b * 3.6, b * .2, b * .3, b * 5, b * .8); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(b * 2.1, b * 2.1, b * .3, b * .85, -.8, 0, Math.PI * 2); ctx.fill();
      });
    }
  } else if (frame.style === 'deco') {
    rectangle(b * .45); rectangle(b * .7);
    cornerTransforms(ctx, w, h, () => {
      for (let i = 0; i < 4; i++) {
        const d = b * (.95 + i * .28);
        ctx.beginPath(); ctx.moveTo(b * .45, d + b); ctx.lineTo(d, d); ctx.lineTo(d + b, b * .45); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(b, b * 2); ctx.lineTo(b * 2, b); ctx.lineTo(b * 3, b * 2); ctx.lineTo(b * 2, b * 3); ctx.closePath(); ctx.stroke();
    });
  } else if (frame.style === 'antique') {
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = i % 3 === 0 ? frame.accent : frame.color;
      ctx.lineWidth = b / 12 + .5; rectangle(b * (i + .5) / 12);
    }
    ctx.strokeStyle = frame.accent; cornerTransforms(ctx, w, h, () => scroll(ctx, b * .65, true));
  } else if (frame.style === 'cameo') {
    ctx.lineWidth = b * .1;
    [0, b * .15].forEach(d => { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - b - d, h / 2 - b - d, 0, 0, Math.PI * 2); ctx.stroke(); });
    cornerTransforms(ctx, w, h, () => scroll(ctx, b * .7, false));
  } else if (frame.style === 'scallop' || frame.style === 'stamp') {
    const step = Math.max(3, b * .4);
    if (frame.style === 'stamp') { ctx.lineWidth = b * .6; rectangle(b * .3); }
    rectangle(b * .85, frame.style === 'scallop' ? b : 0);
    for (let x = b; x < w - b; x += step) {
      [b * .43, h - b * .43].forEach(y => { ctx.beginPath(); ctx.arc(x, y, step * .36, 0, Math.PI * 2); frame.style === 'stamp' ? ctx.fill() : ctx.stroke(); });
    }
    for (let y = b; y < h - b; y += step) {
      [b * .43, w - b * .43].forEach(x => { ctx.beginPath(); ctx.arc(x, y, step * .36, 0, Math.PI * 2); frame.style === 'stamp' ? ctx.fill() : ctx.stroke(); });
    }
  } else if (frame.style === 'wildflower' || frame.style === 'blossom') {
    rectangle(b * .5, b);
    const blossom = (x, y, size) => {
      ctx.fillStyle = frame.accent;
      for (let p = 0; p < 5; p++) { const angle = p * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(x + Math.cos(angle) * size * .5, y + Math.sin(angle) * size * .5, size * .5, size * .25, angle, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(x, y, size * .2, 0, Math.PI * 2); ctx.fill();
    };
    if (frame.style === 'blossom') {
      for (let x = b * 1.5; x < w - b; x += b * 1.2) { blossom(x, b * .55, b * .43); blossom(x, h - b * .55, b * .43); }
      for (let y = b * 1.5; y < h - b; y += b * 1.2) { blossom(b * .55, y, b * .43); blossom(w - b * .55, y, b * .43); }
    } else cornerTransforms(ctx, w, h, () => {
      for (let i = 0; i < 5; i++) {
        const x = b * (.7 + i * .65), y = b * (.9 + i % 2 * .5);
        ctx.strokeStyle = frame.color; ctx.beginPath(); ctx.moveTo(x, b * 2.8); ctx.quadraticCurveTo(x - b * .3, b, x, y); ctx.stroke(); blossom(x, y, b * .4);
      }
    });
  } else if (frame.style === 'scribble') {
    for (let n = 0; n < 4; n++) {
      ctx.globalAlpha = .7 - n * .13;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const t = i / 40, edge = Math.min(3, Math.floor(t)), f = t - edge;
        const jitter = Math.sin(i * 1.7 + n) * b * .12;
        const points = [[b + f * (w - b * 2), b + jitter], [w - b + jitter, b + f * (h - b * 2)], [w - b - f * (w - b * 2), h - b + jitter], [b + jitter, h - b - f * (h - b * 2)]];
        const [x, y] = points[edge]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (frame.style === 'stitch') {
    ctx.lineWidth = b * .2; rectangle(b * .4);
    ctx.strokeStyle = frame.accent; ctx.lineWidth = s * .002;
    ctx.setLineDash([b * .18, b * .14]); rectangle(b * .4); ctx.setLineDash([]);
  } else if (frame.style === 'torn') {
    // A deterministic deckled edge: no random differences between preview and export.
    cornerTransforms(ctx, w, h, () => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, 0);
      for (let x = w / 2; x >= 0; x -= Math.max(1, s / 150)) ctx.lineTo(x, b * (.6 + .14 * Math.sin(x / s * 167) + .09 * Math.cos(x / s * 313)));
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h / 2);
      for (let y = h / 2; y >= 0; y -= Math.max(1, s / 150)) ctx.lineTo(b * (.6 + .14 * Math.sin(y / s * 167) + .09 * Math.cos(y / s * 313)), y);
      ctx.closePath(); ctx.fill();
    });
  } else if (frame.style === 'polaroid' || frame.style === 'gallery' || frame.style === 'film') {
    ctx.fillRect(0, 0, w, b); ctx.fillRect(0, h - b, w, b); ctx.fillRect(0, 0, b, h); ctx.fillRect(w - b, 0, b, h);
    if (frame.style === 'polaroid') ctx.fillRect(0, h - b * 2.5, w, b * 2.5);
    if (frame.style === 'gallery') { ctx.strokeStyle = frame.accent; ctx.lineWidth = s * .002; rectangle(b * 1.08); }
    if (frame.style === 'film') {
      ctx.fillStyle = frame.accent;
      for (let y = b * .5; y < h - b; y += b * 1.05) [b * .22, w - b * .78].forEach(x => { ctx.beginPath(); ctx.roundRect(x, y, b * .56, b * .65, b * .09); ctx.fill(); });
    }
  } else if (frame.style === 'rounded') { ctx.lineWidth = b; rectangle(b / 2, b * 1.3); }
  ctx.restore(); return true;
}
