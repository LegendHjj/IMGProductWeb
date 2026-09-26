import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getBackgroundRemovalError,
  getBackgroundRemovalFilename,
  getComparisonPercent
} from '../src/background-removal.js';

test('accepts JPG and PNG images within the size limit and rejects invalid files', () => {
  assert.equal(getBackgroundRemovalError({ name: 'photo.JPG', type: 'image/jpeg', size: 1024 }), null);
  assert.equal(getBackgroundRemovalError({ name: 'photo.png', type: 'image/png', size: 1024 }), null);
  assert.match(getBackgroundRemovalError({ name: 'photo.webp', type: 'image/webp', size: 1024 }), /JPG or PNG/);
  assert.match(getBackgroundRemovalError({ name: 'photo.png', type: 'image/png', size: 50 * 1024 * 1024 + 1 }), /50MB/);
  assert.match(getBackgroundRemovalError({ name: 'photo.png', type: 'image/png', size: 0 }), /empty/);
});

test('names the transparent output PNG from the source file', () => {
  assert.equal(getBackgroundRemovalFilename('product.hero.jpeg'), 'product.hero-no-background.png');
  assert.equal(getBackgroundRemovalFilename('image.png'), 'image-no-background.png');
});

test('clamps the before and after divider within the preview bounds', () => {
  assert.equal(getComparisonPercent(150, 100, 200), 25);
  assert.equal(getComparisonPercent(50, 100, 200), 0);
  assert.equal(getComparisonPercent(400, 100, 200), 100);
});
