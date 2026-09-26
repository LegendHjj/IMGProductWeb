import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPhotoHistory, emptyPhotoEdits, normalizeBlurRect, previewToImagePoint, pointInTextBounds } from '../src/photo-editor-model.js';
import { photoViewport, cropSelection, previewPhotoEdits } from '../src/photo-editor-model.js';
import { makeTextLayout, TEXT_LAYOUTS } from '../src/photo-editor-layouts.js';
import { applyPhotoTextStyle, TEXT_STYLES, makePhotoText } from '../src/photo-editor-model.js';

test('switching single text styles resets effects and preserves the edited words and position', () => {
  const layer = makePhotoText('one', 800, 600, 'neon');
  layer.text = 'MY PRODUCT'; layer.x = 123; layer.size = 70;
  assert.equal(layer.effect, 'glow');
  applyPhotoTextStyle(layer, 'hollow');
  assert.equal(layer.effect, 'hollow');
  assert.equal(layer.outline, true);
  applyPhotoTextStyle(layer, 'modern');
  assert.equal(layer.effect, 'none');
  assert.equal(layer.outline, false);
  assert.equal(layer.text, 'MY PRODUCT'); assert.equal(layer.x, 123); assert.equal(layer.size, 70);
  assert.equal(TEXT_STYLES.length, 24);
  assert.equal(new Set(TEXT_STYLES.map(style => style.id)).size, 24);
});

test('live blur is temporary and keeps saved edits unchanged', () => {
  const saved = emptyPhotoEdits();
  const selection = { x: 20, y: 30, width: 100, height: 80 };
  const preview = previewPhotoEdits(saved, selection, 35, 'blur');
  assert.equal(preview.blurs[0].radius, 35);
  assert.equal(saved.blurs.length, 0);
  assert.equal(previewPhotoEdits(saved, selection, 35, 'text').blurs.length, 0);
});

test('crop keeps source coordinates, aspect ratio and undoable output size', () => {
  const saved = emptyPhotoEdits();
  const history = createPhotoHistory(saved);
  const viewport = { x: 100, y: 50, width: 500, height: 400 };
  const rect = cropSelection({ x: 150, y: 100 }, { x: 700, y: 500 }, viewport, 1);
  assert.deepEqual(rect, { x: 150, y: 100, width: 350, height: 350 });
  saved.crop = rect;
  history.commit(saved);
  assert.deepEqual(photoViewport(800, 600, saved), rect);
  assert.deepEqual(photoViewport(800, 600, history.undo()), { x: 0, y: 0, width: 800, height: 600 });
  assert.equal(photoViewport(800, 600, history.redo()).width, 350);
  assert.equal(cropSelection({ x: 150, y: 100 }, { x: 150, y: 100 }, viewport, 1), null);
});

test('every text layout has separately editable layers scaled to the photo', () => {
  let id = 0;
  for (const layout of TEXT_LAYOUTS) {
    const layers = makeTextLayout(layout.id, { x: 100, y: 50, width: 800, height: 600 }, () => String(++id));
    assert.ok(layers.length >= 2);
    assert.equal(new Set(layers.map(layer => layer.id)).size, layers.length);
    assert.ok(layers.every(layer => layer.text && layer.size > 0 && layer.x === 500));
    assert.equal(new Set(layers.map(layer => layer.groupId)).size, 1);
  }
});

test('maps preview selection to original pixels and clamps reversed blur selections', () => {
  assert.deepEqual(previewToImagePoint(200, 150, { left: 100, top: 50, width: 400, height: 200 }, 1200, 600), { x: 300, y: 300 });
  assert.deepEqual(normalizeBlurRect({ x: 900, y: 500 }, { x: -10, y: 100 }, 1200, 600), { x: 0, y: 100, width: 900, height: 400 });
  assert.equal(normalizeBlurRect({ x: 20, y: 20 }, { x: 20, y: 30 }, 1200, 600), null);
});

test('undo and redo restore independent text, frame, and blur snapshots', () => {
  const original = emptyPhotoEdits();
  const history = createPhotoHistory(original);
  const edited = emptyPhotoEdits();
  edited.texts.push({ id: 'title', text: 'Hello', x: 100 });
  edited.frame.style = 'floral';
  history.commit(edited);
  edited.texts[0].text = 'Changed';
  edited.blurs.push({ x: 10, y: 20, width: 30, height: 40, radius: 12 });
  history.commit(edited);
  assert.equal(history.undo().texts[0].text, 'Hello');
  assert.equal(history.undo().frame.style, 'none');
  assert.equal(history.redo().frame.style, 'floral');
  assert.equal(history.redo().blurs.length, 1);
  history.undo();
  history.commit(original);
  assert.equal(history.canRedo(), false);
});

test('text hit detection accounts for rotated layers', () => {
  const layer = { x: 100, y: 100, rotation: 90 };
  assert.equal(pointInTextBounds({ x: 100, y: 140 }, layer, { width: 100, height: 20 }), true);
  assert.equal(pointInTextBounds({ x: 140, y: 100 }, layer, { width: 100, height: 20 }), false);
});
