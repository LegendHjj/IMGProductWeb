import './photo-editor.css';
import '@fontsource/dancing-script/latin-400.css';
import '@fontsource/dancing-script/latin-700.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/bebas-neue/latin-400.css';
import { createPhotoHistory, emptyPhotoEdits, makePhotoText, normalizeBlurRect, pointInTextBounds, previewToImagePoint, TEXT_STYLES, applyPhotoTextStyle, photoViewport, cropSelection, previewPhotoEdits } from './photo-editor-model.js';
import { PHOTO_FRAMES } from './photo-editor-frames.js';
import { TEXT_LAYOUTS, makeTextLayout } from './photo-editor-layouts.js';
import { drawPhotoFrame, photoTextBounds, renderPhotoEdits } from './photo-editor-render.js';
import { formatBytes } from './utils.js';

export function initPhotoEditor() {
  const el = name => document.getElementById(`photo-${name}`);
  const canvas = el('canvas');
  const overlay = el('overlay');
  const context = canvas.getContext('2d');
  const overlayContext = overlay.getContext('2d');
  let image;
  let sourceFile;
  let sourceUrl;
  let edits = emptyPhotoEdits();
  let history = createPhotoHistory(edits);
  let selectedId = null;
  let tool = 'text';
  let selection = null;
  let crop = null;
  let drag = null;
  let generation = 0;
  let exporting = false;

  const selectedText = () => edits.texts.find(layer => layer.id === selectedId);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const newId = () => crypto.randomUUID();
  const viewport = () => photoViewport(image.naturalWidth, image.naturalHeight, edits);

  function sizePreview() {
    const view = viewport();
    const scale = Math.min(1400 / view.width, 1000 / view.height);
    const w = Math.round(view.width * scale), h = Math.round(view.height * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = overlay.width = w; canvas.height = overlay.height = h;
    }
    el('stage').style.aspectRatio = `${view.width} / ${view.height}`;
    el('stage').style.width = `min(100%, 900px, ${60 * view.width / view.height}vh)`;
    el('meta').textContent = `${view.width} × ${view.height} px${edits.crop ? ' · cropped' : ''} · ${formatBytes(sourceFile.size)}`;
  }

  function renderOverlay() {
    overlayContext.setTransform(1, 0, 0, 1, 0, 0);
    overlayContext.clearRect(0, 0, overlay.width, overlay.height);
    if (!image) return;
    const view = viewport();
    const scale = overlay.width / view.width;
    overlayContext.save();
    overlayContext.scale(scale, scale);
    overlayContext.translate(-view.x, -view.y);
    overlayContext.lineWidth = 1.5 / scale;
    overlayContext.setLineDash([5 / scale, 4 / scale]);
    if (tool === 'text' && selectedText()) {
      const layer = selectedText();
      const bounds = photoTextBounds(context, layer);
      overlayContext.translate(layer.x, layer.y);
      overlayContext.rotate(layer.rotation * Math.PI / 180);
      overlayContext.strokeStyle = '#ffffff';
      overlayContext.shadowColor = '#172033';
      overlayContext.shadowBlur = 2;
      overlayContext.strokeRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
      overlayContext.shadowBlur = 0;
    } else if (tool === 'blur') {
      overlayContext.strokeStyle = '#0a8b80';
      edits.blurs.forEach(area => overlayContext.strokeRect(area.x, area.y, area.width, area.height));
      if (selection) {
        overlayContext.strokeStyle = '#e7483b';
        overlayContext.strokeRect(selection.x, selection.y, selection.width, selection.height);
      }
    } else if (tool === 'crop' && crop) {
      overlayContext.fillStyle = '#17203399';
      overlayContext.beginPath();
      overlayContext.rect(view.x, view.y, view.width, view.height);
      overlayContext.rect(crop.x, crop.y, crop.width, crop.height);
      overlayContext.fill('evenodd');
      overlayContext.strokeStyle = '#ffffff';
      overlayContext.strokeRect(crop.x, crop.y, crop.width, crop.height);
      overlayContext.setLineDash([]);
      overlayContext.globalAlpha = .65;
      for (let i = 1; i <= 2; i++) {
        overlayContext.beginPath();
        overlayContext.moveTo(crop.x + crop.width * i / 3, crop.y); overlayContext.lineTo(crop.x + crop.width * i / 3, crop.y + crop.height);
        overlayContext.moveTo(crop.x, crop.y + crop.height * i / 3); overlayContext.lineTo(crop.x + crop.width, crop.y + crop.height * i / 3);
        overlayContext.stroke();
      }
      overlayContext.globalAlpha = 1; overlayContext.fillStyle = '#ffffff';
      const handle = 8 / scale;
      [[crop.x, crop.y], [crop.x + crop.width, crop.y], [crop.x, crop.y + crop.height], [crop.x + crop.width, crop.y + crop.height]].forEach(([x, y]) => overlayContext.fillRect(x - handle / 2, y - handle / 2, handle, handle));
    }
    overlayContext.restore();
  }

  function render() {
    if (!image) return;
    sizePreview();
    const preview = previewPhotoEdits(edits, selection, Number(el('blurStrength').value), tool);
    const visible = tool === 'blur' && el('showUnblurred').checked ? { ...edits, blurs: [] } : preview;
    renderPhotoEdits(context, image, visible, canvas.width, canvas.height);
    renderOverlay();
    el('undo').disabled = !history.canUndo();
    el('redo').disabled = !history.canRedo();
    document.querySelectorAll('[data-photo-frame]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.photoFrame === edits.frame.style)));
    document.querySelectorAll('[data-photo-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.photoPreset === selectedText()?.styleId)));
  }

  function commit() { history.commit(edits); render(); }

  function ensureFont(layer) {
    document.fonts.load(`${layer.italic ? 'italic ' : ''}${layer.weight} ${layer.size}px "${layer.font}"`, layer.text || 'Aa').then(render).catch(() => {
      el('status').textContent = 'This font could not load. Another font can be selected.';
    });
  }

  function syncTextControls(selectLast = true) {
    if (!selectedText() && selectLast) selectedId = edits.texts.at(-1)?.id || null;
    const layer = selectedText();
    const select = el('layerSelect');
    select.replaceChildren();
    if (!edits.texts.length) select.add(new Option('No text layers yet', ''));
    else if (!layer) select.add(new Option('Select a text layer', ''));
    edits.texts.forEach((item, index) => select.add(new Option(`${index + 1}. ${item.text.slice(0, 35).replace(/\n/g, ' ') || 'Empty text'}`, item.id)));
    select.value = selectedId || '';
    select.disabled = !edits.texts.length;
    el('textSettings').disabled = !layer;
    el('moveGroup').closest('label').hidden = !layer?.groupId;
    if (!layer) return;
    el('textSettings').querySelectorAll('[data-text-prop]').forEach(input => {
      const value = layer[input.dataset.textProp];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    });
    el('bold').checked = layer.weight === '700';
    el('rotationValue').textContent = `${layer.rotation}°`;
    el('opacityValue').textContent = `${layer.opacity}%`;
    ensureFont(layer);
  }

  function updateSelection() {
    el('applyBlur').disabled = !selection;
    el('clearSelection').disabled = !selection;
    el('selectionInfo').textContent = selection
      ? `Live preview · ${Math.round(selection.width)} × ${Math.round(selection.height)} px. Click Apply to keep this blur.`
      : 'No area selected';
    el('selectionInfo').dataset.preview = String(!!selection);
    // Pending previews must be accepted or cancelled before downloading.
    el('download').disabled = exporting || !!selection || !!crop;
  }

  function updateCrop() {
    el('applyCrop').disabled = el('clearCrop').disabled = el('cropSettings').disabled = !crop;
    el('resetCrop').disabled = !edits.crop;
    el('cropInfo').textContent = crop ? `${crop.width} × ${crop.height} px · crop preview` : 'Drag on the photo to select a crop';
    el('cropInfo').dataset.preview = String(!!crop);
    if (crop) el('cropSettings').querySelectorAll('[data-crop-prop]').forEach(input => { input.value = crop[input.dataset.cropProp]; });
    updateSelection();
  }

  function updateBlurList() {
    const list = el('blurList');
    list.replaceChildren();
    if (!edits.blurs.length) {
      const note = document.createElement('p');
      note.className = 'photo-small-note'; note.textContent = 'No blur areas yet.';
      list.appendChild(note);
    }
    edits.blurs.forEach((area, index) => {
      const row = document.createElement('div'); row.className = 'photo-blur-row';
      const label = document.createElement('span'); label.textContent = `Area ${index + 1} · ${area.radius}px blur`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove blur area ${index + 1}`);
      remove.addEventListener('click', () => {
        edits.blurs = edits.blurs.filter(item => item.id !== area.id);
        commit(); updateBlurList(); el('status').textContent = 'Blur area removed.';
      });
      row.append(label, remove); list.appendChild(row);
    });
  }

  function syncAll() {
    selection = null; crop = null;
    syncTextControls(); updateBlurList(); updateSelection();
    updateCrop();
    el('frameColor').value = edits.frame.color;
    el('frameAccent').value = edits.frame.accent;
    el('frameWidth').value = edits.frame.width;
    el('frameWidthValue').textContent = `${edits.frame.width}%`;
    render();
  }

  function switchTool(nextTool) {
    selection = null; crop = null; drag = null;
    el('showUnblurred').checked = false;
    tool = nextTool;
    document.querySelectorAll('[data-photo-tool]').forEach(button => {
      const active = button.dataset.photoTool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      el(`tool-${button.dataset.photoTool}`).classList.toggle('hidden', !active);
    });
    overlay.style.cursor = tool === 'blur' || tool === 'crop' ? 'crosshair' : 'default';
    el('hint').textContent = tool === 'blur'
      ? 'Drag an area to preview blur live. Adjust strength, then Apply to keep it.'
      : tool === 'crop' ? 'Drag to choose a crop. Use the fields to refine it, then Apply crop.'
      : tool === 'frames' ? 'Choose a frame and customize its colors and size.' : 'Drag a text layer or layout to move it. Use arrow keys for fine positioning.';
    updateCrop(); render();
  }

  async function loadFile(file) {
    const error = !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'Choose a JPG, PNG, or WEBP image.'
      : !file.size ? 'The selected image is empty.' : file.size > 50 * 1024 * 1024 ? 'Choose an image smaller than 50MB.' : null;
    const report = message => {
      if (!image) el('dropzone').querySelector('.dropzone-formats').textContent = message;
      else el('status').textContent = message;
    };
    if (error) { report(error); return; }
    const request = ++generation;
    const candidateUrl = URL.createObjectURL(file);
    const candidate = new Image(); candidate.src = candidateUrl;
    report('Opening your photo…');
    try {
      await candidate.decode();
      if (request !== generation) { URL.revokeObjectURL(candidateUrl); return; }
      if (candidate.naturalWidth * candidate.naturalHeight > 32000000 || Math.max(candidate.naturalWidth, candidate.naturalHeight) > 8192) {
        throw new Error('Choose a photo up to 32 megapixels and 8192 pixels per side.');
      }
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = candidateUrl; image = candidate; sourceFile = file;
      edits = emptyPhotoEdits(); history = createPhotoHistory(edits); selectedId = null; selection = null; crop = null; drag = null;
      const ratio = image.naturalWidth / image.naturalHeight;
      const previewScale = Math.min(1400 / image.naturalWidth, 1000 / image.naturalHeight);
      canvas.width = overlay.width = Math.round(image.naturalWidth * previewScale);
      canvas.height = overlay.height = Math.round(image.naturalHeight * previewScale);
      el('stage').style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      el('stage').style.width = `min(100%, 900px, ${60 * ratio}vh)`;
      el('fileName').textContent = file.name;
      el('meta').textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${formatBytes(file.size)}`;
      el('dropzone').classList.add('panel-hidden'); el('editor').classList.remove('panel-hidden');
      switchTool('text'); syncAll();
      el('status').textContent = 'Ready to edit. Your photo stays in this browser.';
    } catch (err) {
      URL.revokeObjectURL(candidateUrl);
      if (request === generation) report(err.message.startsWith('Choose') ? err.message : 'Could not open this image. Try another JPG, PNG, or WEBP.');
    }
  }

  function addText(preset = 'modern') {
    if (!image) return;
    if (edits.texts.length >= 25) { el('status').textContent = 'Up to 25 text layers can be added to a photo.'; return; }
    const layer = makePhotoText(newId(), image.naturalWidth, image.naturalHeight, preset);
    const view = viewport(); layer.x = view.x + view.width / 2; layer.y = view.y + view.height / 2; layer.size = Math.max(8, Math.round(Math.min(view.width, view.height) * .09));
    edits.texts.push(layer); selectedId = layer.id;
    switchTool('text'); commit(); syncTextControls();
    el('status').textContent = 'Text added. Edit the words or drag the layer on the photo.';
  }

  function deleteText() {
    if (!selectedText()) return;
    edits.texts = edits.texts.filter(layer => layer.id !== selectedId);
    selectedId = null; commit(); syncTextControls();
  }

  document.querySelectorAll('[data-photo-tool]').forEach(button => {
    button.addEventListener('click', () => switchTool(button.dataset.photoTool));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...document.querySelectorAll('[data-photo-tool]')];
      const index = (buttons.indexOf(button) + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      switchTool(buttons[index].dataset.photoTool); buttons[index].focus();
    });
  });
  el('textPresets').addEventListener('click', event => {
    const button = event.target.closest('[data-photo-preset]');
    if (!button) return;
    if (!selectedText()) { addText(button.dataset.photoPreset); return; }
    applyPhotoTextStyle(selectedText(), button.dataset.photoPreset);
    commit(); syncTextControls();
    el('status').textContent = `${TEXT_STYLES.find(style => style.id === button.dataset.photoPreset).name} style applied. Your words and position are kept.`;
  });
  el('styleCategory').addEventListener('change', () => {
    el('textPresets').querySelectorAll('button').forEach(button => { button.hidden = el('styleCategory').value !== 'All' && button.dataset.category !== el('styleCategory').value; });
  });
  el('addText').addEventListener('click', () => addText());
  el('deleteText').addEventListener('click', deleteText);
  el('duplicateText').addEventListener('click', () => {
    const selected = selectedText();
    if (!selected || edits.texts.length >= 25) return;
    const copy = { ...selected, groupId: undefined, id: newId(), x: clamp(selected.x + image.naturalWidth * 0.03, 0, image.naturalWidth), y: clamp(selected.y + image.naturalHeight * 0.03, 0, image.naturalHeight) };
    edits.texts.push(copy); selectedId = copy.id; commit(); syncTextControls();
  });
  el('layerSelect').addEventListener('change', () => { selectedId = el('layerSelect').value; syncTextControls(); renderOverlay(); });

  function updateText(event) {
    const layer = selectedText(); const input = event.target;
    if (!layer) return;
    if (input.id === 'photo-bold') layer.weight = input.checked ? '700' : '400';
    else if (input.dataset.textProp) {
      const prop = input.dataset.textProp;
      layer[prop] = input.type === 'checkbox' ? input.checked
        : ['size', 'rotation', 'opacity'].includes(prop) ? clamp(Number(input.value), prop === 'size' ? 8 : prop === 'opacity' ? 10 : -180, prop === 'size' ? 4000 : prop === 'opacity' ? 100 : 180)
        : input.value;
    } else return;
    if (input.dataset.textProp === 'effect' && layer.effect === 'hollow') layer.outline = true;
    el('rotationValue').textContent = `${layer.rotation}°`;
    el('opacityValue').textContent = `${layer.opacity}%`;
    const option = [...el('layerSelect').options].find(item => item.value === selectedId);
    if (option) option.textContent = `${edits.texts.indexOf(layer) + 1}. ${layer.text.slice(0, 35).replace(/\n/g, ' ') || 'Empty text'}`;
    render();
    if (['font', 'italic'].includes(input.dataset.textProp) || input.id === 'photo-bold') ensureFont(layer);
  }
  el('textSettings').addEventListener('input', updateText);
  el('textSettings').addEventListener('change', event => { updateText(event); commit(); });

  PHOTO_FRAMES.forEach(frame => {
    const { style, name, category } = frame;
    const thumb = document.createElement('canvas'); thumb.width = 180; thumb.height = 120;
    const ctx = thumb.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 180, 120); gradient.addColorStop(0, '#788c91'); gradient.addColorStop(1, '#c0ad91');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 180, 120);
    ctx.fillStyle = '#6f7e6c'; ctx.beginPath(); ctx.moveTo(0, 105); ctx.bezierCurveTo(60, 30, 100, 150, 180, 60); ctx.lineTo(180, 120); ctx.lineTo(0, 120); ctx.fill();
    drawPhotoFrame(ctx, 180, 120, frame);
    const button = document.createElement('button'); button.type = 'button'; button.dataset.photoFrame = style;
    button.dataset.category = category;
    button.setAttribute('aria-pressed', String(style === 'none'));
    const thumbnail = document.createElement('img'); thumbnail.src = thumb.toDataURL(); thumbnail.alt = ''; thumbnail.width = 180; thumbnail.height = 120;
    const label = document.createElement('span'); label.textContent = name;
    button.append(thumbnail, label); el('framePresets').appendChild(button);
    button.addEventListener('click', () => {
      edits.frame = { style, color: frame.color, accent: frame.accent, width: frame.width };
      commit(); syncAll(); el('status').textContent = style === 'none' ? 'Frame removed.' : `${name} frame applied.`;
    });
  });
  el('frameCategory').addEventListener('change', () => {
    el('framePresets').querySelectorAll('button').forEach(button => { button.hidden = el('frameCategory').value !== 'All' && button.dataset.category !== el('frameCategory').value; });
  });

  async function buildLayoutGallery() {
    await Promise.all(['700 24px "Playfair Display"', '700 24px "Dancing Script"', '400 24px "Bebas Neue"'].map(font => document.fonts.load(font)));
    for (const style of TEXT_STYLES) {
      const thumb = document.createElement('canvas'); thumb.width = 240; thumb.height = 120;
      const background = document.createElement('canvas'); background.width = 240; background.height = 120;
      const bg = background.getContext('2d');
      bg.fillStyle = ['modern', 'editorial', 'handwritten', 'poster', 'vintage', 'luxury', 'retro', 'neon'].includes(style.id) ? '#293b37' : '#faf7f1';
      bg.fillRect(0, 0, 240, 120);
      const layer = makePhotoText(newId(), 240, 120, style.id); layer.text = style.name; layer.size = 36;
      const bounds = photoTextBounds(thumb.getContext('2d'), layer);
      layer.size *= Math.min(1, 206 / bounds.width);
      renderPhotoEdits(thumb.getContext('2d'), background, { ...emptyPhotoEdits(), texts: [layer] }, 240, 120);
      const button = document.createElement('button'); button.type = 'button'; button.dataset.photoPreset = style.id; button.dataset.category = style.category;
      button.setAttribute('aria-pressed', 'false');
      const thumbnail = document.createElement('img'); thumbnail.src = thumb.toDataURL(); thumbnail.alt = ''; thumbnail.width = 240; thumbnail.height = 120;
      const label = document.createElement('span'); label.textContent = style.name;
      button.append(thumbnail, label); el('textPresets').appendChild(button);
    }
    for (const layout of TEXT_LAYOUTS) {
      const thumb = document.createElement('canvas'); thumb.width = 240; thumb.height = 180;
      const background = document.createElement('canvas'); background.width = 240; background.height = 180;
      const bg = background.getContext('2d'); bg.fillStyle = layout.id === 'luxury' ? '#293b37' : '#faf7f1'; bg.fillRect(0, 0, 240, 180);
      const layers = makeTextLayout(layout.id, { x: 0, y: 0, width: 240, height: 180 }, newId);
      const boxes = layers.map(layer => ({ layer, bounds: photoTextBounds(thumb.getContext('2d'), layer) }));
      const left = Math.min(...boxes.map(({ layer, bounds }) => layer.x - bounds.width / 2));
      const right = Math.max(...boxes.map(({ layer, bounds }) => layer.x + bounds.width / 2));
      const top = Math.min(...boxes.map(({ layer, bounds }) => layer.y - bounds.height / 2));
      const bottom = Math.max(...boxes.map(({ layer, bounds }) => layer.y + bounds.height / 2));
      const zoom = Math.min(204 / (right - left), 144 / (bottom - top));
      layers.forEach(layer => {
        layer.x = 120 + (layer.x - (left + right) / 2) * zoom;
        layer.y = 90 + (layer.y - (top + bottom) / 2) * zoom;
        layer.size *= zoom;
      });
      renderPhotoEdits(thumb.getContext('2d'), background, { ...emptyPhotoEdits(), texts: layers }, 240, 180);
      const button = document.createElement('button'); button.type = 'button'; button.dataset.photoLayout = layout.id; button.dataset.category = layout.category;
      const thumbnail = document.createElement('img'); thumbnail.src = thumb.toDataURL(); thumbnail.alt = ''; thumbnail.width = 240; thumbnail.height = 180;
      const label = document.createElement('span'); label.textContent = layout.name;
      button.append(thumbnail, label); el('layoutPresets').appendChild(button);
      button.addEventListener('click', () => {
        if (!image) return;
        if (edits.texts.length + layout.lines.length > 25) { el('status').textContent = 'Remove a text layer to make space for this layout (25 layers maximum).'; return; }
        const layers = makeTextLayout(layout.id, viewport(), newId);
        el('layoutGallery').open = false;
        edits.texts.push(...layers); selectedId = layers[0].id; el('moveGroup').checked = true;
        commit(); syncTextControls(); layers.forEach(ensureFont);
        el('status').textContent = `${layout.name} added. Each line can be edited in Text layers.`;
      });
    }
  }
  buildLayoutGallery().catch(error => { console.error('Text layouts:', error); el('status').textContent = 'Text layout fonts could not load. Individual text styles are still available.'; });
  el('layoutCategory').addEventListener('change', () => {
    el('layoutPresets').querySelectorAll('button').forEach(button => { button.hidden = el('layoutCategory').value !== 'All' && button.dataset.category !== el('layoutCategory').value; });
  });
  [['frameColor', 'color'], ['frameAccent', 'accent'], ['frameWidth', 'width']].forEach(([name, prop]) => {
    const input = el(name);
    input.addEventListener('input', () => {
      edits.frame[prop] = prop === 'width' ? Number(input.value) : input.value;
      el('frameWidthValue').textContent = `${edits.frame.width}%`; render();
    });
    input.addEventListener('change', commit);
  });

  const getPoint = event => {
    const view = viewport();
    const point = previewToImagePoint(event.clientX, event.clientY, overlay.getBoundingClientRect(), view.width, view.height);
    return { x: point.x + view.x, y: point.y + view.y };
  };
  const movableTexts = layer => layer.groupId && el('moveGroup').checked ? edits.texts.filter(item => item.groupId === layer.groupId) : [layer];
  function moveTexts(positions, dx, dy) {
    const view = viewport();
    dx = clamp(dx, Math.min(0, view.x - Math.min(...positions.map(p => p.x))), Math.max(0, view.x + view.width - Math.max(...positions.map(p => p.x))));
    dy = clamp(dy, Math.min(0, view.y - Math.min(...positions.map(p => p.y))), Math.max(0, view.y + view.height - Math.max(...positions.map(p => p.y))));
    positions.forEach(p => { const layer = edits.texts.find(item => item.id === p.id); if (layer) { layer.x = p.x + dx; layer.y = p.y + dy; } });
  }
  overlay.addEventListener('pointerdown', event => {
    if (!image || event.button !== 0) return;
    overlay.focus({ preventScroll: true });
    const point = getPoint(event);
    if (tool === 'blur') {
    el('showUnblurred').checked = false;
      selection = null; drag = { kind: 'blur', start: point, pointerId: event.pointerId };
    } else if (tool === 'crop') {
      const corner = crop && [[crop.x, crop.y], [crop.x + crop.width, crop.y], [crop.x, crop.y + crop.height], [crop.x + crop.width, crop.y + crop.height]].find(([x, y]) => Math.hypot(point.x - x, point.y - y) <= 12 * viewport().width / overlay.getBoundingClientRect().width);
      if (corner) {
        drag = { kind: 'cropResize', start: { x: corner[0] === crop.x ? crop.x + crop.width : crop.x, y: corner[1] === crop.y ? crop.y + crop.height : crop.y }, pointerId: event.pointerId };
      } else if (crop && point.x >= crop.x && point.x <= crop.x + crop.width && point.y >= crop.y && point.y <= crop.y + crop.height) {
        drag = { kind: 'cropMove', start: point, crop: { ...crop }, pointerId: event.pointerId };
      } else { crop = null; drag = { kind: 'crop', start: point, pointerId: event.pointerId }; }
    } else if (tool === 'text') {
      const selected = selectedText();
      const layers = selected ? [selected, ...[...edits.texts].reverse().filter(layer => layer.id !== selectedId)] : [...edits.texts].reverse();
      const hit = layers.find(layer => pointInTextBounds(point, layer, photoTextBounds(context, layer)));
      if (hit) {
        selectedId = hit.id;
        drag = { kind: 'text', start: point, positions: movableTexts(hit).map(({ id, x, y }) => ({ id, x, y })), pointerId: event.pointerId };
        syncTextControls();
      } else { selectedId = null; drag = null; syncTextControls(false); }
    }
    if (drag) overlay.setPointerCapture(event.pointerId);
    render(); updateCrop();
  });
  overlay.addEventListener('pointermove', event => {
    if (!drag || !image || drag.pointerId !== event.pointerId) return;
    const point = getPoint(event);
    if (drag.kind === 'blur') {
      selection = normalizeBlurRect(drag.start, point, image.naturalWidth, image.naturalHeight);
      updateSelection(); render();
    } else if (drag.kind === 'crop' || drag.kind === 'cropResize') {
      crop = cropSelection(drag.start, point, viewport(), Number(el('cropRatio').value));
      updateCrop(); renderOverlay();
    } else if (drag.kind === 'cropMove') {
      const view = viewport();
      crop.x = Math.round(clamp(drag.crop.x + point.x - drag.start.x, view.x, view.x + view.width - crop.width));
      crop.y = Math.round(clamp(drag.crop.y + point.y - drag.start.y, view.y, view.y + view.height - crop.height));
      updateCrop(); renderOverlay();
    } else if (selectedText()) {
      moveTexts(drag.positions, point.x - drag.start.x, point.y - drag.start.y);
      render();
    }
  });
  function finishDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'text') commit();
    drag = null;
    if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
  }
  overlay.addEventListener('pointerup', finishDrag);
  overlay.addEventListener('pointercancel', finishDrag);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { selection = null; crop = null; updateCrop(); render(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); edits = event.shiftKey ? history.redo() : history.undo(); syncAll(); return;
    }
    if (tool !== 'text' || !selectedText()) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteText(); return; }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    moveTexts(movableTexts(selectedText()).map(({ id, x, y }) => ({ id, x, y })), direction[0] * step, direction[1] * step);
    commit();
  });

  el('blurStrength').addEventListener('input', () => { el('blurStrengthValue').textContent = `${el('blurStrength').value} px`; render(); });
  el('showUnblurred').addEventListener('change', render);
  el('clearSelection').addEventListener('click', () => { selection = null; el('showUnblurred').checked = false; updateSelection(); render(); });
  el('applyBlur').addEventListener('click', () => {
    if (!selection) return;
    if (edits.blurs.length >= 20) { el('status').textContent = 'Up to 20 blur areas can be added. Remove an area before adding another.'; return; }
    edits.blurs.push({ id: newId(), ...selection, radius: Number(el('blurStrength').value) });
    selection = null; el('showUnblurred').checked = false; commit(); updateSelection(); updateBlurList();
    el('status').textContent = 'Blur applied to the selected area.';
  });
  el('cropRatio').addEventListener('change', () => {
    if (!image) return;
    const view = viewport(), ratio = Number(el('cropRatio').value);
    if (ratio) {
      const width = Math.min(view.width * .85, view.height * .85 * ratio), height = width / ratio;
      const start = { x: Math.round(view.x + (view.width - width) / 2), y: Math.round(view.y + (view.height - height) / 2) };
      crop = cropSelection(start, { x: start.x + width, y: start.y + height }, view, ratio);
    }
    updateCrop(); renderOverlay();
  });
  el('cropSettings').addEventListener('input', event => {
    if (!crop || !event.target.dataset.cropProp || event.target.value === '') return;
    const view = viewport(), prop = event.target.dataset.cropProp, ratio = Number(el('cropRatio').value);
    const value = Math.round(Number(event.target.value));
    if (!Number.isFinite(value)) return;
    if (prop === 'x') crop.x = clamp(value, view.x, view.x + view.width - crop.width);
    else if (prop === 'y') crop.y = clamp(value, view.y, view.y + view.height - crop.height);
    else {
      const width = prop === 'width' ? value : ratio ? value * ratio : crop.width;
      const height = prop === 'height' ? value : ratio ? value / ratio : crop.height;
      crop = cropSelection({ x: crop.x, y: crop.y }, { x: crop.x + Math.max(2, width), y: crop.y + Math.max(2, height) }, view, ratio);
    }
    // Keep the field being typed in stable until its change event.
    el('cropInfo').textContent = crop ? `${crop.width} × ${crop.height} px · crop preview` : 'Crop too small';
    el('applyCrop').disabled = !crop; renderOverlay();
  });
  el('cropSettings').addEventListener('change', updateCrop);
  el('clearCrop').addEventListener('click', () => { crop = null; updateCrop(); renderOverlay(); });
  el('applyCrop').addEventListener('click', () => {
    if (!crop) return;
    edits.crop = { ...crop }; crop = null; selection = null;
    commit(); updateCrop();
    el('status').textContent = `Cropped to ${edits.crop.width} × ${edits.crop.height} px. Undo or Restore full photo brings back the full image.`;
  });
  el('resetCrop').addEventListener('click', () => {
    edits.crop = null; crop = null; commit(); updateCrop(); el('status').textContent = 'Full photo restored. Your text, frame, and blur edits are kept.';
  });
  el('undo').addEventListener('click', () => { edits = history.undo(); syncAll(); el('status').textContent = 'Last edit undone.'; });
  el('redo').addEventListener('click', () => { edits = history.redo(); syncAll(); el('status').textContent = 'Edit restored.'; });
  el('reset').addEventListener('click', () => { edits = emptyPhotoEdits(); commit(); syncAll(); el('status').textContent = 'Edits reset. Undo can restore them.'; });

  el('dropzone').addEventListener('click', event => { if (event.target !== el('fileInput')) el('fileInput').click(); });
  el('dropzone').addEventListener('dragover', event => { event.preventDefault(); el('dropzone').classList.add('dragover'); });
  el('dropzone').addEventListener('dragleave', () => el('dropzone').classList.remove('dragover'));
  el('dropzone').addEventListener('drop', event => { event.preventDefault(); el('dropzone').classList.remove('dragover'); if (event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]); });
  el('fileInput').addEventListener('change', () => { if (el('fileInput').files[0]) loadFile(el('fileInput').files[0]); el('fileInput').value = ''; });
  el('change').addEventListener('click', () => el('fileInput').click());

  el('download').addEventListener('click', async () => {
    if (!image || selection || crop || exporting) return;
    exporting = true;
    const exportImage = image;
    const snapshot = structuredClone(edits);
    const filename = sourceFile.name.replace(/\.[^.]+$/, '');
    const format = el('exportFormat').value;
    el('download').disabled = true;
    el('status').textContent = 'Preparing your photo at original resolution…';
    const output = document.createElement('canvas');
    try {
      await Promise.all(snapshot.texts.map(layer => document.fonts.load(`${layer.italic ? 'italic ' : ''}${layer.weight} ${layer.size}px "${layer.font}"`, layer.text || 'Aa')));
      const view = photoViewport(exportImage.naturalWidth, exportImage.naturalHeight, snapshot);
      output.width = view.width; output.height = view.height;
      const ctx = output.getContext('2d');
      renderPhotoEdits(ctx, exportImage, snapshot, output.width, output.height);
      if (format === 'image/jpeg') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, output.width, output.height); }
      const blob = await new Promise((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Image export failed.')), format, 0.95));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${filename}-edited.${format === 'image/png' ? 'png' : 'jpg'}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      el('status').textContent = `Downloaded ${output.width} × ${output.height} px ${format === 'image/png' ? 'PNG' : 'JPG'}.`;
    } catch (error) {
      console.error('Photo export failed:', error);
      el('status').textContent = 'Could not export this photo. Try a different font or a smaller image.';
    } finally { output.width = output.height = 0; exporting = false; updateSelection(); }
  });
}
