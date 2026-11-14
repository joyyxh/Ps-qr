// DOM wiring for the private platform admin panel. Every value from the server is written with
// textContent, never as HTML. Tokens live only in this module's memory: they are not stored, logged or
// put in a URL. The server checks identity, aal2 and every licence rule on each call.
//
// Reads (shop search, a shop's licence view and its audit history) run one at a time. The panel disables
// its controls while a read is in flight, so two calls never refresh the session at the same moment.

import {
  AuthError,
  assuranceLevel,
  enrolTotp,
  getUserWithFactors,
  nextAuthStep,
  needsRefresh,
  refreshSession,
  signInWithPassword,
  signOut,
  verifyTotp,
} from './auth.js';
import { ACTIONS, buildLicencePayload, callLicenceRpc, createRequestTracker } from './licence-api.js';
import { READ_RPCS, SEARCH_LIMIT, buildAuditBody, buildLicenceBody, buildSearchBody, callReadRpc } from './read-api.js';
import { auditRows, coverageLabel, licenceFacts } from './read-model.js';
import { GENERIC_REJECTION, rejectionMessage } from './messages.js';
import { qrImageSource } from './qr.js';
import { isUsableConfig } from './config-guard.js';

const config = globalThis.QRQUICK_ADMIN_CONFIG ?? {};
const $ = (id) => document.getElementById(id);
const tracker = createRequestTracker();

const ACTION_LABELS = Object.freeze({
  grant: 'Grant a licence',
  extend: 'Extend the current licence',
  revoke: 'Revoke a coverage',
  replace: 'Replace a coverage',
});
const GRANT_LABELS = Object.freeze({
  one_month: 'One calendar month',
  one_year: 'One calendar year',
  custom: 'Custom dates',
  lifetime: 'Lifetime',
});
const EXTENSION_LABELS = Object.freeze({ month: 'One calendar month', year: 'One calendar year' });
const SESSION_ENDED = 'Your session has ended. Sign in again.';
const UNKNOWN_RESULT = 'The result is not known. The request may or may not have been committed. Press Retry to send the same request again. If it was already committed, the stored result is returned and nothing is written twice.';

