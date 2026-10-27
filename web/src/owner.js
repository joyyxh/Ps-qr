// Shop owner pages: sign in, your shops, create a shop, shop details,
// open/closed switch and the service and price editor.
//
// Security notes for anyone changing this file:
// - Every value from the database goes through escapeHtml before it is shown.
// - Writes are sent as the signed-in owner, so row level security decides what
//   is allowed. The checks here are only there to give clear messages.
// - Prices are typed in rupees and converted to whole paise (logic.js).
//   The database stores and enforces them.

import {
  accountErrorMessage,
  isEmailAddress,
  isNewPassword,
  isOtpCode,
  otpErrorMessage,
  resendWaitSeconds,
  CANCEL_REASONS,
  cancelReasonLabel,
  checkPaymentQrFile,
  describeOrderItem,
  escapeHtml,
  formatPaise,
  isIrreversibleMove,
  isOpenOrder,
  nextOrderStatuses,
  nextPaymentActions,
  orderActionLabel,
  ownerStatusLabel,
  paiseToRupeesInput,
  paymentLabel,
  publicAssetUrl,
  publicBaseAddress,
  shopAddress,
  unitLabel,
  validateService,
  validateCashPolicy,
  validateShopDetails,
  validateSlug,
  agentStatusLabel,
  canSendToPrint,
  latestJobsByItem,
  printAgentFunctionUrl,
  printerOptionLabel,
  printFailureText,
  printingNotice,
  printJobLabel,
  retryOptions,
} from './logic.js';
import { createStatsPages } from './owner-stats.js';
import { PRINTER_RETRY_MS, browserVisibility, createOrderRefresher, printerRetryDue } from './order-refresh.js';
import { qrCanvas, qrSvg } from './qr.js';

const UNIT_OPTIONS = [
  { value: 'per_side', label: 'Per printed side' },
  { value: 'per_sheet', label: 'Per sheet (double-sided halves the sheets)' },
  { value: 'per_copy', label: 'Per copy (one flat charge)' },
];

const CONNECTION_MESSAGE = 'Could not reach the server. Check your internet connection and try again.';

