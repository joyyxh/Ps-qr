import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROP_PRESETS,
  adjustTable,
  clampCrop,
  defaultCrop,
  editedFileName,
  isPhotoFile,
  isUnchangedEdit,
  moveCrop,
  normalizeTurns,
  outputSize,
  presetRatio,
  resizeCrop,
  turnMatrix,
  turnedSize,
} from '../src/photo-edit.js';

const PASSPORT = 35 / 45;

function mapPoint(m, x, y) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

test('turns normalise to 0..3 and swap the sides for quarter turns', () => {
  assert.equal(normalizeTurns(-1), 3);
  assert.equal(normalizeTurns(5), 1);
  assert.deepEqual(turnedSize(4, 2, 0), { width: 4, height: 2 });
  assert.deepEqual(turnedSize(4, 2, 1), { width: 2, height: 4 });
  assert.deepEqual(turnedSize(4, 2, 2), { width: 4, height: 2 });
  assert.deepEqual(turnedSize(4, 2, 3), { width: 2, height: 4 });
});

test('a quarter turn to the right moves the top-left corner to the top-right', () => {
  // Source 4 x 2. Turned 2 x 4. Corners of the source: TL (0,0), TR (4,0), BR (4,2), BL (0,2).
  const m = turnMatrix(4, 2, 1);
  assert.deepEqual(mapPoint(m, 0, 0), { x: 2, y: 0 }); // TL -> top-right
  assert.deepEqual(mapPoint(m, 4, 0), { x: 2, y: 4 }); // TR -> bottom-right
  assert.deepEqual(mapPoint(m, 4, 2), { x: 0, y: 4 }); // BR -> bottom-left
  assert.deepEqual(mapPoint(m, 0, 2), { x: 0, y: 0 }); // BL -> top-left
});

test('half turn and quarter turn left map the corners the other way round', () => {
  const half = turnMatrix(4, 2, 2);
  assert.deepEqual(mapPoint(half, 0, 0), { x: 4, y: 2 }); // TL -> bottom-right
  const left = turnMatrix(4, 2, 3);
  assert.deepEqual(mapPoint(left, 0, 0), { x: 0, y: 4 }); // TL -> bottom-left
  assert.deepEqual(mapPoint(left, 4, 0), { x: 0, y: 0 }); // TR -> top-left
});

test('the default crop is the largest centred rectangle at the chosen ratio', () => {
  const wide = defaultCrop(4000, 3000, PASSPORT);
  assert.ok(Math.abs(wide.w / wide.h - PASSPORT) < 1e-9);
  assert.ok(wide.h <= 3000 && wide.w <= 4000);
  assert.ok(Math.abs(wide.x - (4000 - wide.w) / 2) < 1e-9);
  assert.ok(Math.abs(wide.y - (3000 - wide.h) / 2) < 1e-9);
  assert.deepEqual(defaultCrop(100, 200, null), { x: 0, y: 0, w: 100, h: 200 });
  const tall = defaultCrop(300, 1000, 1);
  assert.deepEqual([tall.w, tall.h], [300, 300]);
});

test('clamping keeps the crop inside the picture and at the ratio', () => {
  const crop = clampCrop({ x: -10, y: 5, w: 500, h: 10 }, 100, 100, 1);
  assert.deepEqual(crop, { x: 0, y: 0, w: 100, h: 100 });
  const small = clampCrop({ x: 0, y: 0, w: 5, h: 5 }, 100, 100, null);
  assert.equal(small.w, 40);
  assert.equal(small.h, 40);
});

test('moving the crop stops at the edge of the picture', () => {
  const start = { x: 10, y: 10, w: 50, h: 50 };
  const moved = moveCrop(start, 500, -500, 200, 200);
  assert.deepEqual(moved, { x: 150, y: 0, w: 50, h: 50 });
});

test('resizing with a ratio keeps the shape', () => {
  // A small crop, so there is room to grow inside the 400 x 400 picture.
  const start = { x: 50, y: 50, w: 100, h: 100 / PASSPORT };
  const bigger = resizeCrop(start, 40, 0, 400, 400, PASSPORT);
  assert.ok(Math.abs(bigger.w / bigger.h - PASSPORT) < 1e-9);
  assert.ok(bigger.w > start.w);
  const free = resizeCrop({ x: 0, y: 0, w: 100, h: 100 }, 20, -30, 400, 400, null);
  assert.deepEqual([free.w, free.h], [120, 70]);
});

test('the upload is scaled down to at most 2000 pixels on its longest side', () => {
  assert.deepEqual(outputSize(4000, 3000), { width: 2000, height: 1500 });
  assert.deepEqual(outputSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(outputSize(1, 1), { width: 1, height: 1 });
});

test('the brightness and contrast table is the identity at zero', () => {
  const table = adjustTable(0, 0);
  for (let value = 0; value < 256; value += 1) assert.equal(table[value], value);
});

test('brightness and contrast move the values as expected and stay in range', () => {
  assert.ok(adjustTable(100, 0)[100] > 100);
  assert.ok(adjustTable(-100, 0)[200] < 200);
  assert.equal(adjustTable(0, 100)[255], 255);
  assert.equal(adjustTable(0, 100)[0], 0);
  assert.equal(adjustTable(0, -100)[0], 128);
  assert.equal(adjustTable(0, -100)[255], 128);
});

test('an edit that changes nothing is detected, so the original is uploaded', () => {
  const base = {
    turns: 0, brightness: 0, contrast: 0, width: 400, height: 300, crop: { x: 0, y: 0, w: 400, h: 300 },
  };
  assert.equal(isUnchangedEdit(base), true);
  assert.equal(isUnchangedEdit({ ...base, turns: 1 }), false);
  assert.equal(isUnchangedEdit({ ...base, brightness: 5 }), false);
  assert.equal(isUnchangedEdit({ ...base, contrast: -3 }), false);
  assert.equal(isUnchangedEdit({ ...base, crop: { x: 0, y: 0, w: 380, h: 300 } }), false);
});

test('only JPEG and PNG pictures open the editor', () => {
  assert.equal(isPhotoFile({ type: 'image/png', name: 'a.png' }), true);
  assert.equal(isPhotoFile({ type: 'image/jpeg', name: 'a.jpg' }), true);
  assert.equal(isPhotoFile({ type: 'application/pdf', name: 'a.pdf' }), false);
  assert.equal(isPhotoFile({ type: '', name: 'PHOTO.JPG' }), true);
  assert.equal(isPhotoFile({ type: '', name: 'notes.txt' }), false);
  assert.equal(isPhotoFile(null), false);
});

test('the edited file keeps the name and is a JPEG', () => {
  assert.equal(editedFileName('scan.final.png'), 'scan.final-edited.jpg');
  assert.equal(editedFileName('photo'), 'photo-edited.jpg');
  assert.equal(editedFileName(''), 'photo-edited.jpg');
});

test('the preset list has the passport, square and 4 x 6 shapes', () => {
  assert.deepEqual(CROP_PRESETS.map((preset) => preset.key), ['free', 'passport', 'square', 'photo']);
  assert.equal(presetRatio('free'), null);
  assert.ok(Math.abs(presetRatio('passport') - PASSPORT) < 1e-9);
  assert.equal(presetRatio('square'), 1);
  assert.ok(Math.abs(presetRatio('photo') - 4 / 6) < 1e-9);
});
