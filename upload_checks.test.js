// Node tests for the upload checks used by the upload-file edge function.
// Run from the repo root:  node --test supabase/tests/upload_checks.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PAGES,
  MAX_UPLOAD_BYTES,
  UploadError,
  checkBytes,
  cleanFileName,
  detectType,
  isUuid,
  measurePages,
  nameFromHeader,
  parseShopSlug,
  readBodyLimited,
} from '../functions/upload-file/checks.js';

const PDF_HEAD = new TextEncoder().encode('%PDF-1.7\n');
const JPEG_HEAD = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG_HEAD = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function withHead(head, length) {
  const out = new Uint8Array(length);
  out.set(head.subarray(0, Math.min(head.length, length)));
  return out;
}

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function rejectsWith(promise, status, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof UploadError, `expected UploadError, got ${err?.name}`);
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

// ----- type detection: the bytes decide, never the name or the browser -----

test('PDF, JPEG and PNG are recognised from their first bytes', () => {
  assert.deepEqual(detectType(PDF_HEAD), { type: 'application/pdf', ext: 'pdf' });
  assert.deepEqual(detectType(JPEG_HEAD), { type: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(detectType(PNG_HEAD), { type: 'image/png', ext: 'png' });
});

test('anything else is not accepted, even if it looks like a PDF by name', () => {
  assert.equal(detectType(new TextEncoder().encode('just text, notes.pdf')), null);
  assert.equal(detectType(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), null, 'zip');
  assert.equal(detectType(new Uint8Array(0)), null);
  // a PNG signature with a wrong byte is not a PNG
  assert.equal(detectType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b])), null);
});

test('checkBytes refuses empty, oversized and unknown files with clear codes', async () => {
  assert.throws(() => checkBytes(new Uint8Array(0)), (err) => err.code === 'empty_file' && err.status === 400);
  assert.throws(() => checkBytes(withHead(PDF_HEAD, MAX_UPLOAD_BYTES + 1)), (err) => err.code === 'too_large' && err.status === 413);
  assert.throws(() => checkBytes(new TextEncoder().encode('hello')), (err) => err.code === 'unsupported_type' && err.status === 415);
  assert.deepEqual(checkBytes(withHead(PDF_HEAD, 2048)), { type: 'application/pdf', ext: 'pdf' });
  assert.deepEqual(checkBytes(withHead(PDF_HEAD, MAX_UPLOAD_BYTES)), { type: 'application/pdf', ext: 'pdf' });
});

// ----- body reading -----

test('readBodyLimited joins the chunks in order', async () => {
  const body = streamOf([Uint8Array.from([1, 2]), Uint8Array.from([3]), Uint8Array.from([4, 5, 6])]);
  assert.deepEqual([...(await readBodyLimited(body, 100))], [1, 2, 3, 4, 5, 6]);
});

test('readBodyLimited stops and refuses a body that passes the limit', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(4));
    },
    cancel() {
      cancelled = true;
    },
  });
  await rejectsWith(readBodyLimited(body, 10), 413, 'too_large');
  assert.equal(cancelled, true, 'the rest of the body is dropped, not read');
});

test('readBodyLimited treats a missing body as an empty file', async () => {
  assert.equal((await readBodyLimited(null, 10)).byteLength, 0);
});

// ----- pages -----

test('images count as one page and never reach the PDF counter', async () => {
  const counter = async () => {
    throw new Error('should not be called');
  };
  assert.equal(await measurePages(JPEG_HEAD, 'image/jpeg', counter), 1);
  assert.equal(await measurePages(PNG_HEAD, 'image/png', counter), 1);
});

test('PDF pages come from the counter, within 1 to 500', async () => {
  assert.equal(await measurePages(PDF_HEAD, 'application/pdf', async () => 12), 12);
  assert.equal(await measurePages(PDF_HEAD, 'application/pdf', async () => MAX_PAGES), MAX_PAGES);
  await rejectsWith(measurePages(PDF_HEAD, 'application/pdf', async () => 0), 422, 'empty_pdf');
  await rejectsWith(measurePages(PDF_HEAD, 'application/pdf', async () => MAX_PAGES + 1), 422, 'too_many_pages');
  await rejectsWith(measurePages(PDF_HEAD, 'application/pdf', async () => 2.5), 422, 'empty_pdf');
});

test('a counter error reaches the caller unchanged', async () => {
  const counter = async () => {
    throw new UploadError(422, 'encrypted_pdf', 'locked');
  };
  await rejectsWith(measurePages(PDF_HEAD, 'application/pdf', counter), 422, 'encrypted_pdf');
});

// ----- names and shop links -----

test('cleanFileName keeps the last path part and drops control characters', () => {
  assert.equal(cleanFileName('C:\\Users\\me\\Thesis final.pdf'), 'Thesis final.pdf');
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd');
  assert.equal(cleanFileName('bad\u0000name\u0007.pdf'), 'badname.pdf');
  assert.equal(cleanFileName('  many    spaces.pdf  '), 'many spaces.pdf');
});

test('cleanFileName falls back when nothing usable is left', () => {
  assert.equal(cleanFileName(''), 'upload');
  assert.equal(cleanFileName(null), 'upload');
  assert.equal(cleanFileName('\u0001\u0002'), 'upload');
});

test('cleanFileName caps the length and keeps a short extension', () => {
  const long = `${'a'.repeat(200)}.pdf`;
  const cleaned = cleanFileName(long);
  assert.equal(cleaned.length, 120);
  assert.ok(cleaned.endsWith('.pdf'));
});

test('nameFromHeader decodes the browser encoding and survives bad encoding', () => {
  assert.equal(nameFromHeader(encodeURIComponent('Résumé notes.pdf')), 'Résumé notes.pdf');
  assert.equal(nameFromHeader('100%.pdf'), '100%.pdf');
  assert.equal(nameFromHeader(null), 'upload');
});

test('parseShopSlug accepts the slug format and lower-cases it', () => {
  assert.equal(parseShopSlug('Demo-Xerox'), 'demo-xerox');
  for (const bad of ['', 'a', '-shop', 'shop-', 'has space', 'a/b', '../x', null]) {
    assert.throws(() => parseShopSlug(bad), (err) => err.code === 'bad_shop' && err.status === 400, String(bad));
  }
});

test('isUuid accepts only canonical UUIDs', () => {
  assert.equal(isUuid('491a5b8f-8c1c-4339-861e-7e434e367620'), true);
  assert.equal(isUuid('491a5b8f8c1c4339861e7e434e367620'), false);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(42), false);
});