export function createOwnerPages({ app, auth, ownerApi, config = window.PRINTNEST_CONFIG ?? {} }) {
  let current = []; // the owner route being shown, used by "Try again"
  let managed = null; // { shop, services } for the shop page on screen
  let orderView = null; // { shop, orders, showAll, printing, jobsByItem, pairing } for the orders page on screen
  const statsPages = createStatsPages({ app, ownerApi, messageFor });

  // Automatic refresh of the orders page (order-refresh.js). The page is only redrawn when the data changed.
  let navigation = 0; // counts page changes, so a slow load cannot draw over a page the owner has left
  let loadSeq = 0; // only the newest orders reply is kept
  let liveState = 'live'; // what the orders page says about automatic updates: 'live', 'offline' or 'expired'
  const liveMessages = {
    live: 'Updates automatically while this page is open.',
    offline: 'Automatic updates are paused because the connection failed. The list shows the last update. Use Refresh to try again.',
    expired: 'Your session has ended. Sign in again to continue.',
  };
  let printerRetryAt = 0; // 0 when the last printer-status read worked; otherwise when an automatic refresh may ask again
  let feedback = null; // { notice, error, at }: the last action message. Automatic redraws keep it for a minute.
  const FEEDBACK_KEEP_MS = 60000;
  const liveOrders = createOrderRefresher({
    fetchData: refreshOrderData,
    apply: () => renderOrders({ keep: true }),
    canApply: () => !isFocusedListControl(),
    onStatus: onLiveStatus,
    visibility: browserVisibility(),
  });

  // ---------- navigation and shared helpers ----------

  function go(parts) {
    const hash = '#/owner' + parts.map((part) => `/${encodeURIComponent(part)}`).join('');
    if (window.location.hash === hash) {
      render(parts);
    } else {
      window.location.hash = hash;
    }
  }

  function show(html) {
    app.innerHTML = html;
  }

  function on(selector, eventName, handler) {
    app.querySelector(selector)?.addEventListener(eventName, handler);
  }

  function onAll(selector, eventName, handler) {
    app.querySelectorAll(selector).forEach((el) => el.addEventListener(eventName, handler));
  }

  function setError(form, message) {
    const el = form?.querySelector('[data-error]');
    if (el) el.textContent = message ?? '';
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Please wait…' : button.dataset.label;
  }

  function messageFor(err) {
    if (err instanceof TypeError) return CONNECTION_MESSAGE;
    if (err.status === 401) return 'Your session has ended. Sign in again to continue.';
    if (err.code === '23505') return 'That web address is already taken. Try a different one.';
    if (err.code === '23514' && /shops_slug_reserved/.test(err.message)) {
      return 'That web address is reserved. Choose another.';
    }
    if (err.code === '42501') return 'You do not have permission to do that.';
    if (err.code === '22023') {
      return 'That change is not allowed for this order. It may have changed since the page loaded. Refresh and try again.';
    }
    return err.message || 'Something went wrong. Please try again.';
  }

  // The address a QR code opens for this shop, plus a warning when customers could
  // not reach that address (for example a local test address).
  function customerAddress(slug) {
    const { base, problem } = publicBaseAddress(config, window.location);
    return { url: shopAddress(base, slug), problem };
  }

  async function signOut() {
    await auth.signOut();
    go([]);
  }

  // ---------- entry point, called by app.js for every #/owner route ----------

  async function render(parts = []) {
    navigation += 1;
    liveOrders.stop(); // leaving a page ends its automatic refresh
    current = parts;
    show('<p class="muted">Loading…</p>');
    const [page = '', value = '', section = ''] = parts;
    try {
      // A verified owner who has not chosen a password yet goes no further (see completeSignup).
      if (auth.hasPendingSignup()) return renderSetPassword();
      const session = await auth.getSession();
      if (!session) return renderSignIn('signin');
      if (page === 'reset') return renderResetPassword();
      if (page === 'new') return renderNewShop();
      if (page === 'shop' && value) return await renderShopManager(session.user, value, section);
      return await renderShopList(session.user);
    } catch (err) {
      return renderFailure(err);
    }
  }

  async function renderFailure(err) {
    if (err.status === 401) {
      await auth.signOut();
      return renderSignIn('signin', messageFor(err));
    }
    show(
      `<section class="card">
        <h1>Something went wrong</h1>
        <p class="error" role="alert">${escapeHtml(messageFor(err))}</p>
        <p><button type="button" data-action="retry">Try again</button></p>
      </section>`
    );
    on('[data-action="retry"]', 'click', () => render(current));
  }

  // ---------- sign in, registration and verification ----------
  // An owner signs in with email and password. A new owner registers with email and
  // password, then enters the one-time code emailed to them before the account opens.
  // An owner whose email is still unverified is sent a new code when they sign in.
  // Customers never reach these screens.

  let pendingEmail = ''; // the address waiting for a verification code
  let pendingSentAt = 0; // when the last verification code was sent, in milliseconds
  let pendingPassword = ''; // the password typed at registration, kept in memory until the code is accepted
  let resendTimer = null;

  function clearResendTimer() {
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = null;
  }

  function renderSignIn(mode = 'signin', notice = '') {
    clearResendTimer();
    pendingPassword = '';
    if (mode === 'register') return renderRegister(notice);
    if (mode === 'verify' && pendingEmail) return renderVerify(notice);
    if (mode === 'forgot') return renderForgotPassword(notice);
    return renderSignInForm(notice);
  }

  function renderSignInForm(notice = '') {
    show(
      `<section class="card">
        <h1>Shop owner sign in</h1>
        <p class="muted small">Only shop owners sign in here. Customers do not need an account.</p>
        <form id="auth-form" class="grid">
          <label>Email
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button type="submit" data-label="Sign in">Sign in</button>
          <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
        </form>
        <p><button type="button" class="link" data-switch="forgot">Forgot password?</button></p>
        <p><button type="button" class="link" data-switch="register">New owner? Create an account</button></p>
      </section>`
    );
    on('#auth-form', 'submit', onSignInSubmit);
    onAll('[data-switch]', 'click', (event) => renderSignIn(event.currentTarget.dataset.switch));
  }

  async function onSignInSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    setError(form, '');
    setBusy(form, true);
    try {
      await auth.signIn(email, password);
      go([]);
    } catch (err) {
      if (err.code === 'email_not_confirmed') {
        return startVerification(email, 'Your email is not verified yet. We have sent you a new code.');
      }
      setError(form, accountErrorMessage(err));
      setBusy(form, false);
    }
  }

  // An owner who has not verified yet gets a new code, then the code screen.
  async function startVerification(email, notice) {
    pendingEmail = email;
    pendingPassword = ''; // this owner did not register here, so there is no password to save
    try {
      await auth.resendSignupCode(email);
      pendingSentAt = Date.now();
      renderVerify(notice);
    } catch (err) {
      if (err.status === 429) pendingSentAt = Date.now(); // a code went out a moment ago
      renderVerify(err.status === 429 ? 'A code was sent a moment ago. Enter it, or wait a minute to resend.' : otpErrorMessage(err, 'resend'));
    }
  }

  function renderRegister(notice = '') {
    show(
      `<section class="card">
        <h1>Create an owner account</h1>
        <p class="muted small">Only shop owners register here. Customers do not need an account.
           We will email a one-time code to confirm your address.</p>
        <form id="auth-form" class="grid">
          <label>Email
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label>Password (at least 8 characters)
            <input name="password" type="password" minlength="8" autocomplete="new-password" required />
          </label>
          <button type="submit" data-label="Create account">Create account</button>
          <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
        </form>
        <p><button type="button" class="link" data-switch="signin">Already have an account? Sign in</button></p>
      </section>`
    );
    on('#auth-form', 'submit', onRegisterSubmit);
    onAll('[data-switch]', 'click', (event) => renderSignIn(event.currentTarget.dataset.switch));
  }

  async function onRegisterSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!isEmailAddress(email)) return setError(form, 'Enter a valid email address.');
    if (!isNewPassword(password)) return setError(form, 'Use a password with at least 8 characters.');
    setError(form, '');
    setBusy(form, true);
    try {
      await auth.signUp(email, password);
      pendingEmail = email;
      pendingSentAt = Date.now(); // signing up has just emailed the first code
      pendingPassword = password;
      renderVerify('');
    } catch (err) {
      setError(form, accountErrorMessage(err));
      setBusy(form, false);
    }
  }

  function renderVerify(notice = '') {
    show(
      `<section class="card">
        <h1>Check your email</h1>
        <p>Enter the one-time code we emailed to <strong>${escapeHtml(pendingEmail)}</strong>.
           It can take a minute to arrive, and it may be in your spam folder. Next you will
           choose the password you use to sign in.</p>
        <form id="auth-form" class="grid">
          <label>Verification code
            <input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required />
          </label>
          <button type="submit" data-label="Verify email">Verify email</button>
          <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
        </form>
        <p><button type="button" class="link" data-action="resend">Resend code</button></p>
        <p class="muted small">Already verified? <button type="button" class="link" data-switch="signin">Sign in with your password</button></p>
      </section>`
    );
    on('#auth-form', 'submit', onVerifySubmit);
    on('[data-action="resend"]', 'click', onResendCode);
    onAll('[data-switch]', 'click', (event) => renderSignIn(event.currentTarget.dataset.switch));
    startResendCountdown();
  }

  // The resend button stays disabled, with a countdown, until the cooldown ends.
  function startResendCountdown() {
    const button = app.querySelector('[data-action="resend"]');
    if (!button) return;
    const update = () => {
      if (!button.isConnected) return clearResendTimer();
      const wait = resendWaitSeconds(pendingSentAt, Date.now());
      button.disabled = wait > 0;
      button.textContent = wait > 0 ? `Resend code in ${wait} s` : 'Resend code';
      if (wait <= 0) clearResendTimer();
    };
    clearResendTimer();
    update();
    if (button.disabled) resendTimer = setInterval(update, 1000);
  }

  async function onResendCode(event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await auth.resendSignupCode(pendingEmail);
      pendingSentAt = Date.now();
      renderVerify('A new code is on its way.');
    } catch (err) {
      if (err.status === 429) pendingSentAt = Date.now();
      renderVerify(otpErrorMessage(err, 'resend'));
    }
  }

  async function onVerifySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const token = String(new FormData(form).get('token') ?? '').replace(/\s+/g, '');
    if (!isOtpCode(token)) return setError(form, 'Enter the code from the email. It has 6 to 10 digits.');
    setError(form, '');
    setBusy(form, true);
    try {
      await auth.verifySignupCode(pendingEmail, token);
    } catch (err) {
      setError(form, otpErrorMessage(err, 'verify'));
      setBusy(form, false);
      return;
    }
    clearResendTimer();
    pendingEmail = '';
    // The password typed at registration is saved now, so the owner's own password is the
    // one that works. An owner who came here from sign-in chooses one on the next screen.
    const password = pendingPassword;
    pendingPassword = '';
    if (!password) return renderSetPassword();
    return finishSignup(password);
  }

  // Saves the password and opens the account. A failure is shown on the password screen.
  async function finishSignup(password) {
    try {
      await auth.completeSignup(password);
    } catch (err) {
      return signupFailed(err);
    }
    return go([]);
  }

  // A confirmation that has ended sends the owner to Forgot password. Any other failure
  // keeps the owner on the password screen to try again.
  function signupFailed(err) {
    if (err.code === 'signup_expired') return renderSignIn('forgot', err.message);
    return renderSetPassword(accountErrorMessage(err));
  }

  // The password step: after the code or the confirmation link, before the account opens.
  // Nothing stays signed in until a password is saved.
  function renderSetPassword(notice = '') {
    clearResendTimer();
    show(`<section class="card">
      <h1>Choose your password</h1>
      <p class="muted small">Your email is confirmed. Choose the password you will use to sign in from now on.
         It replaces any password set before the confirmation. Use at least 8 characters.</p>
      <form id="set-password-form" class="grid">
        <label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label>
        <label>Repeat password<input name="repeat" type="password" minlength="8" autocomplete="new-password" required /></label>
        <button type="submit" data-label="Save password">Save password</button>
        <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
      </form>
      <p class="muted small">Cannot save a password? <button type="button" class="link" data-switch="forgot">Use Forgot password</button></p>
    </section>`);
    on('#set-password-form', 'submit', onSetPasswordSubmit);
    onAll('[data-switch]', 'click', (event) => {
      auth.abandonSignup();
      renderSignIn(event.currentTarget.dataset.switch);
    });
  }

  async function onSetPasswordSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    if (!isNewPassword(password)) return setError(form, 'Use a password with at least 8 characters.');
    if (password !== String(data.get('repeat') ?? '')) return setError(form, 'The passwords do not match.');
    setError(form, '');
    setBusy(form, true);
    return finishSignup(password);
  }

  // ---------- password reset (a separate flow, unchanged) ----------

  function renderForgotPassword(notice = '') {
    show(
      `<section class="card">
        <h1>Reset your password</h1>
        <p class="muted small">We email a reset link to owners who have a password.</p>
        <form id="auth-form" class="grid">
          <label>Email
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <button type="submit" data-label="Send reset link">Send reset link</button>
          <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
        </form>
        <p><button type="button" class="link" data-switch="signin">Back to sign in</button></p>
      </section>`
    );
    on('#auth-form', 'submit', onForgotSubmit);
    onAll('[data-switch]', 'click', (event) => renderSignIn(event.currentTarget.dataset.switch));
  }

  async function onForgotSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') ?? '').trim();
    setError(form, '');
    setBusy(form, true);
    try {
      await auth.recoverPassword(email);
      showResetSent(email);
    } catch (err) {
      setError(form, accountErrorMessage(err));
      setBusy(form, false);
    }
  }

  // The same message whether or not the address has an account, so the form cannot be
  // used to find which emails are registered.
  function showResetSent(email) {
    show(
      `<section class="card">
        <h1>Check your email</h1>
        <p>If <strong>${escapeHtml(email)}</strong> has an owner account with a password, we have emailed a reset link. Open it on this device to choose a new password.</p>
        <p><button type="button" class="link" data-switch="signin">Go to sign in</button></p>
      </section>`
    );
    onAll('[data-switch]', 'click', (event) => renderSignIn(event.currentTarget.dataset.switch));
  }

  function renderResetPassword(notice = '') {
    show(`<section class="card">
      <h1>Choose a new password</h1>
      <p class="muted small">Use at least 8 characters. This recovery link is short-lived.</p>
      <form id="reset-form" class="grid">
        <label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label>
        <label>Repeat password<input name="repeat" type="password" minlength="8" autocomplete="new-password" required /></label>
        <button type="submit">Save new password</button>
        <p class="error" data-error role="alert">${escapeHtml(notice)}</p>
      </form>
    </section>`);
    on('#reset-form', 'submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const password = String(data.get('password') ?? '');
      if (password !== String(data.get('repeat') ?? '')) return setError(form, 'The passwords do not match.');
      setBusy(form, true);
      try {
        await auth.updatePassword(password);
        await auth.signOut();
        renderSignIn('signin', 'Password changed. Sign in with your new password.');
      } catch (err) {
        setError(form, friendlyAuthError(err));
        setBusy(form, false);
      }
    });
  }

  function friendlyAuthError(err) {
    if (err instanceof TypeError) return CONNECTION_MESSAGE;
    if (/invalid login/i.test(err.message)) return 'That email and password do not match an account.';
    if (/already (registered|exists)/i.test(err.message)) {
      return 'An account with this email already exists. Sign in instead.';
    }
    return err.message;
  }

  // ---------- your shops ----------

  async function renderShopList(user) {
    const shops = await ownerApi.listMyShops(user.id);
    const openCount = shops.filter((shop) => shop.is_open).length;
    const items = shops
      .map(
        (shop) => `
        <li class="owner-shop-card">
          <div class="between"><a href="#/owner/shop/${encodeURIComponent(shop.slug)}"><strong>${escapeHtml(shop.name)}</strong></a><span class="shop-status ${shop.is_open ? 'is-open' : ''}">${shop.is_open ? 'Open' : 'Closed'}</span></div>
          <span class="muted small">/${escapeHtml(shop.slug)}</span>
          <div class="owner-shop-actions"><a class="button secondary" href="#/owner/shop/${encodeURIComponent(shop.slug)}">Manage shop</a><a href="#/owner/shop/${encodeURIComponent(shop.slug)}/orders">View orders →</a></div>
        </li>`
      )
      .join('');

    show(
      `<section class="owner-dashboard-head">
        <div><p class="eyebrow">OWNER DASHBOARD</p><h1>Good to see you.</h1><p class="muted">Here’s what’s happening with your print shops today.</p></div>
        <button type="button" class="button secondary" data-action="signout">Sign out</button>
      </section>
      <section class="owner-summary-grid"><article class="card"><span class="muted small">Your shops</span><strong>${shops.length}</strong><span class="muted small">${openCount} currently open</span></article><article class="card"><span class="muted small">Needs you now</span><strong>—</strong><span class="muted small">Orders appear here</span></article><article class="card"><span class="muted small">Account</span><strong class="summary-email">${escapeHtml(user.email)}</strong><span class="muted small">Owner access</span></article></section>
      <section class="card owner-shops-section"><div class="between"><div><p class="eyebrow">YOUR SHOPS</p><h2>Manage your print counters</h2></div><a class="button" href="#/owner/new">+ Create a shop</a></div>
        ${shops.length ? `<ul class="list owner-shop-list">${items}</ul>` : '<div class="empty-state"><p class="muted">You do not have a shop yet.</p><a class="button" href="#/owner/new">Create your first shop</a></div>'}
      </section>`
    );
    on('[data-action="signout"]', 'click', signOut);
  }

  // ---------- create a shop ----------

  function renderNewShop() {
    show(
      `<section class="card">
        <h1>Create your shop</h1>
        <p class="muted small">You can change the name, phone, address, services and prices later.
           The web address cannot be changed after the shop is created.</p>
        <form id="shop-form" class="grid">
          <label>Shop name
            <input name="name" maxlength="120" required />
          </label>
          <label>Web address (letters, numbers and hyphens)
            <input name="slug" maxlength="40" autocapitalize="off" spellcheck="false" required />
          </label>
          <p id="slug-hint" class="hint muted"></p>
          <label>Phone (optional)
            <input name="phone" type="tel" maxlength="20" autocomplete="tel" />
          </label>
          <label>Address (optional)
            <input name="address" maxlength="200" autocomplete="street-address" />
          </label>
          <button type="submit" data-label="Create shop">Create shop</button>
          <p class="error" data-error role="alert"></p>
        </form>
        <p><button type="button" class="link" data-action="back">Back to your shops</button></p>
      </section>`
    );

    on('input[name="slug"]', 'input', (event) => {
      const slug = event.currentTarget.value.trim().toLowerCase();
      const hint = app.querySelector('#slug-hint');
      if (hint) hint.textContent = slug ? `Your shop page will be at ${customerAddress(slug).url}` : '';
    });
    on('#shop-form', 'submit', onCreateShop);
    on('[data-action="back"]', 'click', () => go([]));
  }

  async function onCreateShop(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(form, '');
    setBusy(form, true);
    try {
      const details = validateShopDetails({
        name: data.get('name'),
        phone: data.get('phone'),
        address: data.get('address'),
      });
      const slug = validateSlug(data.get('slug'));
      const shop = await ownerApi.createShop({ slug, ...details });
      go(['shop', shop.slug]);
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  // ---------- one shop: details, open/closed, services ----------

  async function renderShopManager(user, slug, section = '') {
    const shops = await ownerApi.listMyShops(user.id);
    const shop = shops.find((item) => item.slug === slug);
    if (!shop) {
      show(
        `<section class="card">
          <h1>Shop not found</h1>
          <p class="muted">Either this shop does not exist, or your account is not an owner of it.</p>
          <p><a href="#/owner">Back to your shops</a></p>
        </section>`
      );
      return;
    }
    if (section === 'orders') return renderOrdersFor(shop);
    if (section === 'stats') return statsPages.open(shop);

    const [services, catalog] = await Promise.all([
      ownerApi.listServices(shop.id),
      ownerApi.listFeatureCatalog(),
    ]);
    managed = { shop, services, catalog };
    renderManager();
  }

  function renderManager({ editingId = null, notice = '', error = '' } = {}) {
    const { shop, services, catalog } = managed;
    const editing = services.find((service) => service.id === editingId) ?? null;
    show(managerHtml(shop, services, editing, notice, error, catalog));
    bindManager();
  }

  function managerHtml(shop, services, editing, notice, error, catalog) {
    const address = customerAddress(shop.slug);
    const qrContent = address.problem
      ? `<p class="banner" role="alert">${escapeHtml(address.problem)} QR generation is disabled until a verified HTTPS customer URL is configured.</p>`
      : `<div class="qr-box">${qrSvg(address.url)}</div>
         <div class="qr-text">
           <p class="muted small">Print this code and place it at your counter. Customers scan it to open their page, upload files and place an order.</p>
           <button type="button" data-action="download-qr">Download QR as PNG</button>
         </div>`;
    const featuresBlock = featuresCard(shop, catalog);
    const paymentBlock = paymentQrCard(shop);
    const cashBlock = cashPolicyCard(shop);
    const rows = services
      .map((service) => {
        const bw = service.bw_price_paise === null ? '–' : formatPaise(service.bw_price_paise);
        const colour = service.colour_price_paise === null ? '–' : formatPaise(service.colour_price_paise);
        const hidden = service.is_active ? '' : ' <span class="muted small">(hidden from customers)</span>';
        return `
          <tr>
            <td>${escapeHtml(service.name)}${hidden}</td>
            <td>${escapeHtml(unitLabel(service.pricing_unit))}</td>
            <td class="num">${bw}</td>
            <td class="num">${colour}</td>
            <td><button type="button" class="link" data-edit="${escapeHtml(service.id)}">Edit</button></td>
          </tr>`;
      })
      .join('');

    const serviceTable = services.length
      ? `<div class="table-wrap">
           <table class="breakdown">
             <thead><tr><th>Service</th><th>Charged</th><th class="num">B&amp;W</th><th class="num">Colour</th><th></th></tr></thead>
             <tbody>${rows}</tbody>
           </table>
         </div>`
      : '<p class="muted">No services yet. Add one below.</p>';

    const selectedUnit = editing?.pricing_unit ?? 'per_side';
    const unitOptions = UNIT_OPTIONS.map(
      (option) =>
        `<option value="${option.value}"${option.value === selectedUnit ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
    ).join('');

    return `
      <section class="card">
        <p class="small"><a href="#/owner">← Your shops</a></p>
        <h1>${escapeHtml(shop.name)}</h1>
        <p class="muted small">Web address: /s/${escapeHtml(shop.slug)}</p>
        <p class="${shop.is_open ? 'badge ok' : 'badge closed'}">
          ${shop.is_open ? 'Open for orders' : 'Closed. Customers can see prices but cannot order.'}
        </p>
        <p><a class="button" href="#/owner/shop/${encodeURIComponent(shop.slug)}/orders">Orders</a>
           <a class="button" href="#/owner/shop/${encodeURIComponent(shop.slug)}/stats">Statistics</a></p>
        <p><button type="button" data-action="toggle-open" data-label="${shop.is_open ? 'Close shop' : 'Open shop'}">
          ${shop.is_open ? 'Close shop' : 'Open shop'}
        </button></p>
        <p class="notice" data-notice>${escapeHtml(notice)}</p>
        <p class="error" data-error-top role="alert">${escapeHtml(error)}</p>
      </section>

      <section class="card">
        <h2>Customer page and QR code</h2>
        <label>Customer page address
          <input readonly value="${escapeHtml(address.url)}" />
        </label>
        ${address.problem ? `<p class="banner" role="alert">${escapeHtml(address.problem)}</p>` : ''}
        <div class="qr-row">${qrContent}</div>
      </section>

      <section class="card">
        <h2>Shop details</h2>
        <form id="details-form" class="grid">
          <label>Shop name
            <input name="name" maxlength="120" required value="${escapeHtml(shop.name)}" />
          </label>
          <label>Phone
            <input name="phone" type="tel" maxlength="20" value="${escapeHtml(shop.phone ?? '')}" />
          </label>
          <label>Address
            <input name="address" maxlength="200" value="${escapeHtml(shop.address ?? '')}" />
          </label>
          <button type="submit" data-label="Save details">Save details</button>
          <p class="error" data-error role="alert"></p>
        </form>
      </section>

      ${featuresBlock}

      ${paymentBlock}

      ${cashBlock}

      <section class="card">
        <h2>Services and prices</h2>
        ${serviceTable}
        <h3>${editing ? 'Edit service' : 'Add a service'}</h3>
        <form id="service-form" class="grid">
          <input type="hidden" name="serviceId" value="${escapeHtml(editing?.id ?? '')}" />
          <label>Service name
            <input name="name" maxlength="80" required value="${escapeHtml(editing?.name ?? '')}" />
          </label>
          <label>Charged
            <select name="pricingUnit">${unitOptions}</select>
          </label>
          <label>Black and white price in rupees (leave empty if not offered)
            <input name="bwPrice" inputmode="decimal" placeholder="for example 2 or 2.50"
                   value="${escapeHtml(paiseToRupeesInput(editing?.bw_price_paise))}" />
          </label>
          <label>Colour price in rupees (leave empty if not offered)
            <input name="colourPrice" inputmode="decimal" placeholder="for example 10"
                   value="${escapeHtml(paiseToRupeesInput(editing?.colour_price_paise))}" />
          </label>
          <label class="check">
            <input name="isActive" type="checkbox" ${editing?.is_active === false ? '' : 'checked'} />
            Show this service to customers
          </label>
          <button type="submit" data-label="${editing ? 'Save service' : 'Add service'}">
            ${editing ? 'Save service' : 'Add service'}
          </button>
          ${editing ? '<button type="button" class="link" data-action="cancel-edit">Cancel editing</button>' : ''}
          <p class="error" data-error role="alert"></p>
        </form>
      </section>`;
  }

  // Yes/no switches for each feature. Customers only see the features that are on.
  function featuresCard(shop, catalog) {
    const items = catalog
      .map((feature) => {
        const on = shop.features?.[feature.key] === true;
        const note = feature.affects_orders ? ' <span class="muted small">(priced when customers order)</span>' : '';
        return `
          <label class="check">
            <input type="checkbox" name="feature" value="${escapeHtml(feature.key)}"${on ? ' checked' : ''} />
            <span>${escapeHtml(feature.label)}${note}</span>
          </label>`;
      })
      .join('');
    return `
      <section class="card">
        <h2>Printing features</h2>
        <p class="muted small">Tick what your shop offers. Customers see only the features that are ticked.
           Turning colour printing off does not remove your colour prices. It only stops customers choosing colour.</p>
        <form id="features-form" class="grid">
          <div class="feature-list">${items}</div>
          <button type="submit" data-label="Save features">Save features</button>
          <p class="error" data-error role="alert"></p>
        </form>
      </section>`;
  }

  // The payment QR is shown to customers on the shop page and after they order.
  function paymentQrCard(shop) {
    const current = shop.payment_qr_path
      ? `<img class="payment-qr-preview" alt="Your payment QR code"
              src="${escapeHtml(publicAssetUrl(config.supabaseUrl, shop.payment_qr_path))}" />
         <p><button type="button" class="link" data-action="remove-payment-qr">Remove payment QR</button></p>`
      : '<p class="muted">No payment QR yet.</p>';
    return `
      <section class="card">
        <h2>Payment QR code</h2>
        <p class="muted small">Upload the QR code from your UPI app or bank (PNG or JPEG, up to 2 MB).
           Customers see it on your page and after they place an order, so they can pay you.</p>
        ${current}
        <form id="payment-qr-form" class="grid">
          <label>${shop.payment_qr_path ? 'Replace with a new image' : 'Choose the image'}
            <input name="qr" type="file" accept="image/png,image/jpeg" required />
          </label>
          <button type="submit" data-label="Upload payment QR">Upload payment QR</button>
          <p class="error" data-error role="alert"></p>
        </form>
      </section>`;
  }

  function cashPolicyCard(shop) {
    return `<section class="card">
      <h2>Cash and order rules</h2>
      <form id="cash-policy-form" class="grid">
        <label>Cash is due
          <select name="cashTiming">
            <option value="counter"${shop.cash_payment_timing !== 'collection' ? ' selected' : ''}>At the counter before collection</option>
            <option value="collection"${shop.cash_payment_timing === 'collection' ? ' selected' : ''}>When the printed order is collected</option>
          </select>
        </label>
        <label>Minimum order amount in rupees
          <input name="minimumOrder" inputmode="decimal" placeholder="0 for no minimum"
                 value="${escapeHtml(paiseToRupeesInput(shop.minimum_order_paise ?? 0))}" />
        </label>
        <p class="muted small">These rules are enforced by the database and shown to customers before submission.</p>
        <button type="submit" data-label="Save cash rules">Save cash rules</button>
        <p class="error" data-error role="alert"></p>
      </form>
    </section>`;
  }

  function bindManager() {
    on('#details-form', 'submit', onSaveDetails);
    on('#features-form', 'submit', onSaveFeatures);
    on('#payment-qr-form', 'submit', onUploadPaymentQr);
    on('#cash-policy-form', 'submit', onSaveCashPolicy);
    on('[data-action="remove-payment-qr"]', 'click', onRemovePaymentQr);
    on('#service-form', 'submit', onSaveService);
    on('[data-action="toggle-open"]', 'click', onToggleOpen);
    on('[data-action="cancel-edit"]', 'click', () => renderManager());
    onAll('[data-edit]', 'click', (event) => renderManager({ editingId: event.currentTarget.dataset.edit }));
    const pageAddress = app.querySelector('input[readonly]');
    pageAddress?.addEventListener('focus', () => pageAddress.select());
    on('[data-action="download-qr"]', 'click', () => downloadQr(managed.shop.slug));
  }

  // Saves the shop's QR code as a PNG for printing. It is drawn in the browser
  // from the same address shown on the page.
  function downloadQr(slug) {
    const { url, problem } = customerAddress(slug);
    if (problem) {
      renderManager({ error: `${problem} QR generation is disabled until a verified HTTPS customer URL is configured.` });
      return;
    }
    qrCanvas(url, 12).toBlob((blob) => {
      if (!blob) {
        renderManager({ error: 'The QR code could not be saved. Try again.' });
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `qrquick-${slug}-qr.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, 'image/png');
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(form, '');
    setBusy(form, true);
    try {
      const details = validateShopDetails({
        name: data.get('name'),
        phone: data.get('phone'),
        address: data.get('address'),
      });
      const updated = await ownerApi.updateShop(managed.shop.id, details);
      managed.shop = { ...managed.shop, ...updated };
      renderManager({ notice: 'Shop details saved.' });
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  async function onSaveCashPolicy(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(form, '');
    setBusy(form, true);
    try {
      const fields = validateCashPolicy({ timing: data.get('cashTiming'), minimumRupees: data.get('minimumOrder') });
      const updated = await ownerApi.updateShop(managed.shop.id, fields);
      managed.shop = { ...managed.shop, ...updated };
      renderManager({ notice: 'Cash rules saved.' });
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  async function onSaveService(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceId = String(data.get('serviceId') ?? '');
    setError(form, '');
    setBusy(form, true);
    try {
      const fields = validateService({
        name: data.get('name'),
        pricingUnit: data.get('pricingUnit'),
        bwPrice: data.get('bwPrice'),
        colourPrice: data.get('colourPrice'),
        isActive: data.get('isActive') === 'on',
      });
      if (serviceId) {
        await ownerApi.updateService(managed.shop.id, serviceId, fields);
      } else {
        await ownerApi.createService(managed.shop.id, fields);
      }
      managed.services = await ownerApi.listServices(managed.shop.id);
      renderManager({ notice: serviceId ? 'Service saved.' : 'Service added.' });
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  async function onSaveFeatures(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const chosen = new Set(new FormData(form).getAll('feature'));
    const features = Object.fromEntries(managed.catalog.map((feature) => [feature.key, chosen.has(feature.key)]));
    setError(form, '');
    setBusy(form, true);
    try {
      const saved = await ownerApi.saveFeatures(managed.shop.id, features);
      managed.shop = { ...managed.shop, features: saved };
      renderManager({ notice: 'Features saved. Customers now see the updated list.' });
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  async function onUploadPaymentQr(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('qr');
    setError(form, '');
    const problem = checkPaymentQrFile(file);
    if (problem) {
      setError(form, problem);
      return;
    }
    setBusy(form, true);
    try {
      const path = await ownerApi.uploadPaymentQr(managed.shop.id, file, managed.shop.payment_qr_path);
      managed.shop = { ...managed.shop, payment_qr_path: path };
      renderManager({ notice: 'Payment QR saved. Customers will see it on your page.' });
    } catch (err) {
      setError(form, messageFor(err));
      setBusy(form, false);
    }
  }

  async function onRemovePaymentQr(event) {
    if (!window.confirm('Remove the payment QR from your shop? Customers will no longer see it.')) return;
    event.currentTarget.disabled = true;
    try {
      await ownerApi.removePaymentQr(managed.shop.id, managed.shop.payment_qr_path);
      managed.shop = { ...managed.shop, payment_qr_path: null };
      renderManager({ notice: 'Payment QR removed.' });
    } catch (err) {
      renderManager({ error: messageFor(err) });
    }
  }

  async function onToggleOpen() {
    try {
      const updated = await ownerApi.updateShop(managed.shop.id, { is_open: !managed.shop.is_open });
      managed.shop = { ...managed.shop, is_open: updated.is_open };
      renderManager({
        notice: managed.shop.is_open
          ? 'Your shop is open. Customers can place orders.'
          : 'Your shop is closed. Customers cannot place orders.',
      });
    } catch (err) {
      renderManager({ error: messageFor(err) });
    }
  }

  // ---------- orders ----------

  // Reads the orders and the printer status. An automatic refresh skips the printer read while a
  // failed read is waiting to be retried (PRINTER_RETRY_MS), so a broken read is not repeated every
  // few seconds. Opening the page, an action and the Refresh button always ask. A skipped read
  // returns printing as undefined, and the last printer status stays on screen.
  async function loadOrderView(shopId, { manual = true } = {}) {
    const askPrinter = manual || printerRetryDue(printerRetryAt, Date.now());
    const [orders, printing] = await Promise.all([
      ownerApi.listOrders(shopId),
      askPrinter ? readPrinterStatus(shopId) : undefined,
    ]);
    return { orders, printing };
  }

  // If the printer status cannot load, the orders still show; printing is marked unavailable.
  function readPrinterStatus(shopId) {
    return ownerApi.printStatus(shopId).then(
      (status) => {
        printerRetryAt = 0;
        return status;
      },
      () => {
        printerRetryAt = Date.now() + PRINTER_RETRY_MS;
        return null;
      }
    );
  }

  async function renderOrdersFor(shop) {
    const nav = navigation;
    const { orders, printing } = await loadOrderView(shop.id);
    if (nav !== navigation) return; // the owner has left this page while it loaded
    orderView = { shop, orders, printing, showAll: false, jobsByItem: new Map(), pairing: null };
    liveState = 'live'; // a message from an earlier visit must not show on a fresh page
    renderOrders();
    liveOrders.start();
  }

  // Reloads the orders and the printer status together, so the job lines stay current.
  // Only the newest reply is kept, so a slow earlier reply cannot overwrite a newer one.
  async function reloadOrders(options) {
    const shopId = orderView.shop.id;
    const seq = ++loadSeq;
    const { orders, printing } = await loadOrderView(shopId, options);
    if (seq === loadSeq && orderView?.shop.id === shopId) {
      orderView.orders = orders;
      if (printing !== undefined) orderView.printing = printing; // undefined: the printer read was skipped
    }
  }

  // The data the automatic refresh and the Refresh button load. The same shop-scoped reads as before.
  async function refreshOrderData({ manual = true } = {}) {
    await reloadOrders({ manual });
    return { orders: orderView?.orders ?? [], printing: orderView?.printing ?? null };
  }

  // Automatic redraws pass keep: true. They show the last action message for up to a minute, so a poll
  // that brings new orders does not wipe out "Payment updated…". Any other redraw replaces it.
  function renderOrders({ notice = '', error = '', keep = false } = {}) {
    if (keep) {
      const kept = feedback && Date.now() - feedback.at < FEEDBACK_KEEP_MS ? feedback : null;
      feedback = kept;
      notice = kept?.notice ?? '';
      error = kept?.error ?? '';
    } else {
      feedback = notice || error ? { notice, error, at: Date.now() } : null;
    }
    const { shop, orders, showAll } = orderView;
    orderView.jobsByItem = latestJobsByItem(orderView.printing?.jobs ?? []);
    const visible = showAll ? orders : orders.filter((order) => isOpenOrder(order.status));
    show(ordersHtml(shop, visible, orders.length, showAll, notice, error));
    bindOrders();
    // The automatic refresh compares against what is on screen, so it does not redraw the same data.
    liveOrders.remember({ orders, printing: orderView.printing });
  }

  function ordersHtml(shop, visible, total, showAll, notice, error) {
    let empty = '';
    if (!visible.length) {
      empty = total
        ? '<p class="muted">No open orders right now. Switch to all orders to see finished ones.</p>'
        : '<p class="muted">No orders yet. They appear here when customers place them.</p>';
    }
    return `
      <section class="card">
        <p class="small"><a href="#/owner/shop/${encodeURIComponent(shop.slug)}">← ${escapeHtml(shop.name)}</a></p>
        <div class="between">
          <h1>Orders</h1>
          <button type="button" class="link" data-action="refresh-orders">Refresh</button>
        </div>
        <p class="${liveState === 'live' ? 'muted' : 'error'} small" data-live-status>${escapeHtml(liveMessages[liveState])}</p>
        <p class="muted small">Page counts are what customers typed. Files are not uploaded yet, so check the
           count at the counter.</p>
        ${printPanelHtml()}
        <div class="segmented">
          <button type="button" class="${showAll ? '' : 'on'}" data-action="filter" data-all="false">Open orders</button>
          <button type="button" class="${showAll ? 'on' : ''}" data-action="filter" data-all="true">All orders</button>
        </div>
        <p class="notice" data-notice>${escapeHtml(notice)}</p>
        <p class="error" data-error-top role="alert">${escapeHtml(error)}</p>
        ${visible.length ? `<ul class="order-list">${visible.map(orderCard).join('')}</ul>` : empty}
      </section>`;
  }

  function orderCard(order) {
    const items = (order.order_items ?? [])
      .map((item) => {
        // Items from before file upload have no file, so they get no button.
        const file = item.file_id
          ? `<span class="file-line"><span class="muted small">${escapeHtml(item.file_name ?? 'File')}</span>` +
            `<button type="button" class="link" data-file-id="${escapeHtml(item.file_id)}" ` +
            `data-file-order="${escapeHtml(order.id)}">Download file</button></span>`
          : '';
        return `<li><span>${escapeHtml(describeOrderItem(item))}</span>` +
          `<span class="num">${formatPaise(item.amount_paise)}</span>${file}${jobLineHtml(order, item)}</li>`;
      })
      .join('');
    const sendButton = canSendToPrint(order, orderView.jobsByItem)
      ? `<button type="button" data-send-order="${escapeHtml(order.id)}" data-code="${escapeHtml(order.tracking_code)}">Send to printer</button>`
      : '';
    // "Start printing" is not offered here: Send to printer queues the files and starts printing.
    const buttons = nextOrderStatuses(order.status)
      .filter((status) => status !== 'printing')
      .map(
        (status) => `
        <button type="button" class="${isIrreversibleMove(status) ? 'danger' : ''}"
                data-order-id="${escapeHtml(order.id)}" data-next="${escapeHtml(status)}"
                data-code="${escapeHtml(order.tracking_code)}">${escapeHtml(orderActionLabel(status))}</button>`
      )
      .join('');
    const placed = new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return `
      <li class="order">
        <div class="between">
          <span class="mono">${escapeHtml(order.tracking_code)}</span>
          <strong>${escapeHtml(ownerStatusLabel(order.status))}</strong>
        </div>
        <p class="muted small">${escapeHtml(placed)} · Total ${formatPaise(order.total_paise)}</p>
        <ul class="plain">${items}</ul>
        ${order.customer_note ? `<p class="note"><strong>Customer note:</strong> ${escapeHtml(order.customer_note)}</p>` : ''}
        ${paymentSection(order)}
        ${sendButton || buttons ? `<div class="actions">${sendButton}${buttons}</div>` : ''}
      </li>`;
  }

  // Payment line, payment buttons and (for cancelled or rejected orders) the reason.
  // The database checks every change, so these buttons only show what is allowed.
  function paymentSection(order) {
    const payButtons = nextPaymentActions(order)
      .map(
        (step) => `
        <button type="button" class="${step.danger ? 'danger' : ''}"
                data-pay-order="${escapeHtml(order.id)}" data-pay-action="${escapeHtml(step.action)}"
                data-pay-channel="${escapeHtml(step.channel ?? '')}" data-pay-code="${escapeHtml(order.tracking_code)}"
                data-pay-amount="${escapeHtml(String(order.total_paise))}">${escapeHtml(step.label)}</button>`
      )
      .join('');
    const stopped = order.status === 'cancelled' || order.status === 'rejected';
    const reasonOptions = CANCEL_REASONS.map(
      (reason) =>
        `<option value="${escapeHtml(reason)}"${reason === order.cancel_reason ? ' selected' : ''}>` +
        `${escapeHtml(cancelReasonLabel(reason))}</option>`
    ).join('');
    const reason = stopped
      ? `<label class="small">Reason
           <select data-reason-order="${escapeHtml(order.id)}" data-reason-code="${escapeHtml(order.tracking_code)}">
             <option value="">${order.cancel_reason ? 'Change the reason' : 'Choose a reason'}</option>
             ${reasonOptions}
           </select>
         </label>`
      : '';
    return `<p class="small"><strong>Payment:</strong> ${escapeHtml(paymentLabel(order))}</p>
      ${payButtons ? `<div class="actions">${payButtons}</div>` : ''}
      ${reason}`;
  }

  function bindOrders() {
    on('[data-action="refresh-orders"]', 'click', () => refreshOrders());
    onAll('[data-action="filter"]', 'click', (event) => {
      orderView.showAll = event.currentTarget.dataset.all === 'true';
      renderOrders();
    });
    onAll('[data-order-id]', 'click', onOrderAction);
    onAll('[data-file-id]', 'click', onFileLink);
    onAll('[data-pay-order]', 'click', onPaymentAction);
    onAll('[data-reason-order]', 'change', onReasonChange);
    on('[data-print-action="pair"]', 'click', onPairPrinter);
    onAll('[data-print-action="revoke"]', 'click', onRevokePrinter);
    onAll('[data-agent-printer]', 'change', onAgentPrinterChange);
    onAll('[data-send-order]', 'click', onSendToPrint);
    onAll('[data-retry-job]', 'click', onRetryJob);
  }

  // Records a payment step, then reloads the orders so the page shows what the database holds.
  async function runOrderChange(change, notice) {
    try {
      await change();
      await reloadOrders();
      renderOrders({ notice });
    } catch (err) {
      try {
        await reloadOrders();
      } catch {
        // Keep the list on screen. The error below explains what failed.
      }
      renderOrders({ error: messageFor(err) });
    }
  }

  async function onPaymentAction(event) {
    const button = event.currentTarget;
    const { payOrder, payAction, payChannel, payCode, payAmount } = button.dataset;
    if (
      payAction === 'refund' &&
      !window.confirm(`Record a refund of ${formatPaise(Number(payAmount))} for order ${payCode}? This cannot be undone.`)
    ) {
      return;
    }
    button.disabled = true;
    await runOrderChange(
      () => ownerApi.setOrderPayment(payOrder, payAction, payChannel || null),
      `Payment updated for order ${payCode}.`
    );
  }

  async function onReasonChange(event) {
    const select = event.currentTarget;
    const reason = select.value;
    if (!reason) return;
    select.disabled = true;
    await runOrderChange(
      () => ownerApi.setCancelReason(select.dataset.reasonOrder, reason),
      `Reason saved for order ${select.dataset.reasonCode}.`
    );
  }

  // The Refresh button. It shares the automatic refresh's request, so the two never overlap.
  async function refreshOrders(notice = '') {
    try {
      await liveOrders.refresh({ manual: true });
      renderOrders({ notice });
    } catch (err) {
      renderOrders({ error: messageFor(err) });
    }
  }

  // Called after every automatic attempt. An expired session stops the refresh and asks the owner to sign in.
  function onLiveStatus(state, error) {
    if (state === 'live') liveState = 'live';
    else if (error?.status === 401) liveState = 'expired';
    else liveState = 'offline';
    if (liveState === 'expired') liveOrders.stop();
    const el = app.querySelector('[data-live-status]');
    if (el) {
      el.textContent = liveMessages[liveState];
      el.className = `${liveState === 'live' ? 'muted' : 'error'} small`;
    }
  }

  // Changes from the automatic refresh wait while the owner is using a menu in the list
  // (a printer or reason menu), so the menu does not close under them.
  function isFocusedListControl() {
    const el = document.activeElement;
    return Boolean(el && app.contains(el) && ['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName));
  }

  async function onOrderAction(event) {
    const button = event.currentTarget;
    const { orderId, next: status, code } = button.dataset;
    if (isIrreversibleMove(status) && !window.confirm(`${orderActionLabel(status)} order ${code}? This cannot be undone.`)) {
      return;
    }
    button.disabled = true;
    try {
      await ownerApi.updateOrderStatus(orderView.shop.id, orderId, status);
      await reloadOrders();
      renderOrders({ notice: `Order ${code} is now ${ownerStatusLabel(status).toLowerCase()}.` });
    } catch (err) {
      try {
        await reloadOrders();
      } catch {
        // Keep the list on screen. The error below explains what failed.
      }
      renderOrders({ error: messageFor(err) });
    }
  }

  // ----- automatic printing -----

  // Sends a paid order's files to the printing computers. The notice says "sent", not
  // "printed": a page only prints when a computer picks the job up.
  async function onSendToPrint(event) {
    const button = event.currentTarget;
    const { sendOrder, code } = button.dataset;
    button.disabled = true;
    await runOrderChange(
      () => ownerApi.approveForPrint(sendOrder),
      `Order ${code} was sent to the printing computer. It prints when the computer picks it up.`
    );
  }

  // Printing again asks for a second confirmation when the page may already have come out.
  async function onRetryJob(event) {
    const button = event.currentTarget;
    const { retryJob, retryConfirm, retryWarning, code } = button.dataset;
    const mayHavePrinted = retryConfirm === 'true';
    if (mayHavePrinted && !window.confirm(`${retryWarning}\n\nPrint order ${code} again?`)) return;
    button.disabled = true;
    await runOrderChange(
      () => ownerApi.retryPrintJob(retryJob, mayHavePrinted),
      `Order ${code} was queued to print again.`
    );
  }

  async function onPairPrinter(event) {
    event.currentTarget.disabled = true;
    try {
      orderView.pairing = await ownerApi.createPrintPairing(orderView.shop.id);
      renderOrders();
    } catch (err) {
      renderOrders({ error: messageFor(err) });
    }
  }

  async function onRevokePrinter(event) {
    const { agentId, agentName } = event.currentTarget.dataset;
    if (!window.confirm(`Remove "${agentName}"? It stops printing until it is paired again.`)) return;
    await runOrderChange(() => ownerApi.revokePrintAgent(agentId), `"${agentName}" was removed.`);
  }

  async function onAgentPrinterChange(event) {
    const select = event.currentTarget;
    select.disabled = true;
    await runOrderChange(
      () => ownerApi.setAgentPrinter(select.dataset.agentPrinter, select.value || null),
      'The printer for that computer was saved.'
    );
  }

  // The printing computers and the pairing box. Only the shop owner can pair, rename or remove them.
  function printPanelHtml() {
    const printing = orderView.printing;
    if (!printing) {
      return '<p class="muted small">Automatic printing status is not available right now.</p>';
    }
    const agents = printing.agents ?? [];
    const notice = printingNotice({ agents, jobs: printing.jobs ?? [] });
    const rows = agents.map((agent) => agentRowHtml(agent, printing.is_owner)).join('');
    const pairing = orderView.pairing;
    const pairingBox = pairing
      ? `<div class="notice" data-pairing>
           <p><strong>Pairing code: <span class="mono">${escapeHtml(pairing.code)}</span></strong>
              Valid until ${escapeHtml(new Date(pairing.expires_at).toLocaleTimeString('en-IN', { timeStyle: 'short' }))}. Use it once.</p>
           <p class="small">On the shop computer, open a terminal in the agent folder and run:</p>
           <p class="mono small">qrquick-print-agent pair ${escapeHtml(printAgentFunctionUrl(config.supabaseUrl))} ${escapeHtml(pairing.code)}</p>
         </div>`
      : '';
    return `
      <section class="print-panel">
        <strong>Printing computers</strong>
        ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ''}
        ${rows || '<p class="muted small">No computer is connected for printing yet.</p>'}
        ${printing.is_owner
          ? '<div class="actions"><button type="button" data-print-action="pair">Connect a printing computer</button></div>'
          : ''}
        ${pairingBox}
      </section>`;
  }

  function agentRowHtml(agent, isOwner) {
    const options = (agent.printers ?? [])
      .map(
        (printer) =>
          `<option value="${escapeHtml(printer.name)}"${printer.name === agent.chosen_printer ? ' selected' : ''}>` +
          `${escapeHtml(printerOptionLabel(printer))}</option>`
      )
      .join('');
    const controls = isOwner
      ? `<label class="small">Printer
           <select data-agent-printer="${escapeHtml(agent.id)}">
             <option value="">Use this computer's default</option>
             ${options}
           </select>
         </label>
         <button type="button" class="link danger" data-print-action="revoke"
                 data-agent-id="${escapeHtml(agent.id)}" data-agent-name="${escapeHtml(agent.name)}">Remove</button>`
      : '';
    return `<div class="agent-row">
        <span><strong>${escapeHtml(agent.name)}</strong> · ${escapeHtml(agentStatusLabel(agent))}</span>
        ${controls}
      </div>`;
  }

  // The job status under one order item, with "Print again" when a retry is allowed.
  function jobLineHtml(order, item) {
    const job = orderView.jobsByItem.get(item.id);
    if (!job) return '';
    const failure = printFailureText(job);
    const retry = retryOptions(job);
    const again = retry
      ? `<button type="button" class="link" data-retry-job="${escapeHtml(job.id)}"
                 data-retry-confirm="${retry.confirmMayHavePrinted}" data-retry-warning="${escapeHtml(retry.warning)}"
                 data-code="${escapeHtml(order.tracking_code)}">Print again</button>`
      : '';
    return `<span class="job-line small">${escapeHtml(printJobLabel(job.status))}` +
      `${failure ? `: ${escapeHtml(failure)}` : ''} ${again}</span>`;
  }

  // Asks for a five-minute link to the file and opens it in a new tab.
  // The link is only made after the server confirms this owner's shop.
  async function onFileLink(event) {
    const button = event.currentTarget;
    const { fileId, fileOrder } = button.dataset;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Opening…';
    try {
      const link = await ownerApi.getFileLink(fileOrder, fileId);
      // Not noopener: the call returns null when the browser blocks the tab, which we need to know.
      const tab = window.open(link.url, '_blank');
      if (tab) {
        tab.opener = null;
      } else {
        renderOrders({ error: 'Your browser blocked the new tab. Allow pop-ups for this site and try again.' });
      }
    } catch (err) {
      renderOrders({ error: messageFor(err) });
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  }

  return { render };
}
