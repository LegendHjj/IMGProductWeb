export function emptyPhotoEdits() {
  return { crop: null, texts: [], blurs: [], frame: { style: 'none', color: '#526b53', accent: '#df93a3', width: 7 } };
}

export function photoViewport(width, height, edits) {
  return edits.crop || { x: 0, y: 0, width, height };
}

export function previewPhotoEdits(edits, selection, radius, tool) {
  return tool === 'blur' && selection
    ? { ...edits, blurs: [...edits.blurs, { ...selection, radius }] } : edits;
}

export function cropSelection(start, end, viewport, ratio = 0) {
  const sx = Math.min(viewport.x + viewport.width, Math.max(viewport.x, start.x));
  const sy = Math.min(viewport.y + viewport.height, Math.max(viewport.y, start.y));
  const dx = end.x >= sx ? 1 : -1;
  const dy = end.y >= sy ? 1 : -1;
  const maxW = dx > 0 ? viewport.x + viewport.width - sx : sx - viewport.x;
  const maxH = dy > 0 ? viewport.y + viewport.height - sy : sy - viewport.y;
  let w = Math.min(Math.abs(end.x - sx), maxW);
  let h = Math.min(Math.abs(end.y - sy), maxH);
  if (ratio) {
    w = Math.min(Math.max(w, h * ratio), maxW, maxH * ratio);
    h = w / ratio;
  }
  const x = Math.round(dx > 0 ? sx : sx - w);
  const y = Math.round(dy > 0 ? sy : sy - h);
  w = Math.min(Math.round(w), viewport.x + viewport.width - x);
  h = Math.min(Math.round(h), viewport.y + viewport.height - y);
  return w >= 2 && h >= 2 ? { x, y, width: w, height: h } : null;
}

export function previewToImagePoint(clientX, clientY, rect, width, height) {
  return {
    x: Math.min(width, Math.max(0, (clientX - rect.left) / rect.width * width)),
    y: Math.min(height, Math.max(0, (clientY - rect.top) / rect.height * height))
  };
}