const state = {
  session: null,          // { accessToken, refreshToken, expiresAt } in memory only
  email: '',
  factors: [],
  enrolFactorId: null,
  review: null,           // { action, payload } awaiting the admin's confirmation
  unknownPending: null,   // { action, payload, requestId } after an unknown outcome, until a committed result
  busy: false,            // a sign-in, step-up or write is in progress
  reading: 0,             // number of reads in flight
  sessionGeneration: 0,   // changes on sign-out or session end, so an in-flight refresh cannot keep old tokens
  shop: null,             // { shop_id, slug, name } chosen from the search
  epoch: 0,               // changes when the chosen shop changes or the read view is reset
  licence: null,          // the last admin_shop_licence data for state.shop
  audit: null,            // { entries, next } for state.shop
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function fetchImpl(url, init) {
  return globalThis.fetch(url, init);
}

// ---------- views and messages ----------

const VIEWS = ['config', 'signin', 'enrol', 'totp', 'dashboard'];

function showView(name, focusId) {
  for (const view of VIEWS) $(`view-${view}`).hidden = view !== name;
  $('sign-out').hidden = name === 'config' || name === 'signin' || !state.session;
  $('whoami').hidden = !state.session || name === 'signin' || name === 'config';
  if (focusId) $(focusId).focus();
}

function setStatus(text) {
  $('global-status').textContent = text ?? '';
}

function setError(id, text) {
  const el = $(id);
  el.textContent = text ?? '';
  el.hidden = !text;
}

function clearFormErrors() {
  for (const el of document.querySelectorAll('[data-error-for]')) {
    el.textContent = '';
    el.hidden = true;
  }
}

function showFormErrors(errors) {
  clearFormErrors();
  let first = null;
  for (const [field, message] of Object.entries(errors)) {
    if (field === 'action') {
      setStatus(message);
      continue;
    }
    const el = document.querySelector(`[data-error-for="${field}"]`);
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
    if (!first && $(field)) first = field;
  }
  if (first) $(first).focus();
}

function setBusy(busy) {
  state.busy = busy;
  applyControlState();
}

// Every button follows one rule: all are off while a write, sign-in or read is in flight. Sign-out stays
// available. The review button also needs a loaded licence view, and refresh needs a chosen shop.
function applyControlState() {
  const locked = state.busy || state.reading > 0;
  const hasLicence = state.shop !== null && state.licence !== null;
  for (const button of document.querySelectorAll('button')) {
    if (button.id === 'sign-out') continue;
    let off = locked;
    if (button.id === 'review-submit') off = off || !hasLicence;
    if (button.id === 'licence-refresh') off = off || state.shop === null;
    button.disabled = off;
  }
}

// ---------- sign-in and step-up ----------

function goSignIn(message) {
  state.session = null;
  state.sessionGeneration += 1;
  state.factors = [];
  state.enrolFactorId = null;
  state.review = null;
  tracker.reset();
  $('password').value = '';
  $('whoami').textContent = '';
  resetReadState();
  showView('signin', 'email');
  setStatus(message ?? '');
}

async function routeByAuthStep() {
  const step = nextAuthStep({ accessToken: state.session?.accessToken, factors: state.factors });
  if (step === 'ready') {
    showDashboard();
    return;
  }
  if (step === 'verify_totp') {
    showView('totp', 'totp-code');
    setStatus('Enter the code from your authenticator app.');
    return;
  }
  if (step === 'enrol_totp') {
    const enrol = await enrolTotp({ config, fetchImpl, accessToken: state.session.accessToken });
    state.enrolFactorId = enrol.factorId;
    const src = qrImageSource(enrol.qrCode);
    const img = $('enrol-qr');
    img.hidden = !src;
    if (src) {
      img.src = src;
    } else {
      img.removeAttribute('src');
    }
    $('enrol-secret').textContent = enrol.secret;
    showView('enrol', 'totp-enrol');
    setStatus('Set up the authenticator to continue.');
    return;
  }
  goSignIn('Sign in to continue.');
}

function verifiedTotpFactorId() {
  const factor = state.factors.find((f) => f && f.factor_type === 'totp' && f.status === 'verified');
  return factor ? factor.id : null;
}

async function completeTotp(factorId, code) {
  const session = await verifyTotp({ config, fetchImpl, accessToken: state.session.accessToken, factorId, code });
  state.session = session;
  if (assuranceLevel(session.accessToken) !== 'aal2') {
    setError('totp-error', 'The code was not accepted. Try again.');
    setError('enrol-error', 'The code was not accepted. Try again.');
    return;
  }
  setError('totp-error', '');
  setError('enrol-error', '');
  await routeByAuthStep();
}

async function ensureFreshSession() {
  const session = state.session;
  if (!session) throw new AuthError(SESSION_ENDED);
  if (!needsRefresh(session.expiresAt, nowSeconds())) return session;
  if (!session.refreshToken) throw new AuthError(SESSION_ENDED);
  const generation = state.sessionGeneration;
  const next = await refreshSession({ config, fetchImpl, refreshToken: session.refreshToken });
  // The admin may have signed out while the refresh was in flight. Do not keep the new tokens.
  if (generation !== state.sessionGeneration) throw new AuthError('You have signed out.', 'signedout');
  state.session = next;
  if (assuranceLevel(next.accessToken) !== 'aal2') {
    // Step up: the refreshed session is not aal2, so send the admin to the authenticator screen.
    await routeByAuthStep();
    throw new AuthError('Enter the authenticator code to continue.', 'stepup');
  }
  return next;
}

function handleSessionError(error) {
  if (error instanceof AuthError && error.kind === 'signedout') return;
  if (error instanceof AuthError && error.kind === 'network') {
    setStatus(`${error.message} Nothing was sent.`);
  } else if (error instanceof AuthError && error.kind === 'stepup') {
    setStatus(error.message);
  } else if (error instanceof AuthError) {
    goSignIn(error.message);
  } else {
    setStatus('Something went wrong. Nothing was shown as done. Try again.');
  }
}

// ---------- dashboard ----------

function showDashboard() {
  $('whoami').textContent = state.email || 'Signed in';
  showView('dashboard', 'shop-title');
  setActionVisibility();
  setStatus('');
}

function currentAction() {
  const value = $('action').value;
  return ACTIONS.includes(value) ? value : 'grant';
}

function setActionVisibility() {
  const action = currentAction();
  for (const el of document.querySelectorAll('[data-actions]')) {
    const actions = el.dataset.actions.split(' ');
    el.hidden = !actions.includes(action);
  }
}

function readForm() {
  return {
    action: currentAction(),
    shop_id: $('shop_id').value,
    expected_state_version: $('expected_state_version').value,
    target_coverage_id: $('target_coverage_id').value,
    grant_kind: $('grant_kind').value,
    start: $('start').value,
    end: $('end').value,
    backdate_confirm: $('backdate_confirm').checked,
    extension_unit: $('extension_unit').value,
    reason: $('reason').value,
    confirm: $('confirm').checked,
  };
}

function appendRow(list, label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  list.append(dt, dd);
}

function fillRows(list, rows) {
  list.replaceChildren();
  for (const [label, value] of rows) appendRow(list, label, value);
}

// ---------- read views: shop search, licence view, audit history ----------

// Returns the text for a read that did not give a result. A rejected read shows its committed message.
function readProblem(outcome) {
  if (outcome.kind === 'rejected') return rejectionMessage(outcome.code);
  return outcome.message ?? GENERIC_REJECTION;
}

// One read at a time. The caller handles a thrown session error and a 'session' outcome.
async function readCall(rpc, body) {
  state.reading += 1;
  applyControlState();
  try {
    const session = await ensureFreshSession();
    return await callReadRpc({ config, fetchImpl, accessToken: session.accessToken, rpc, body });
  } finally {
    state.reading -= 1;
    applyControlState();
  }
}

function resetReadState() {
  state.epoch += 1;
  state.shop = null;
  state.licence = null;
  state.audit = null;
  $('shop-query').value = '';
  setError('shop-search-error', '');
  $('shop-search-status').textContent = '';
  $('shop-results').replaceChildren();
  $('shop-results').hidden = true;
  $('licence-card').hidden = true;
  setError('licence-error', '');
  $('licence-facts').replaceChildren();
  $('coverage-list').replaceChildren();
  $('audit-card').hidden = true;
  $('audit-list').replaceChildren();
  setError('audit-error', '');
  $('shop_id').value = '';
  $('expected_state_version').value = '';
  $('target_coverage_id').value = '';
  $('reason').value = '';
  $('confirm').checked = false;
  $('backdate_confirm').checked = false;
  hideReview();
  applyControlState();
}

async function runSearch(event) {
  event.preventDefault();
  setError('shop-search-error', '');
  const built = buildSearchBody($('shop-query').value);
  if (!built.ok) {
    setError('shop-search-error', built.message);
    $('shop-query').focus();
    return;
  }
  const epoch = state.epoch;
  $('shop-search-status').textContent = 'Searching.';
  try {
    const outcome = await readCall(READ_RPCS.search, built.body);
    if (outcome.kind === 'session') {
      goSignIn(SESSION_ENDED);
      return;
    }
    if (epoch !== state.epoch) return;
    $('shop-search-status').textContent = '';
    if (outcome.kind !== 'result') {
      setError('shop-search-error', readProblem(outcome));
      return;
    }
    renderSearch(outcome.data);
  } catch (error) {
    $('shop-search-status').textContent = '';
    handleSessionError(error);
  }
}

function renderSearch(data) {
  const list = $('shop-results');
  list.replaceChildren();
  for (const shop of data.shops) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.shopId = shop.shop_id;
    const name = document.createElement('strong');
    name.textContent = shop.name;
    const detail = document.createElement('small');
    detail.textContent = `${shop.slug} · ${shop.shop_id}`;
    button.append(name, detail);
    button.addEventListener('click', () => chooseShop({ shop_id: shop.shop_id, slug: shop.slug, name: shop.name }));
    item.append(button);
    list.append(item);
  }
  list.hidden = data.shops.length === 0;
  markChosenShop();
  const status = document.getElementById('shop-search-status');
  if (data.shops.length === 0) {
    status.textContent = 'No shop matches that search.';
  } else if (data.has_more) {
    status.textContent = `More than ${SEARCH_LIMIT} shops match. Narrow the search to see the rest.`;
  } else {
    status.textContent = `${data.shops.length} found. Choose a shop.`;
  }
  applyControlState();
}

