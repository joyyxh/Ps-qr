// Read calls for the admin panel: shop search, one shop's licence view (with its state version and coverage
// IDs), and the paginated audit history. They use the three read RPCs in migration 0017. The server checks
// the admin identity, aal2 and the shop on every call. This module shapes the request, checks the shape of
// the response, and renders nothing. Reads change nothing, so they carry no request ID and need no retry
// logic: a failed read is simply shown as failed.

import { fetchWithTimeout, readJson } from './http.js';
import { isUuid } from './validate.js';

export const READ_RPCS = Object.freeze({
  search: 'admin_search_shops',
  licence: 'admin_shop_licence',
  audit: 'admin_shop_audit',
});

// Parameter names and their order. They must match the function signatures in
// supabase/migrations/0017_licence_admin_read_rpcs.sql. tests/read-api.test.js reads that file and checks them.
export const READ_PARAMS = Object.freeze({
  admin_search_shops: Object.freeze(['p_query', 'p_limit']),
  admin_shop_licence: Object.freeze(['p_shop_id']),
  admin_shop_audit: Object.freeze(['p_shop_id', 'p_after_created_at', 'p_after_id', 'p_limit']),
});

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 80;
export const SEARCH_LIMIT = 10;
export const AUDIT_PAGE_SIZE = 25;

const COVERAGE_KINDS = Object.freeze(['admin_grant', 'lifetime_grant']);
const COVERAGE_STATUSES = Object.freeze(['current', 'scheduled']);
const LICENCE_STATES = Object.freeze(['ACTIVE', 'SCHEDULED', 'REVOKED', 'EXPIRED', 'NONE']);
const AUDIT_ACTIONS = Object.freeze(['grant', 'extend', 'revoke', 'replace', 'enforcement_change']);
// The same shape the server writes for timestamps (microseconds allowed, with a zone).
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

const NOT_CONFIGURED = 'The admin panel is not configured for this deployment.';
const UNREADABLE = 'The server sent a response this panel cannot read. Nothing was changed.';
const UNREACHABLE = 'Could not reach the server. Nothing was changed. Try again.';
const REFUSED = 'The server could not load this. Nothing was changed. Try again.';

// ---------- request shaping (client shape checks only; the server decides) ----------

export function buildSearchBody(rawQuery) {
  const text = String(rawQuery ?? '').trim();
  const length = Array.from(text).length;
  if (length < SEARCH_MIN_CHARS || length > SEARCH_MAX_CHARS) {
    return {
      ok: false,
      message: `Enter between ${SEARCH_MIN_CHARS} and ${SEARCH_MAX_CHARS} characters of a shop name, slug or ID.`,
    };
  }
  return { ok: true, body: { p_query: text, p_limit: SEARCH_LIMIT } };
}

export function buildLicenceBody(shopId) {
  if (!isUuid(shopId)) return { ok: false, message: 'Choose a shop from the search results first.' };
  return { ok: true, body: { p_shop_id: shopId } };
}

// cursor is null for the first page, or the next object from the previous page.
export function buildAuditBody(shopId, cursor = null) {
  if (!isUuid(shopId)) return { ok: false, message: 'Choose a shop from the search results first.' };
  if (cursor === null) {
    return {
      ok: true,
      body: { p_shop_id: shopId, p_after_created_at: null, p_after_id: null, p_limit: AUDIT_PAGE_SIZE },
    };
  }
  if (!isCursor(cursor)) return { ok: false, message: 'The audit cursor is not valid. Reload the history.' };
  return {
    ok: true,
    body: {
      p_shop_id: shopId,
      p_after_created_at: cursor.created_at,
      p_after_id: cursor.entry_id,
      p_limit: AUDIT_PAGE_SIZE,
    },
  };
}

// ---------- the call ----------

