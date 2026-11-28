// Geometry and pixel helpers for the customer photo editor (crop, turn, brightness, contrast).
// No DOM here, so every function can be tested in Node.
//
// Coordinates: a "source" point is in the original picture's pixels. A "turned" point is in the
// picture after quarter turns. A crop is { x, y, w, h } in turned-picture pixels.

export const EDIT_MAX_SIDE = 2000; // the longest side of the uploaded picture
export const CROP_MIN_SIDE = 40; // the smallest crop edge, in turned-picture pixels

// Ratios are width divided by height. "Free" keeps any shape.
export const CROP_PRESETS = [
  { key: 'free', label: 'Free', ratio: null },
  { key: 'passport', label: 'Passport 35 × 45 mm', ratio: 35 / 45 },
  { key: 'square', label: 'Square 2 × 2 in', ratio: 1 },
  { key: 'photo', label: 'Photo 4 × 6 in', ratio: 4 / 6 },
];

export function presetRatio(key) {
  return CROP_PRESETS.find((preset) => preset.key === key)?.ratio ?? null;
}

// Clockwise quarter turns, normalised to 0..3.
export function normalizeTurns(turns) {
  return ((Math.round(turns) % 4) + 4) % 4;
}

export function turnedSize(width, height, turns) {
  return normalizeTurns(turns) % 2 === 1 ? { width: height, height: width } : { width, height };
}

// The matrix that maps a source point (x, y) onto the turned picture:
// X = a*x + c*y + e and Y = b*x + d*y + f. Clockwise turns, checked corner by corner in the tests.
export function turnMatrix(width, height, turns) {
  switch (normalizeTurns(turns)) {
    case 1:
      return { a: 0, b: 1, c: -1, d: 0, e: height, f: 0 };
    case 2:
      return { a: -1, b: 0, c: 0, d: -1, e: width, f: height };
    case 3:
      return { a: 0, b: -1, c: 1, d: 0, e: 0, f: width };
    default:
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
}

// The largest crop with the given ratio, centred in the picture. Without a ratio, the whole picture.
export function defaultCrop(width, height, ratio = null) {
  if (!ratio) return { x: 0, y: 0, w: width, h: height };
  let w = width;
  let h = w / ratio;
  if (h > height) {
    h = height;
    w = h * ratio;
  }
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

// Keeps a crop inside the turned picture, no smaller than CROP_MIN_SIDE, and at the ratio if one is set.
export function clampCrop(crop, width, height, ratio = null) {
  let w = Math.min(Math.max(crop.w, CROP_MIN_SIDE), width);
  let h = Math.min(Math.max(crop.h, CROP_MIN_SIDE), height);
  if (ratio) {
    // The width decides the crop, unless the height is the tighter limit.
    if (w / ratio > height) {
      h = height;
      w = h * ratio;
    } else {
      h = w / ratio;
    }
  }
  const x = Math.min(Math.max(crop.x, 0), width - w);
  const y = Math.min(Math.max(crop.y, 0), height - h);
  return { x, y, w, h };
}

// Drags the whole crop by (dx, dy) turned-picture pixels from where the drag started.
export function moveCrop(start, dx, dy, width, height, ratio = null) {
  return clampCrop({ ...start, x: start.x + dx, y: start.y + dy }, width, height, ratio);
}

// Drags the bottom-right corner. With a ratio, the average of the two drags decides the size.
export function resizeCrop(start, dx, dy, width, height, ratio = null) {
  const w = ratio ? start.w + (dx + dy * ratio) / 2 : start.w + dx;
  const h = start.h + dy;
  return clampCrop({ x: start.x, y: start.y, w, h }, width, height, ratio);
}

// The size to upload: the crop scaled down so its longest side is at most maxSide.
export function outputSize(width, height, maxSide = EDIT_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Brightness and contrast run from -100 to 100. The result is a 256-entry lookup table, so every
// pixel is one array read. At 0 and 0 the table is the identity.
export function adjustTable(brightness, contrast) {
  const table = new Uint8ClampedArray(256);
  const shift = brightness * 1.27;
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  for (let value = 0; value < 256; value += 1) {
    const out = factor * (value + shift - 128) + 128;
    table[value] = Math.min(255, Math.max(0, Math.round(out)));
  }
  return table;
}

export function isNoAdjust(brightness, contrast) {
  return Math.round(brightness) === 0 && Math.round(contrast) === 0;
}

// True when the customer has not changed anything, so the original file is uploaded as it is.
export function isUnchangedEdit({ turns, brightness, contrast, crop, width, height }) {
  const whole = Math.abs(crop.x) < 0.5 && Math.abs(crop.y) < 0.5
    && Math.abs(crop.w - turnedSize(width, height, turns).width) < 0.5
    && Math.abs(crop.h - turnedSize(width, height, turns).height) < 0.5;
  return normalizeTurns(turns) === 0 && isNoAdjust(brightness, contrast) && whole;
}

// JPEG and PNG pictures get the editor. PDFs go straight to upload.
export function isPhotoFile(file) {
  if (!file) return false;
  return /^image\/(jpeg|png)$/.test(file.type ?? '') || (!file.type && /\.(jpe?g|png)$/i.test(file.name ?? ''));
}

export function editedFileName(name = 'photo') {
  const base = String(name).replace(/\.[^.]*$/, '') || 'photo';
  return `${base}-edited.jpg`;
}
