// Licence status for the owner's read-only licence screen (Stage 7E).
//
// The only data source is the owner RPC public.shop_licence_status(p_shop_id)
// (migration 0016). Its reply is checked here against that contract. A reply that
// does not match it, a failed request and a missing session all count as
// "unavailable". None of them is ever shown as an active licence.
//
// This file has no DOM and makes no requests itself. owner-licence.js draws the
// result. Keeping the rules here lets them be tested without a browser.

export const VIEW = Object.freeze({
  IDLE: 'idle', // no shop is open
  LOADING: 'loading', // a check is running; nothing from earlier checks is shown
  READY: 'ready', // the last check returned a valid status
  UNAVAILABLE: 'unavailable', // the last check failed, or its reply was not understood
});

export const STATE = Object.freeze({
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  // The RPC does not say whether coverage expired, was revoked or never existed.
  // All three arrive as this one state, so the screen cannot name them.
  INACTIVE: 'inactive',
});

export const REASON = Object.freeze({
  OFFLINE: 'offline', // this device is offline; no request was sent
  NETWORK: 'network', // the request did not reach the server
  SERVER: 'server', // the server failed or is busy (5xx, 408, 429)
  SERVICE_MISSING: 'service_missing', // the RPC does not exist on this server (404)
  AUTH: 'auth', // no session, or the server rejected it (401, 403)
  FORBIDDEN: 'forbidden', // the RPC refused: the signed-in user is not an owner of this shop
  MALFORMED: 'malformed', // the reply does not match the contract
  UNKNOWN: 'unknown', // any other failure
});

// ISO 8601 with a stated offset or Z. Without one, Date.parse reads local time,
// which would make the result depend on the device.
const TIMESTAMP_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const REPLY_KEYS = ['ok', 'active', 'no_expiry', 'access_end', 'next_start'];

const MALFORMED = Object.freeze({ ok: false, reason: REASON.MALFORMED });
const FORBIDDEN = Object.freeze({ ok: false, reason: REASON.FORBIDDEN });

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullOrString(value) {
  return value === null || typeof value === 'string';
}

// Milliseconds for a timestamp that states its zone, or NaN.
function instantMs(value) {
  if (typeof value !== 'string' || !TIMESTAMP_WITH_ZONE.test(value)) return NaN;
  return Date.parse(value);
}

// Checks one reply of shop_licence_status. Returns { ok: true, state, lifetime,
// accessEndMs, nextStartMs } or { ok: false, reason }. Only the shapes the
// database can produce are accepted. Anything else is malformed. A missing or
// unclear field is never read as active.
export function parseLicenceStatus(raw) {
  if (!isPlainObject(raw)) return MALFORMED;
  if (raw.ok === false) return raw.code === 'forbidden' ? FORBIDDEN : MALFORMED;
  if (raw.ok !== true) return MALFORMED;
  if (!REPLY_KEYS.every((key) => key in raw)) return MALFORMED;

  const { active, no_expiry: noExpiry, access_end: accessEnd, next_start: nextStart } = raw;
  if (typeof active !== 'boolean' || typeof noExpiry !== 'boolean') return MALFORMED;
  if (!isNullOrString(accessEnd) || !isNullOrString(nextStart)) return MALFORMED;

  if (active) {
    // ACTIVE has no next start. It has either no expiry (lifetime) or an end time, never both.
    if (nextStart !== null) return MALFORMED;
    if (noExpiry) {
      if (accessEnd !== null) return MALFORMED;
      return { ok: true, state: STATE.ACTIVE, lifetime: true, accessEndMs: null, nextStartMs: null };
    }
    const endMs = instantMs(accessEnd);
    if (Number.isNaN(endMs)) return MALFORMED;
    return { ok: true, state: STATE.ACTIVE, lifetime: false, accessEndMs: endMs, nextStartMs: null };
  }

  // Not active: no end time and no lifetime flag.
  if (noExpiry || accessEnd !== null) return MALFORMED;
  if (nextStart === null) {
    return { ok: true, state: STATE.INACTIVE, lifetime: false, accessEndMs: null, nextStartMs: null };
  }
  const startMs = instantMs(nextStart);
  if (Number.isNaN(startMs)) return MALFORMED;
  return { ok: true, state: STATE.SCHEDULED, lifetime: false, accessEndMs: null, nextStartMs: startMs };
}

