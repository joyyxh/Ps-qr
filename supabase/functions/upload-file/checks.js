// Pure upload checks, shared by the upload-file edge function (Deno) and the
// Node tests in supabase/tests/upload_checks.test.js. No network, no storage,
// no pdf-lib here: the PDF page counter is passed in so tests can fake it.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 500;
export const FILE_NAME_MAX = 120;

/** An upload problem the caller can show. `status` is the HTTP status to return. */
export class UploadError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
    this.code = code;
  }
}

// Types are decided by the bytes, never by the browser's Content-Type or the file name.
const SIGNATURES = [
  { type: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/**
 * @param {Uint8Array} bytes
 * @returns {{type: string, ext: string} | null}
 */
export function detectType(bytes) {
  for (const sig of SIGNATURES) {
    if (bytes.length >= sig.bytes.length && sig.bytes.every((b, i) => bytes[i] === b)) {
      return { type: sig.type, ext: sig.ext };
    }
  }
  return null;
}

/**
 * Reads the request body, stopping as soon as it passes the limit.
 * @param {ReadableStream<Uint8Array> | null} body
 * @param {number} max
 * @returns {Promise<Uint8Array>}
 */
export async function readBodyLimited(body, max = MAX_UPLOAD_BYTES) {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new UploadError(413, 'too_large', 'The file is larger than 10 MB. Try a smaller file.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Checks the size and the type. Returns the detected type or throws.
 * @param {Uint8Array} bytes
 * @returns {{type: string, ext: string}}
 */
export function checkBytes(bytes) {
  if (bytes.byteLength === 0) {
    throw new UploadError(400, 'empty_file', 'The file is empty.');
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError(413, 'too_large', 'The file is larger than 10 MB. Try a smaller file.');
  }
  const found = detectType(bytes);
  if (!found) {
    throw new UploadError(415, 'unsupported_type', 'Upload a PDF, JPEG or PNG file.');
  }
  return found;
}

/**
 * Pages the server measured. PDFs go through the injected counter. Images are one page.
 * @param {Uint8Array} bytes
 * @param {string} type
 * @param {(bytes: Uint8Array) => Promise<number>} countPdfPages
 * @returns {Promise<number>}
 */
export async function measurePages(bytes, type, countPdfPages) {
  if (type !== 'application/pdf') return 1;
  const pages = await countPdfPages(bytes);
  if (!Number.isInteger(pages) || pages < 1) {
    throw new UploadError(422, 'empty_pdf', 'This PDF has no printable pages.');
  }
  if (pages > MAX_PAGES) {
    throw new UploadError(422, 'too_many_pages', `This PDF has ${pages} pages. The online limit is ${MAX_PAGES}.`);
  }
  return pages;
}

/**
 * Keeps the last path part only, strips control characters, collapses spaces
 * and caps the length, keeping the extension when there is one.
 * @param {unknown} raw
 * @returns {string}
 */
export function cleanFileName(raw) {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'upload';
  if (cleaned.length <= FILE_NAME_MAX) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, FILE_NAME_MAX - ext.length) + ext;
}

/**
 * The browser sends the name URL-encoded in a header, because header values must be ASCII.
 * @param {string | null} header
 * @returns {string}
 */
export function nameFromHeader(header) {
  if (!header) return cleanFileName('');
  let decoded = header;
  try {
    decoded = decodeURIComponent(header);
  } catch {
    // keep the raw value; cleanFileName handles it
  }
  return cleanFileName(decoded);
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * @param {string | null} raw
 * @returns {string} lower-case slug
 */
export function parseShopSlug(raw) {
  const slug = String(raw ?? '').trim().toLowerCase();
  if (!SLUG.test(slug)) {
    throw new UploadError(400, 'bad_shop', 'The shop link is not valid.');
  }
  return slug;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}
