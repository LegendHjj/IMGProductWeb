import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateLogoPlacement } from '../src/utils.js';

test('places bottom-right logo flush with zero edge distance', () => {
  const placement = calculateLogoPlacement({
    imageWidth: 1000,
    imageHeight: 800,
    logoWidth: 170,
    logoHeight: 90,
    position: 'bottom_right',
    edgeDistance: 0
  });

  assert.deepEqual(placement, { x: 830, y: 710 });
});

test('uses positive and negative edge distance for corner positions', () => {
  assert.deepEqual(
    calculateLogoPlacement({
      imageWidth: 1000,
      imageHeight: 800,
      logoWidth: 170,
      logoHeight: 90,
      position: 'bottom_right',
      edgeDistance: 24
    }),
    { x: 806, y: 686 }
  );

  assert.deepEqual(
    calculateLogoPlacement({
      imageWidth: 1000,
      imageHeight: 800,
      logoWidth: 170,
      logoHeight: 90,
      position: 'bottom_right',
      edgeDistance: -12
    }),
    { x: 842, y: 722 }
  );
});

test('centers logo independently from edge distance', () => {
  const placement = calculateLogoPlacement({
    imageWidth: 1000,
    imageHeight: 800,
    logoWidth: 170,
    logoHeight: 90,
    position: 'center',
    edgeDistance: 80
  });

  assert.deepEqual(placement, { x: 415, y: 355 });
});
