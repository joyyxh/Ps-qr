// Builds the payloads for the four approved 7C admin RPCs and calls them. The server is the only
// authority: it checks the admin identity, aal2, the state version, the reason and every licence
// rule. This module only shapes requests and reads the committed result.

import {
  EXTENSION_UNITS,
  GRANT_KINDS,
  isUuid,
  normaliseInstant,
  normaliseReason,
  parseStateVersion,
} from './validate.js';
import { fetchWithTimeout, readJson } from './http.js';

export const ACTIONS = Object.freeze(['grant', 'extend', 'revoke', 'replace']);

// Must match licence_admin_allowed_keys() in supabase/migrations/0016_licence_admin_rpcs.sql.
// tests/licence-api.test.js reads that file and fails on any difference.
export const ALLOWED_KEYS = Object.freeze({
  grant: ['shop_id', 'expected_state_version', 'confirm', 'reason', 'grant_kind', 'start', 'end', 'backdate_confirm'],
  extend: ['shop_id', 'expected_state_version', 'confirm', 'reason', 'extension_unit'],
  revoke: ['shop_id', 'expected_state_version', 'confirm', 'reason', 'target_coverage_id'],
  replace: [
    'shop_id', 'expected_state_version', 'confirm', 'reason',
    'target_coverage_id', 'grant_kind', 'start', 'end', 'backdate_confirm',
  ],
});

export function rpcName(action) {
  return `licence_admin_${action}`;
}

// Returns { ok, payload, errors }. errors maps a field name to a message for the form.
// The payload has exactly the keys ALLOWED_KEYS lists for the action. Optional values are null.
export function buildLicencePayload(action, raw) {
  if (!ACTIONS.includes(action)) {
    return { ok: false, payload: null, errors: { action: 'Choose an action.' } };
  }
  const errors = {};
  const values = {};

  const shopId = String(raw.shop_id ?? '').trim().toLowerCase();
  if (isUuid(shopId)) values.shop_id = shopId;
  else errors.shop_id = 'Enter the shop ID (a UUID).';

  const version = parseStateVersion(raw.expected_state_version);
  if (version.ok) values.expected_state_version = version.value;
  else errors.expected_state_version = version.message;

  const reason = normaliseReason(raw.reason);
  if (reason.ok) values.reason = reason.value;
  else errors.reason = reason.message;

  if (raw.confirm === true) values.confirm = true;
  else errors.confirm = 'Tick the confirmation box to continue.';

  if (action === 'grant' || action === 'replace') {
    if (GRANT_KINDS.includes(raw.grant_kind)) values.grant_kind = raw.grant_kind;
    else errors.grant_kind = 'Choose a licence type.';
    const start = normaliseInstant(raw.start);
    if (start.ok) values.start = start.value;
    else errors.start = start.message;
    const end = normaliseInstant(raw.end);
    if (end.ok) values.end = end.value;
    else errors.end = end.message;
    values.backdate_confirm = raw.backdate_confirm === true;
  }

  if (action === 'extend') {
    if (EXTENSION_UNITS.includes(raw.extension_unit)) values.extension_unit = raw.extension_unit;
    else errors.extension_unit = 'Choose one calendar month or one calendar year.';
  }

  if (action === 'revoke' || action === 'replace') {
    const target = String(raw.target_coverage_id ?? '').trim().toLowerCase();
    if (isUuid(target)) values.target_coverage_id = target;
    else errors.target_coverage_id = 'Choose the coverage to change from the licence view.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, payload: null, errors };

  const payload = Object.fromEntries(ALLOWED_KEYS[action].map((key) => [key, values[key] ?? null]));
  return { ok: true, payload, errors: {} };
}

// Stable text for comparing two payloads, independent of key order.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function defaultRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// The same request ID is reused only for an identical retry after an unknown result. The server
// then returns the stored result (replay) instead of writing twice. Any other submission gets a new ID.
export function createRequestTracker(makeId = defaultRequestId) {
  let pending = null;
  return {
    requestIdFor(action, payload) {
      const fingerprint = `${action}:${stableStringify(payload)}`;
      if (pending && pending.fingerprint === fingerprint) return pending.requestId;
      pending = { fingerprint, requestId: makeId() };
      return pending.requestId;
    },
    // Call with true after a committed outcome (success or a committed rejection).
    // Call with false, or do not call, after an unknown outcome, so a retry reuses the ID.
    settle(committed) {
      if (committed) pending = null;
    },
    reset() {
      pending = null;
    },
  };
}

// Result kinds:
//   result   the server answered with a committed jsonb result (ok true or ok false)
//   session  the access token was refused (sign in again)
//   unknown  the request may or may not have committed (network failure, timeout or 5xx). Retry with the same request ID.
//   error    the server refused the call before committing (non-5xx HTTP error). Nothing was committed.
export async function callLicenceRpc({ config, fetchImpl, accessToken, action, requestId, payload, timeoutMs = 15000 }) {
  if (!config || !config.supabaseUrl || !config.publishableKey) {
    return { kind: 'error', message: 'The admin panel is not configured for this deployment.' };
  }
  if (!ACTIONS.includes(action)) return { kind: 'error', message: 'Unknown action.' };

  let response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      `${config.supabaseUrl}/rest/v1/rpc/${rpcName(action)}`,
      {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ p_request_id: requestId, p_payload: payload }),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      },
      timeoutMs,
    );
  } catch {
    return { kind: 'unknown' };
  }

  if (response.status === 401) return { kind: 'session' };
  if (response.status >= 500) return { kind: 'unknown' };
  if (!response.ok) {
    return { kind: 'error', message: 'The server did not accept the request. Nothing was changed.' };
  }
  const body = await readJson(response);
  if (!body || typeof body !== 'object' || typeof body.ok !== 'boolean') return { kind: 'unknown' };
  return { kind: 'result', data: body };
}