export function normalizeBlurRect(start, end, width, height) {
  const left = Math.max(0, Math.min(width, Math.min(start.x, end.x)));
  const top = Math.max(0, Math.min(height, Math.min(start.y, end.y)));
  const right = Math.max(0, Math.min(width, Math.max(start.x, end.x)));
  const bottom = Math.max(0, Math.min(height, Math.max(start.y, end.y)));
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function pointInTextBounds(point, layer, bounds) {
  const angle = -(layer.rotation || 0) * Math.PI / 180;
  const dx = point.x - layer.x;
  const dy = point.y - layer.y;
  const x = dx * Math.cos(angle) - dy * Math.sin(angle);
  const y = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(x) <= bounds.width / 2 && Math.abs(y) <= bounds.height / 2;
}

export function createPhotoHistory(initial, limit = 40) {
  const snapshots = [structuredClone(initial)];
  let index = 0;
  return {
    commit(state) {
      if (JSON.stringify(snapshots[index]) === JSON.stringify(state)) return;
      snapshots.splice(index + 1);
      snapshots.push(structuredClone(state));
      if (snapshots.length > limit) snapshots.shift();
      index = snapshots.length - 1;
    },
    undo() { if (index > 0) index--; return structuredClone(snapshots[index]); },
    redo() { if (index < snapshots.length - 1) index++; return structuredClone(snapshots[index]); },
    canUndo: () => index > 0,
    canRedo: () => index < snapshots.length - 1
  };
}

const ORIGINAL_TEXT_PRESETS = {
  modern: { font: 'Arial', weight: '700', color: '#ffffff', outline: false, shadow: true, background: false, italic: false },
  editorial: { font: 'Playfair Display', weight: '700', color: '#fff8e8', outline: false, shadow: true, background: false, italic: false },
  handwritten: { font: 'Dancing Script', weight: '700', color: '#ffffff', outline: false, shadow: true, background: false, italic: false },
  poster: { font: 'Bebas Neue', weight: '400', color: '#ffffff', outline: true, shadow: false, background: false, italic: false },
  label: { font: 'Arial', weight: '700', color: '#ffffff', outline: false, shadow: false, background: true, italic: false },
  vintage: { font: 'Georgia', weight: '700', color: '#ffde91', outline: false, shadow: true, background: false, italic: true }
};

const textStyle = (id, name, category, settings = {}) => ({ id, name, category, settings });
export const TEXT_STYLES = [
  textStyle('modern', 'Modern', 'Headlines', ORIGINAL_TEXT_PRESETS.modern),
  textStyle('editorial', 'Editorial', 'Elegant', ORIGINAL_TEXT_PRESETS.editorial),
  textStyle('handwritten', 'Handwritten', 'Script', ORIGINAL_TEXT_PRESETS.handwritten),
  textStyle('poster', 'Poster', 'Headlines', ORIGINAL_TEXT_PRESETS.poster),
  textStyle('label', 'Label', 'Labels', ORIGINAL_TEXT_PRESETS.label),
  textStyle('vintage', 'Vintage', 'Elegant', ORIGINAL_TEXT_PRESETS.vintage),
  textStyle('impact', 'Impact', 'Headlines', { font: 'Impact', weight: '400', color: '#fff1d1', outline: true, outlineColor: '#d94e43' }),
  textStyle('condensed', 'Bold condensed', 'Headlines', { font: 'Bebas Neue', weight: '400', color: '#d94536' }),
  textStyle('minimal', 'Minimal', 'Elegant', { weight: '400', color: '#253239' }),
  textStyle('luxury', 'Luxury gold', 'Elegant', { font: 'Playfair Display', color: '#e6c779', shadow: true, shadowColor: '#392813' }),
  textStyle('fashion', 'Fashion', 'Elegant', { font: 'Playfair Display', weight: '400', italic: true, color: '#282329' }),
  textStyle('classic', 'Classic serif', 'Elegant', { font: 'Georgia', weight: '400', color: '#913d45' }),
  textStyle('signature', 'Signature', 'Script', { font: 'Dancing Script', weight: '400', color: '#306052' }),
  textStyle('brush', 'Sweet script', 'Script', { font: 'Dancing Script', color: '#d95876', shadow: true, shadowColor: '#f6cad5' }),
  textStyle('typewriter', 'Typewriter', 'Elegant', { font: 'Courier New', color: '#6c4c39' }),
  textStyle('retro', 'Retro offset', 'Effects', { color: '#fff0bf', effect: 'offset', effectColor: '#cc6950' }),
  textStyle('pop', 'Pop art', 'Headlines', { font: 'Impact', weight: '400', color: '#ffe566', outline: true, outlineColor: '#242638', outlineWidth: .09 }),
  textStyle('neon', 'Neon glow', 'Effects', { color: '#ffffff', effect: 'glow', effectColor: '#15dacd' }),
  textStyle('sunset', 'Sunset gradient', 'Effects', { font: 'Bebas Neue', weight: '400', color: '#f6ae46', effect: 'gradient', effectColor: '#df4089' }),
  textStyle('ocean', 'Ocean gradient', 'Effects', { color: '#53c6c1', effect: 'gradient', effectColor: '#3444a8' }),
  textStyle('hollow', 'Outline only', 'Effects', { color: '#172033', outline: true, effect: 'hollow', outlineColor: '#172033', outlineWidth: .025 }),
  textStyle('sticker', 'Sticker', 'Effects', { color: '#ed5848', outline: true, outlineColor: '#ffffff', outlineWidth: .13, shadow: true }),
  textStyle('badge', 'Product badge', 'Labels', { font: 'Bebas Neue', weight: '400', color: '#ffffff', background: true, backgroundColor: '#2c5873' }),
  textStyle('soft', 'Soft caption', 'Labels', { color: '#735a9c', background: true, backgroundColor: '#f3eefb', shadow: false })
];

const STYLE_DEFAULTS = { font: 'Arial', weight: '700', color: '#ffffff', outline: false, shadow: false, background: false, italic: false, outlineColor: '#172033', backgroundColor: '#172033', shadowColor: 'rgba(0,0,0,0.65)', effect: 'none', effectColor: '#15dacd', outlineWidth: .065 };
export const TEXT_PRESETS = Object.fromEntries(TEXT_STYLES.map(style => [style.id, { ...STYLE_DEFAULTS, ...style.settings, styleId: style.id }]));

export function applyPhotoTextStyle(layer, preset) {
  if (TEXT_PRESETS[preset]) Object.assign(layer, TEXT_PRESETS[preset]);
  return layer;
}

export function makePhotoText(id, width, height, preset = 'modern') {
  return { id, text: 'Your text', x: width / 2, y: height / 2, size: Math.max(12, Math.round(Math.min(width, height) * 0.09)), rotation: 0, opacity: 100, outlineColor: '#172033', backgroundColor: '#172033', ...TEXT_PRESETS[preset] };
}
