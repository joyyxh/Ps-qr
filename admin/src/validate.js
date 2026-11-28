// Client-side shape checks only. The server decides every licence rule: kind-specific dates,
// overlaps, lifetime precedence, the state version, confirmation and the reason contract. It
// returns a committed code for each rejection. Do not add licence rules here.

export const GRANT_KINDS = Object.freeze(['one_month', 'one_year', 'custom', 'lifetime']);
export const EXTENSION_UNITS = Object.freeze(['month', 'year']);
export const REASON_MAX_CHARS = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same shape the server accepts for expected_state_version (a JSON number, up to 18 digits).
const VERSION_RE = /^(0|[1-9][0-9]{0,17})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function parseStateVersion(value) {
  const text = String(value ?? '').trim();
  if (!VERSION_RE.test(text)) {
    return { ok: false, message: 'Enter the shop’s current state version as a whole number (0 or more).' };
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number)) {
    return { ok: false, message: 'The state version is too large to enter here.' };
  }
  return { ok: true, value: number };
}

export function normaliseReason(value) {
  const text = String(value ?? '').trim();
  const length = Array.from(text).length;
  if (length < 1) return { ok: false, message: 'Enter a reason. It is recorded in the audit log.' };
  if (length > REASON_MAX_CHARS) {
    return { ok: false, message: `The reason must be ${REASON_MAX_CHARS} characters or fewer.` };
  }
  return { ok: true, value: text };
}

// Empty means null (no value). A date (YYYY-MM-DD) or a timestamp with a zone is passed through as typed.
// The server interprets it (date-only means 00:00 Asia/Kolkata).
export function normaliseInstant(value) {
  const text = String(value ?? '').trim();
  if (text === '') return { ok: true, value: null };
  if (!DATE_RE.test(text) && !TIMESTAMP_RE.test(text)) {
    return {
      ok: false,
      message: 'Use YYYY-MM-DD, or a timestamp with a time zone such as 2026-11-08T10:00:00+05:30.',
    };
  }
  return { ok: true, value: text };
}