// Why a request failed. Offline is decided by the device, before any request is sent,
// so it is never mistaken for an inactive licence.
export function failureReason(err, online = true) {
  if (online === false) return REASON.OFFLINE;
  if (err instanceof TypeError) return REASON.NETWORK; // fetch rejects with a TypeError when no reply arrives
  const status = err?.status;
  if (status === 401 || status === 403) return REASON.AUTH;
  if (status === 404 || err?.code === 'PGRST202') return REASON.SERVICE_MISSING;
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return REASON.SERVER;
  return REASON.UNKNOWN;
}

// True when a checked status has a time that is now in the past. The status was
// true when it was checked, so the screen asks for a refresh rather than
// presenting it as current. Lifetime and inactive never pass.
export function timeHasPassed(status, nowMs) {
  if (!status || status.lifetime) return false;
  if (status.state === STATE.ACTIVE) return status.accessEndMs <= nowMs;
  if (status.state === STATE.SCHEDULED) return status.nextStartMs <= nowMs;
  return false;
}

const IST_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// For example "1 Jan 2028, 00:00 IST". The end of access is exclusive: the stated
// moment is the first moment without access (decision 9). The access line wording is approved
// (owner decision 2, 2026-11-09). The other display labels were approved by the owner on the same
// date (item 13 / decision 19).
export function formatIst(ms) {
  return `${IST_FORMAT.format(ms)} IST`;
}

const REASON_TEXT = Object.freeze({
  [REASON.OFFLINE]: 'This device is offline, so the status could not be checked. Nothing from earlier checks is shown.',
  [REASON.NETWORK]: 'The server could not be reached, so the status could not be checked. Nothing from earlier checks is shown.',
  [REASON.SERVER]: 'The server is busy or unavailable, so the status could not be checked. Try again shortly.',
  [REASON.SERVICE_MISSING]: 'The licence status service is not available on this server yet, so the status could not be checked.',
  [REASON.AUTH]: 'Your session has ended. Sign in again to check the licence status.',
  [REASON.FORBIDDEN]: 'Your account cannot see the licence status for this shop.',
  [REASON.MALFORMED]: 'The server sent a reply this page cannot read, so the status could not be checked.',
  [REASON.UNKNOWN]: 'The status could not be checked. Try again.',
});

// Turns the view state into plain text and flags for the page. Nothing here is
// HTML; the page escapes every value it draws. An unavailable view never shows an active licence.
// There is no printing-permitted line: it is removed until Stage 7F enforcement exists (owner, 2026-11-09).
export function describeView(view, nowMs) {
  const base = {
    badge: '',
    tone: 'muted',
    summary: '',
    nextStart: '', // the next access start, shown on its own line (scheduled only)
    needsRefresh: false,
    signIn: false,
    checkedText: '',
    busy: false,
  };
  if (!view || view.phase === VIEW.IDLE) return base;

  if (view.phase === VIEW.LOADING) {
    return { ...base, badge: 'Checking…', summary: 'Checking the licence status…', busy: true };
  }

  if (view.phase === VIEW.UNAVAILABLE) {
    return {
      ...base,
      badge: 'Status unavailable',
      tone: 'error',
      summary: REASON_TEXT[view.reason] ?? REASON_TEXT[REASON.UNKNOWN],
      signIn: view.reason === REASON.AUTH,
      checkedText: `Last attempt ${formatIst(view.attemptedAt)}. No status from earlier checks is shown.`,
    };
  }

  // READY
  const status = view.status;
  const checkedText = `Last checked ${formatIst(view.checkedAt)}.`;
  const passed = timeHasPassed(status, nowMs);

  if (status.state === STATE.ACTIVE) {
    if (status.lifetime) {
      return {
        ...base,
        badge: 'Active',
        tone: 'ok',
        summary: 'Lifetime access. No expiry.',
        checkedText,
      };
    }
    if (passed) {
      return {
        ...base,
        badge: 'Check again',
        tone: 'warn',
        summary: `The end time (${formatIst(status.accessEndMs)}) has passed since the last check. Refresh to see the current status.`,
        needsRefresh: true,
        checkedText,
      };
    }
    return {
      ...base,
      badge: 'Active',
      tone: 'ok',
      summary: `Access until ${formatIst(status.accessEndMs)}.`,
      checkedText,
    };
  }

  if (status.state === STATE.SCHEDULED) {
    if (passed) {
      return {
        ...base,
        badge: 'Check again',
        tone: 'warn',
        summary: `The start time (${formatIst(status.nextStartMs)}) has passed since the last check. Refresh to see the current status.`,
        needsRefresh: true,
        checkedText,
      };
    }
    return {
      ...base,
      badge: 'Not active',
      tone: 'muted',
      summary: 'No access is active now.',
      nextStart: `The next access starts ${formatIst(status.nextStartMs)}.`,
      checkedText,
    };
  }

  // INACTIVE: the RPC gives no reason, so none is shown.
  return {
    ...base,
    badge: 'Not active',
    tone: 'muted',
    summary: 'No printing access is active for this shop.',
    checkedText,
  };
}

