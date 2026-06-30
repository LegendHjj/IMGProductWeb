import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getImageOutputExtension,
  getImageOutputMimeType,
  imageFormatUsesQuality,
  imageFormatNeedsBackgroundFill
} from '../src/utils.js';

test('maps supported image output formats to MIME types and file extensions', () => {
  assert.equal(getImageOutputMimeType('jpg'), 'image/jpeg');
  assert.equal(getImageOutputMimeType('jpeg'), 'image/jpeg');
  assert.equal(getImageOutputMimeType('png'), 'image/png');
  assert.equal(getImageOutputMimeType('webp'), 'image/webp');

  assert.equal(getImageOutputExtension('image/jpeg'), 'jpg');
  assert.equal(getImageOutputExtension('image/png'), 'png');
  assert.equal(getImageOutputExtension('image/webp'), 'webp');
});

test('identifies output formats that use quality and background fill settings', () => {
  assert.equal(imageFormatUsesQuality('image/jpeg'), true);
  assert.equal(imageFormatUsesQuality('image/webp'), true);
  assert.equal(imageFormatUsesQuality('image/png'), false);

  assert.equal(imageFormatNeedsBackgroundFill('image/jpeg'), true);
  assert.equal(imageFormatNeedsBackgroundFill('image/webp'), false);
  assert.equal(imageFormatNeedsBackgroundFill('image/png'), false);
});