function markChosenShop() {
  for (const button of document.querySelectorAll('#shop-results .pick')) {
    if (state.shop !== null && button.dataset.shopId === state.shop.shop_id) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  }
}

function chooseShop(shop) {
  state.epoch += 1;
  state.shop = shop;
  state.licence = null;
  state.audit = null;
  $('shop_id').value = shop.shop_id;
  $('expected_state_version').value = '';
  $('target_coverage_id').value = '';
  $('reason').value = '';
  $('confirm').checked = false;
  $('backdate_confirm').checked = false;
  hideReview();
  clearFormErrors();
  if (!state.unknownPending) $('result').hidden = true;
  markChosenShop();
  $('licence-card').hidden = false;
  $('licence-facts').replaceChildren();
  $('coverage-list').replaceChildren();
  setError('licence-error', '');
  $('audit-card').hidden = false;
  $('audit-list').replaceChildren();
  setError('audit-error', '');
  setStatus(`${shop.name} selected. Loading its licence.`);
  applyControlState();
  $('licence-title').focus();
  refreshShop();
}

// Reloads the chosen shop's licence view, then its first audit page. Called after a choice, a refresh and
// a committed or stale write. The reads run in order, never together.
async function refreshShop() {
  if (!state.shop) return;
  const epoch = state.epoch;
  await loadLicence();
  if (epoch === state.epoch) await loadAudit(false);
}

