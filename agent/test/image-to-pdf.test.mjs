import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { imageToPdf, readImage, UnsupportedImageError } from '../src/image-to-pdf.mjs';
import { detectFileType } from '../src/file-check.mjs';

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  // The reader does not check CRCs, so four zero bytes stand in for the checksum.
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}

function tinyPng({ width = 2, height = 3, colorType = 2, bitDepth = 8, transparent = false } = {}) {
  const channels = colorType === 2 ? 3 : 1;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.concat([Buffer.from([0]), Buffer.alloc(width * channels, 0x80)]));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...(transparent ? [pngChunk('tRNS', Buffer.from([0, 0]))] : []),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Only the start-of-frame segment is real. That is all the reader needs.
function jpeg({ width = 8, height = 8, components = 1 } = {}) {
  const length = 8 + 3 * components;
  const sof = Buffer.alloc(length + 2);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(length, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = components;
  for (let i = 0; i < components; i++) {
    sof[10 + i * 3] = i + 1;
    sof[11 + i * 3] = 0x11;
    sof[12 + i * 3] = 0;
  }
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

// Checks that every cross-reference offset points at the object it names.
function checkXref(pdf) {
  const text = pdf.toString('latin1');
  const match = /startxref\n(\d+)\n%%EOF\n$/.exec(text);
  assert.ok(match, 'PDF ends with startxref and %%EOF');
  const start = Number(match[1]);
  assert.equal(text.slice(start, start + 4), 'xref');
  const lines = text.slice(start).split('\n');
  const count = Number(lines[1].split(' ')[1]);
  for (let n = 1; n < count; n++) {
    const offset = parseInt(lines[2 + n].slice(0, 10), 10);
    assert.ok(text.slice(offset).startsWith(`${n} 0 obj`), `object ${n} is at offset ${offset}`);
  }
}

test('detects PDF, JPEG and PNG by their first bytes, not by file name', () => {
  assert.equal(detectFileType(Buffer.from('%PDF-1.7\n')), 'pdf');
  assert.equal(detectFileType(jpeg()), 'jpeg');
  assert.equal(detectFileType(tinyPng()), 'png');
  assert.equal(detectFileType(Buffer.from('GIF89a')), null);
  assert.equal(detectFileType(Buffer.alloc(0)), null);
});

test('wraps an RGB PNG in a valid one-page PDF with the picture as a Flate stream', () => {
  const pdf = imageToPdf(tinyPng());
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\/DeviceRGB/);
  assert.match(text, /\/FlateDecode/);
  assert.match(text, /\/Predictor 15 \/Colors 3/);
  assert.match(text, /\/Count 1/);
  checkXref(pdf);
});

test('wraps a greyscale PNG with DeviceGray', () => {
  const pdf = imageToPdf(tinyPng({ colorType: 0 }));
  assert.match(pdf.toString('latin1'), /\/DeviceGray/);
  assert.match(pdf.toString('latin1'), /\/Predictor 15 \/Colors 1/);
  checkXref(pdf);
});

test('wraps a JPEG without re-encoding it (DCTDecode)', () => {
  const pdf = imageToPdf(jpeg({ width: 300, height: 200 }));
  assert.match(pdf.toString('latin1'), /\/DCTDecode/);
  checkXref(pdf);
});

test('refuses PNG pictures with transparency, alpha or 16-bit depth', () => {
  assert.throws(() => imageToPdf(tinyPng({ transparent: true })), /transparency/);
  assert.throws(() => imageToPdf(tinyPng({ colorType: 6 })), UnsupportedImageError);
  assert.throws(() => imageToPdf(tinyPng({ bitDepth: 16 })), /8-bit PNG/);
});

test('refuses CMYK JPEG and other colour formats with a clear message', () => {
  assert.throws(() => imageToPdf(jpeg({ components: 4 })), /JPEG colour format cannot be printed/);
  try {
    imageToPdf(jpeg({ components: 4 }));
  } catch (err) {
    assert.equal(err.code, 'image_unsupported');
  }
});

test('readImage rejects anything that is not a JPEG or PNG', () => {
  assert.throws(() => readImage(Buffer.from('GIF89a........', 'latin1')), /not a JPEG or PNG/);
});