// Owns the state of the licence screen. It runs the checks and keeps only the
// reply that matches the current request. Every open and every close starts a new
// generation, so a reply from an earlier shop or from before sign-out is dropped.
// Overlapping refresh presses share one request.
//
//   loadStatus(shopId) -> the raw RPC reply (rejects on HTTP or network errors)
//   now()              -> milliseconds (injected for tests)
//   isOnline()         -> false when the device reports no connection
//   onChange(view)     -> called with a copy of the view after each change
export function createLicenceStatusController({
  loadStatus,
  now = () => Date.now(),
  isOnline = () => globalThis.navigator?.onLine !== false,
  onChange = () => {},
}) {
  let generation = 0;
  let inFlight = null;
  let view = emptyView();

  function emptyView() {
    return { phase: VIEW.IDLE, shopId: null, status: null, reason: null, checkedAt: null, attemptedAt: null };
  }

  // A copy, including the status, so a caller cannot change the state by editing what it was given.
  function snapshot() {
    return { ...view, status: view.status ? { ...view.status } : null };
  }

  function publish(next) {
    view = next;
    onChange(snapshot());
    return snapshot();
  }

  // Shows a shop and checks its status. A reply for an earlier shop is dropped.
  function open(shopId) {
    generation += 1;
    inFlight = null;
    publish({ ...emptyView(), shopId });
    return refresh();
  }

  // Checks again for the open shop. A press while a check is running gets the same promise.
  function refresh() {
    if (!view.shopId) return Promise.resolve(snapshot());
    if (inFlight) return inFlight;
    const token = generation;
    const shopId = view.shopId;
    publish({ ...emptyView(), shopId, phase: VIEW.LOADING });
    inFlight = settle(token, shopId);
    return inFlight;
  }

  async function settle(token, shopId) {
    let next;
    if (!isOnline()) {
      next = unavailable(shopId, REASON.OFFLINE);
    } else {
      try {
        const parsed = parseLicenceStatus(await loadStatus(shopId));
        next = parsed.ok ? ready(shopId, parsed) : unavailable(shopId, parsed.reason);
      } catch (err) {
        next = unavailable(shopId, failureReason(err, isOnline()));
      }
    }
    if (token !== generation) return snapshot(); // the owner moved on; this reply is not shown
    inFlight = null;
    return publish(next);
  }

  function ready(shopId, status) {
    const at = now();
    return { phase: VIEW.READY, shopId, status, reason: null, checkedAt: at, attemptedAt: at };
  }

  function unavailable(shopId, reason) {
    return { phase: VIEW.UNAVAILABLE, shopId, status: null, reason, checkedAt: null, attemptedAt: now() };
  }

  // Ends whatever is open (page left, shop closed or sign-out). Any reply still
  // in flight is dropped when it arrives.
  function close() {
    generation += 1;
    inFlight = null;
    return publish(emptyView());
  }

  return { open, refresh, close, getView: snapshot };
}
