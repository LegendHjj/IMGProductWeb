import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getUpscaleDimensions, getUpscaleFileError, getUpscaleFilename, restoreUpscaleAlpha } from '../src/upscale.js';

test('upscales dimensions at 2x and 4x while enforcing browser memory limits', () => {
  assert.deepEqual(getUpscaleDimensions(320, 180, 2), { width: 640, height: 360 });
  assert.deepEqual(getUpscaleDimensions(320, 180, 4), { width: 1280, height: 720 });
  assert.throws(() => getUpscaleDimensions(320, 180, 3), /2× or 4×/);
  assert.throws(() => getUpscaleDimensions(3000, 2000, 4), /2× or a smaller image/);
  assert.throws(() => getUpscaleDimensions(0, 100, 2), /dimensions/);
});

test('validates supported images and names PNG output using the selected scale', () => {
  assert.equal(getUpscaleFileError({ name: 'photo.webp', type: 'image/webp', size: 100 }), null);
  assert.match(getUpscaleFileError({ name: 'photo.gif', type: 'image/gif', size: 100 }), /JPG, PNG, or WEBP/);
  assert.match(getUpscaleFileError({ name: 'photo.png', type: 'image/png', size: 51 * 1024 * 1024 }), /50MB/);
  assert.equal(getUpscaleFilename('product.hero.jpg', 4), 'product.hero-upscaled-4x.png');
});

test('preserves transparent pixels without overwriting AI enhanced RGB values', () => {
  const enhanced = new Uint8ClampedArray([100, 110, 120, 255, 20, 30, 40, 255]);
  const sourceMask = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 128]);
  restoreUpscaleAlpha(enhanced, sourceMask);
  assert.deepEqual([...enhanced], [100, 110, 120, 0, 20, 30, 40, 128]);
});