async function loadLicence() {
  const shop = state.shop;
  if (!shop) return;
  const epoch = state.epoch;
  let outcome;
  try {
    const built = buildLicenceBody(shop.shop_id);
    outcome = built.ok
      ? await readCall(READ_RPCS.licence, built.body)
      : { kind: 'error', message: built.message };
  } catch (error) {
    handleSessionError(error);
    return;
  }
  if (outcome.kind === 'session') {
    goSignIn(SESSION_ENDED);
    return;
  }
  if (epoch !== state.epoch) return;
  if (outcome.kind !== 'result') {
    // Without a loaded view the review stays disabled. The write RPC is never sent with an old version.
    state.licence = null;
    setError('licence-error', readProblem(outcome));
    applyControlState();
    return;
  }
  applyLicence(outcome.data);
}

function applyLicence(data) {
  state.licence = data;
  setError('licence-error', '');
  hideReview();
  fillRows($('licence-facts'), licenceFacts(data));
  $('expected_state_version').value = String(data.state_version);
  renderCoverages(data);
  const chosen = $('target_coverage_id').value;
  if (!data.coverages.some((coverage) => coverage.coverage_id === chosen)) {
    $('target_coverage_id').value = '';
  }
  setStatus('');
  applyControlState();
}

function renderCoverages(data) {
  const list = $('coverage-list');
  list.replaceChildren();
  const chosen = $('target_coverage_id').value;
  for (const coverage of data.coverages) {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'coverage';
    input.value = coverage.coverage_id;
    input.checked = coverage.coverage_id === chosen;
    input.addEventListener('change', () => chooseCoverage(coverage.coverage_id));

    const text = document.createElement('span');
    text.textContent = coverageLabel(coverage);
    const id = document.createElement('small');
    id.textContent = `Coverage ID ${coverage.coverage_id}`;
    const body = document.createElement('span');
    body.append(text, id);

    const label = document.createElement('label');
    label.className = 'check';
    label.append(input, body);
    const item = document.createElement('div');
    item.className = 'coverage-item';
    item.append(label);
    list.append(item);
  }
  $('coverage-empty').hidden = data.coverages.length > 0;
  $('coverages-truncated').hidden = !data.coverages_truncated;
}

function chooseCoverage(coverageId) {
  $('target_coverage_id').value = coverageId;
  hideReview();
  clearFormErrors();
}

// Loads the next audit page (append), or the first page and replaces the list (append false).
async function loadAudit(append) {
  const shop = state.shop;
  if (!shop) return;
  const epoch = state.epoch;
  const cursor = append ? (state.audit?.next ?? null) : null;
  if (append && cursor === null) return;
  let outcome;
  try {
    const built = buildAuditBody(shop.shop_id, cursor);
    outcome = built.ok
      ? await readCall(READ_RPCS.audit, built.body)
      : { kind: 'error', message: built.message };
  } catch (error) {
    handleSessionError(error);
    return;
  }
  if (outcome.kind === 'session') {
    goSignIn(SESSION_ENDED);
    return;
  }
  if (epoch !== state.epoch) return;
  if (outcome.kind !== 'result') {
    setError('audit-error', readProblem(outcome));
    applyControlState();
    return;
  }
  const entries = append && state.audit ? [...state.audit.entries, ...outcome.data.entries] : outcome.data.entries;
  state.audit = { entries, next: outcome.data.next };
  setError('audit-error', '');
  renderAudit();
}

function renderAudit() {
  const list = $('audit-list');
  list.replaceChildren();
  const entries = state.audit?.entries ?? [];
  for (const entry of entries) {
    const item = document.createElement('li');
    const details = document.createElement('dl');
    details.className = 'kv';
    fillRows(details, auditRows(entry));
    item.append(details);
    list.append(item);
  }
  $('audit-empty').hidden = !state.audit || entries.length > 0;
  $('audit-more').hidden = !state.audit?.next;
  applyControlState();
}