// Result kinds:
//   result    ok true, and the response has the expected shape (data)
//   rejected  ok false with a committed code (for example shop_not_found or forbidden)
//   session   the access token was refused (sign in again)
//   error     anything else: not configured, unreachable, a non-2xx status, or an unreadable response
export async function callReadRpc({ config, fetchImpl, accessToken, rpc, body, timeoutMs = 15000 }) {
  if (!config || !config.supabaseUrl || !config.publishableKey) return { kind: 'error', message: NOT_CONFIGURED };
  if (!Object.prototype.hasOwnProperty.call(READ_PARAMS, rpc)) return { kind: 'error', message: UNREADABLE };
  const keys = body && typeof body === 'object' ? Object.keys(body) : [];
  if (keys.join(',') !== READ_PARAMS[rpc].join(',')) return { kind: 'error', message: UNREADABLE };

  let response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      `${config.supabaseUrl}/rest/v1/rpc/${rpc}`,
      {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      },
      timeoutMs,
    );
  } catch {
    return { kind: 'error', message: UNREACHABLE };
  }

  if (response.status === 401) return { kind: 'session' };
  if (!response.ok) return { kind: 'error', message: REFUSED };

  const data = await readJson(response);
  if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean') return { kind: 'error', message: UNREADABLE };
  if (data.ok === false) return { kind: 'rejected', code: String(data.code ?? '') };
  if (!hasReadShape(rpc, data)) return { kind: 'error', message: UNREADABLE };
  return { kind: 'result', data };
}

// ---------- response shape ----------

export function hasReadShape(rpc, data) {
  if (rpc === READ_RPCS.search) {
    return Array.isArray(data.shops) && typeof data.has_more === 'boolean' && data.shops.every(isShopItem);
  }
  if (rpc === READ_RPCS.licence) {
    return (
      isShopItem(data.shop) &&
      isVersion(data.state_version) &&
      isLicenceState(data.state) &&
      Array.isArray(data.coverages) &&
      data.coverages.every(isCoverage) &&
      typeof data.coverages_truncated === 'boolean'
    );
  }
  if (rpc === READ_RPCS.audit) {
    return (
      Array.isArray(data.entries) &&
      data.entries.every(isAuditEntry) &&
      (data.next === null || isCursor(data.next))
    );
  }
  return false;
}

function isTimestamp(value) {
  return typeof value === 'string' && TIMESTAMP_RE.test(value);
}

function isTimestampOrNull(value) {
  return value === null || isTimestamp(value);
}

function isShopItem(item) {
  return Boolean(item) && typeof item === 'object' && isUuid(item.shop_id) &&
    typeof item.slug === 'string' && typeof item.name === 'string';
}

function isVersion(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isLicenceState(value) {
  return Boolean(value) && typeof value === 'object' && LICENCE_STATES.includes(value.state) &&
    (value.basis === null || typeof value.basis === 'string') &&
    isTimestampOrNull(value.access_until) && isTimestampOrNull(value.next_start);
}

function isCoverage(item) {
  return Boolean(item) && typeof item === 'object' && isUuid(item.coverage_id) &&
    COVERAGE_KINDS.includes(item.kind) && COVERAGE_STATUSES.includes(item.status) &&
    isTimestamp(item.starts_at) && isTimestampOrNull(item.ends_at) &&
    typeof item.reason === 'string';
}

function isAuditEntry(item) {
  return Boolean(item) && typeof item === 'object' && isUuid(item.entry_id) &&
    isTimestamp(item.created_at) && AUDIT_ACTIONS.includes(item.action) &&
    (item.coverage_id === null || isUuid(item.coverage_id)) &&
    typeof item.reason === 'string' &&
    isTimestampOrNull(item.licence_start) && isTimestampOrNull(item.licence_end) &&
    isUuid(item.actor_user_id);
}

function isCursor(value) {
  return Boolean(value) && typeof value === 'object' && isTimestamp(value.created_at) && isUuid(value.entry_id);
}