// ---------- licence change: review, send, result ----------

function showReview(action, payload) {
  const list = $('review-list');
  list.replaceChildren();
  if (state.shop) appendRow(list, 'Shop', `${state.shop.name} (${state.shop.slug})`);
  appendRow(list, 'Action', ACTION_LABELS[action]);
  appendRow(list, 'Shop ID', payload.shop_id);
  appendRow(list, 'Expected state version', String(payload.expected_state_version));
  if ('target_coverage_id' in payload) appendRow(list, 'Coverage ID', payload.target_coverage_id);
  if ('grant_kind' in payload) appendRow(list, 'Licence type', GRANT_LABELS[payload.grant_kind]);
  if ('start' in payload) appendRow(list, 'Start', payload.start ?? 'Not given');
  if ('end' in payload) appendRow(list, 'End', payload.end ?? 'Not given');
  if ('backdate_confirm' in payload) appendRow(list, 'Backdating confirmed', payload.backdate_confirm ? 'Yes' : 'No');
  if ('extension_unit' in payload) appendRow(list, 'Extend by', EXTENSION_LABELS[payload.extension_unit]);
  appendRow(list, 'Reason', payload.reason);
  $('review').hidden = false;
  $('review-confirm').focus();
}

function hideReview() {
  state.review = null;
  $('review').hidden = true;
}

function hideResult() {
  $('result').hidden = true;
}

function showResult(kind, text, rows = [], { retry = false } = {}) {
  const panel = $('result');
  panel.hidden = false;
  const p = $('result-text');
  p.textContent = text;
  p.className = kind === 'ok' ? 'result-ok' : kind === 'bad' ? 'result-bad' : '';
  fillRows($('result-list'), rows);
  $('result-actions').hidden = !retry;
  $('result-title').focus();
}

function showCommitted(data, pending, sameShop) {
  const rows = [
    ['Shop ID', pending.payload.shop_id],
    ['Action', ACTION_LABELS[pending.action]],
    ['Coverage ID', data.coverage_id ?? 'Not applicable'],
    ['Target coverage ID', data.target_coverage_id ?? 'Not applicable'],
    ['New state version', String(data.state_version_after ?? '')],
  ];
  const text = data.replay
    ? 'This request had already been committed. The stored result is shown and nothing new was written.'
    : 'Change committed and recorded in the audit log.';
  showResult('ok', text, rows);
  if (sameShop) {
    if (typeof data.state_version_after === 'number') {
      $('expected_state_version').value = String(data.state_version_after);
    }
    $('confirm').checked = false;
    $('backdate_confirm').checked = false;
    $('reason').value = '';
  }
  hideReview();
}

function showRejected(code, pending) {
  showResult('bad', rejectionMessage(code), [
    ['Shop ID', pending.payload.shop_id],
    ['Action', ACTION_LABELS[pending.action]],
    ['Code', code],
  ]);
  hideReview();
}

function showUnknown(pending) {
  showResult('bad', UNKNOWN_RESULT, [
    ['Shop ID', pending.payload.shop_id],
    ['Action', ACTION_LABELS[pending.action]],
  ], { retry: true });
  hideReview();
}

async function sendRequest(pending) {
  setBusy(true);
  try {
    const session = await ensureFreshSession();
    const outcome = await callLicenceRpc({
      config,
      fetchImpl,
      accessToken: session.accessToken,
      action: pending.action,
      requestId: pending.requestId,
      payload: pending.payload,
    });
    const sameShop = state.shop !== null && state.shop.shop_id === pending.payload.shop_id;
    if (outcome.kind === 'result' && outcome.data.ok === true) {
      tracker.settle(true);
      state.unknownPending = null;
      showCommitted(outcome.data, pending, sameShop);
      if (sameShop) await refreshShop();
    } else if (outcome.kind === 'result') {
      tracker.settle(true);
      state.unknownPending = null;
      const code = String(outcome.data.code ?? '');
      showRejected(code, pending);
      // The shop changed after it was loaded. Reload its view so the admin sees the current state.
      if (code === 'stale_state_version' && sameShop) await refreshShop();
    } else if (outcome.kind === 'unknown') {
      tracker.settle(false);
      state.unknownPending = pending;
      showUnknown(pending);
    } else if (outcome.kind === 'session') {
      goSignIn(`${SESSION_ENDED} Then use Retry to resolve the last request.`);
    } else {
      tracker.settle(true);
      state.unknownPending = null;
      showResult('bad', outcome.message ?? GENERIC_REJECTION, [
        ['Shop ID', pending.payload.shop_id],
        ['Action', ACTION_LABELS[pending.action]],
      ]);
      hideReview();
    }
  } catch (error) {
    // Errors thrown here come from the session steps (refresh or step-up). Nothing was sent, so this is
    // never an unknown outcome. The request stays available to send again.
    handleSessionError(error);
  } finally {
    setBusy(false);
  }
}

// ---------- event wiring ----------

function bind() {
  $('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('signin-error', '');
    const email = $('email').value.trim();
    const password = $('password').value;
    $('password').value = '';
    if (!email || !password) {
      setError('signin-error', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const session = await signInWithPassword({ config, fetchImpl, email, password });
      state.session = session;
      const user = await getUserWithFactors({ config, fetchImpl, accessToken: session.accessToken });
      state.email = user.email || email;
      state.factors = user.factors;
      await routeByAuthStep();
    } catch (error) {
      state.session = null;
      setError('signin-error', error instanceof AuthError ? error.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  });

  $('totp-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = $('totp-code').value.replace(/\s+/g, '');
    const factorId = verifiedTotpFactorId();
    if (!/^[0-9]{6}$/.test(code) || !factorId) {
      setError('totp-error', 'Enter the six-digit code.');
      return;
    }
    setBusy(true);
    try {
      await completeTotp(factorId, code);
    } catch (error) {
      setError('totp-error', error instanceof AuthError ? error.message : 'The code was not accepted.');
    } finally {
      setBusy(false);
    }
  });

  $('totp-form-enrol').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = $('totp-enrol').value.replace(/\s+/g, '');
    if (!/^[0-9]{6}$/.test(code) || !state.enrolFactorId) {
      setError('enrol-error', 'Enter the six-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      await completeTotp(state.enrolFactorId, code);
    } catch (error) {
      setError('enrol-error', error instanceof AuthError ? error.message : 'The code was not accepted.');
    } finally {
      setBusy(false);
    }
  });

  $('sign-out').addEventListener('click', async () => {
    const token = state.session?.accessToken;
    // A pending retry belongs to this admin's session. Drop it on explicit sign-out, and say so: the last
    // change may or may not have been committed. The panel cannot check that yet (no read path).
    const unresolved = state.unknownPending !== null;
    state.unknownPending = null;
    hideResult();
    goSignIn(unresolved
      ? 'You have signed out. The last change was not confirmed. Check it before repeating it.'
      : 'You have signed out.');
    await signOut({ config, fetchImpl, accessToken: token });
  });

  $('shop-search-form').addEventListener('submit', runSearch);

  $('licence-refresh').addEventListener('click', () => {
    if (state.shop && state.reading === 0 && !state.busy) refreshShop();
  });

  $('audit-more').addEventListener('click', () => {
    if (state.reading === 0 && !state.busy) loadAudit(true);
  });

  $('action').addEventListener('change', () => {
    setActionVisibility();
    hideReview();
    clearFormErrors();
  });

  $('licence-form').addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();
    if (!state.shop || !state.licence) {
      hideReview();
      setStatus('Choose a shop and wait for its licence view before you review a change.');
      $('shop-query').focus();
      return;
    }
    const action = currentAction();
    const built = buildLicencePayload(action, readForm());
    if (!built.ok) {
      hideReview();
      showFormErrors(built.errors);
      return;
    }
    state.review = { action, payload: built.payload };
    showReview(action, built.payload);
    setStatus('Check the details, then send the change.');
  });

  $('review-back').addEventListener('click', () => {
    hideReview();
    $('reason').focus();
  });

  $('review-confirm').addEventListener('click', () => {
    if (!state.review || state.busy || state.reading > 0) return;
    const { action, payload } = state.review;
    const requestId = tracker.requestIdFor(action, payload);
    state.unknownPending = null;
    sendRequest({ action, payload, requestId });
  });

  $('retry').addEventListener('click', () => {
    if (!state.unknownPending || state.busy || state.reading > 0) return;
    sendRequest(state.unknownPending);
  });
}

function init() {
  if (!isUsableConfig(config)) {
    showView('config', 'main');
    setStatus('Not configured, or the configuration is unusable. No requests are sent.');
    return;
  }
  bind();
  goSignIn('');
}

init();
