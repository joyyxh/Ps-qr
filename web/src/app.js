import { createApi } from './api.js';
import { createAuth } from './auth.js';
import { createOwnerApi } from './owner-api.js';
import { createOwnerPages } from './owner.js';
import { browserSessionStorage, createSessionStore } from './session.js';
import {
  buildItem,
  checkUploadFile,
  colourAvailable,
  escapeHtml,
  fileAlreadyInOrder,
  formatPaise,
  publicAssetUrl,
  shopOffersColour,
  shopOffersDoubleSided,
  statusLabel,
  UPLOAD_ACCEPT,
  unitLabel,
} from './logic.js';

const config = window.PRINTNEST_CONFIG;
const app = document.getElementById('app');
const THEME_KEY = 'qrquick.theme';

let api = null;
let owner = null;
let shop = null;
let services = [];
let catalog = []; // feature labels: { key, label, affects_orders }
let cart = [];
let pendingUpload = null; // the uploaded file for the item being built: { file_id, original_name, page_count }
let uploadSeq = 0; // ignores a finished upload when the customer has picked another file since
let quoteSeq = 0; // ignores out-of-order quote responses

if (!config?.supabaseUrl || !config?.publishableKey) {
  app.innerHTML = '<section class="card"><p class="error">Missing config.js settings.</p></section>';
} else {
  api = createApi(config);
  const auth = createAuth({ config, store: createSessionStore(browserSessionStorage()) });
  owner = createOwnerPages({ app, auth, ownerApi: createOwnerApi({ config, auth }), config });
  startApp(auth);
}

async function startApp(auth) {
  applyTheme(loadTheme());
  bindThemePicker();
  const callback = await auth.consumeCallback(window.location.hash);
  if (callback.handled) {
    // Access and refresh tokens arrive in the fragment. Remove them before
    // rendering anything so they are not retained in browser history.
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    if (callback.error) {
      app.innerHTML = `<section class="card"><h1>Email confirmation failed</h1>
        <p class="error">${escapeHtml(callback.error.message)}</p>
        <p><a class="button" href="#/owner">Return to owner sign in</a></p></section>`;
      window.addEventListener('hashchange', route);
      return;
    }
    window.location.hash = '#/owner';
  }
  window.addEventListener('hashchange', route);
  route();
}

// ---------- routing (hash based, so it works on any static host) ----------

function route() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').map(safeDecode);
  const [kind = '', value = ''] = parts;

  if (!kind || kind === 'home') return renderHome();
  if (kind === 'scan') return renderScan();
  if (kind === 's' && value) return renderShop(value);
  if (kind === 'track') return renderTrack(value);
  if (kind === 'owner') return owner.render(parts.slice(1));
  return renderNotFound();
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return '';
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return ['system', 'light', 'dark'].includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const select = document.getElementById('theme-select');
  if (select) select.value = theme;
}

function bindThemePicker() {
  document.getElementById('theme-select')?.addEventListener('change', (event) => {
    const theme = ['system', 'light', 'dark'].includes(event.target.value) ? event.target.value : 'system';
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* preferences are optional */ }
    applyTheme(theme);
  });
}

function renderHome() {
  app.innerHTML = `
    <section class="hero card">
      <p class="eyebrow">PRINT. PICK UP. DONE.</p>
      <h1>Local printing, without the queue.</h1>
      <p class="lead">Scan your shop’s QR code, choose your options, and send the job ahead. No customer account needed.</p>
      <div class="actions hero-actions">
        <a class="button" href="#/scan">▦ Scan a shop QR</a>
        <a class="button secondary" href="#/owner">Add your shop</a>
      </div>
    </section>
    <section class="home-grid" aria-label="QRquick customer actions">
      <article class="card home-card"><span class="step">01</span><h2>Scan and connect</h2><p class="muted">Use a shop QR code or enter its link. You’ll land on the right counter, not a generic marketplace.</p><a href="#/scan">Open shop scanner →</a></article>
      <article class="card home-card"><span class="step">02</span><h2>Send your files</h2><p class="muted">Upload a PDF, JPG, or PNG, set copies and print mode, then review the server-calculated price.</p><a href="#/track">Track an existing order →</a></article>
      <article class="card home-card"><span class="step">03</span><h2>Collect with confidence</h2><p class="muted">Follow the status with your private tracking code. Customers never need an account.</p><a href="#/owner">For shop owners →</a></article>
    </section>`;
}

function renderNotFound() {
  app.innerHTML = '<section class="card"><p class="eyebrow">NOT FOUND</p><h1>That QRquick link is not valid.</h1><p class="muted">Use a participating shop’s QR code or return to the QRquick home screen.</p><p><a class="button" href="#/home">Back to QRquick</a></p></section>';
}

function renderScan() {
  app.innerHTML = `
    <section class="card scan-card">
      <p class="eyebrow">SHOP CONNECT</p><h1>Scan a shop QR</h1>
      <p class="muted">Choose a QR image from your phone, or paste the shop link/code below. QRquick only opens its own shop routes.</p>
      <label>Shop link or slug<input id="shop-link" inputmode="url" placeholder="https://…/#/s/your-shop or your-shop" /></label>
      <div class="actions"><button id="open-shop" type="button">Open shop</button><a class="button secondary" href="#/home">Cancel</a></div>
      <p id="scan-error" class="error" role="alert"></p>
      <label class="scan-upload">Scan an image<input id="qr-image" type="file" accept="image/*" capture="environment" /></label>
      <p id="scan-status" class="hint muted" role="status"></p>
    </section>`;
  document.getElementById('open-shop').addEventListener('click', () => openShopInput(document.getElementById('shop-link').value));
  document.getElementById('shop-link').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') openShopInput(event.target.value);
  });
  document.getElementById('qr-image').addEventListener('change', onQrImage);
}

function shopSlugFromInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let candidate = raw;
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin && raw.includes('://')) return '';
    const hash = url.hash.match(/^#\/?s\/([^/?#]+)/);
    candidate = hash ? hash[1] : (url.pathname.match(/\/s\/([^/]+)/)?.[1] ?? raw);
  } catch { /* treat it as a slug below */ }
  candidate = safeDecode(candidate).toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(candidate) ? candidate : '';
}

function openShopInput(value) {
  const slug = shopSlugFromInput(value);
  const error = document.getElementById('scan-error');
  if (!slug) {
    if (error) error.textContent = 'Enter a valid QRquick shop link or slug.';
    return;
  }
  window.location.hash = `#/s/${encodeURIComponent(slug)}`;
}

async function onQrImage(event) {
  const status = document.getElementById('scan-status');
  const file = event.target.files?.[0];
  if (!file) return;
  if (!('BarcodeDetector' in window)) {
    status.textContent = 'This browser cannot scan images directly. Paste the shop link or slug instead.';
    return;
  }
  try {
    status.textContent = 'Reading QR code…';
    const bitmap = await createImageBitmap(file);
    const results = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bitmap);
    bitmap.close?.();
    if (!results[0]?.rawValue) throw new Error('No QR code found in that image.');
    openShopInput(results[0].rawValue);
  } catch (error) {
    status.textContent = error.message || 'Could not read that QR image.';
  }
}

function serviceById(id) {
  return services.find((service) => service.id === id);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? '';
}

// ---------- shop page ----------

async function renderShop(slug) {
  app.innerHTML = '<p class="muted">Loading shop…</p>';
  try {
    shop = await api.getShop(slug);
    if (!shop) {
      app.innerHTML =
        '<section class="card"><h1>Shop not found</h1>' +
        '<p class="muted">Check the QR code or link and try again.</p></section>';
      return;
    }
    // The feature list is extra information, so if it cannot load the page still works without it.
    [services, catalog] = await Promise.all([api.getServices(shop.id), api.getFeatureCatalog().catch(() => [])]);
  } catch (err) {
    app.innerHTML = `<section class="card"><p class="error">Could not load this shop: ${escapeHtml(err.message)}</p></section>`;
    return;
  }

  cart = [];
  pendingUpload = null;
  app.innerHTML = shopTemplate();
  bindShop();
  renderCart();
  refreshQuote();
}

function shopTemplate() {
  const details = [shop.address, shop.phone].filter(Boolean).map(escapeHtml).join(' · ');
  const options = services
    .map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>`)
    .join('');

  const status = shop.is_open
    ? '<p class="badge ok">Open now</p>'
    : '<p class="banner">This shop is closed right now. You can see prices, but orders cannot be placed.</p>';

  const orderForm = services.length
    ? `
    <section class="card">
      <h2>Add a print item</h2>
      <form id="item-form" class="grid">
        <label>Service
          <select name="serviceId" id="service-select">${options}</select>
        </label>
        <p id="service-hint" class="hint muted"></p>
        <label>File (PDF, JPEG or PNG, up to 10 MB)
          <input name="file" id="file-input" type="file" accept="${UPLOAD_ACCEPT}" ${shop.is_open ? '' : 'disabled'} required />
        </label>
        <p id="upload-status" class="hint muted" role="status"></p>
        <label>Copies
          <input name="copies" type="number" min="1" max="100" value="1" inputmode="numeric" required />
        </label>
        <label class="check"><input name="colour" id="colour" type="checkbox"
               ${shopOffersColour(shop) ? '' : 'disabled'} /> Colour${shopOffersColour(shop) ? '' : ' (not offered at this shop)'}</label>
        <label class="check"><input name="duplex" id="duplex" type="checkbox"
               ${shopOffersDoubleSided(shop) ? '' : 'disabled'} /> Double-sided${shopOffersDoubleSided(shop) ? '' : ' (not offered at this shop)'}</label>
        <button type="submit" id="add-item" disabled>Add to order</button>
      </form>
      <p class="muted small">Your file is stored privately and only this shop can open it. Automatic deletion is not switched on yet.</p>
      <p id="item-error" class="error" role="alert"></p>
    </section>

    <section class="card">
      <h2>Your order</h2>
      <ul id="cart" class="cart"></ul>
      <div id="quote" class="quote"></div>
      <label>Note for the shop (optional)
        <textarea id="note" rows="2" maxlength="300"></textarea>
      </label>
      <label>Payment method
        <select id="payment-method">
          <option value="cash">Cash at the counter</option>
          <option value="upi" ${shop.payment_qr_path ? '' : 'disabled'}>UPI via the shop QR${shop.payment_qr_path ? '' : ' (shop has not added a QR yet)'}</option>
        </select>
      </label>
      <button id="place" type="button" disabled>Place order</button>
      <p class="muted small">${
        shop.payment_qr_path
          ? 'Cash is verified by the shop. UPI remains pending until the shop verifies the receipt. QRquick does not take any payment.'
          : 'Pay at the shop counter after your order is approved. The shop must verify cash before printing.'
      }</p>
      <p id="order-error" class="error" role="alert"></p>
    </section>`
    : '<section class="card"><p class="muted">This shop has not published any services yet.</p></section>';

  return `
    <section class="card">
      <h1>${escapeHtml(shop.name)}</h1>
      ${details ? `<p class="muted">${details}</p>` : ''}
      ${status}
      ${offeredFeaturesHtml()}
    </section>
    ${paymentQrCard()}
    ${orderForm}`;
}

// The features this shop has switched on, for example "Colour printing, Stapling".
function offeredFeaturesHtml() {
  const labels = catalog
    .filter((feature) => shop.features?.[feature.key] === true)
    .map((feature) => escapeHtml(feature.label));
  return labels.length ? `<p class="small"><strong>Also offered here:</strong> ${labels.join(', ')}</p>` : '';
}

// The shop's own payment QR code, when the owner has uploaded one.
function paymentQrCard() {
  if (!shop.payment_qr_path) return '';
  return `
    <section class="card">
      <h2>Pay with this QR code</h2>
      <p class="muted small">Pay the shop directly with this code, for example in your UPI app.
         QRquick does not take the payment.</p>
      <img class="payment-qr-preview" alt="Payment QR code for ${escapeHtml(shop.name)}"
           src="${escapeHtml(publicAssetUrl(config.supabaseUrl, shop.payment_qr_path))}" />
    </section>`;
}

// A colour-only service cannot be printed while the shop has colour printing switched off.
function serviceBlocked(service) {
  return Boolean(service) && service.bw_price_paise === null && !shopOffersColour(shop);
}

// The Add button is on only when a file is ready, the shop is open and the service can be ordered.
function refreshAddButton() {
  const addBtn = document.getElementById('add-item');
  if (!addBtn) return;
  const service = serviceById(document.getElementById('service-select').value);
  addBtn.disabled = !(pendingUpload && shop.is_open) || serviceBlocked(service);
}

function bindShop() {
  const select = document.getElementById('service-select');
  if (!select) return;

  select.addEventListener('change', updateServiceHint);
  updateServiceHint();

  document.getElementById('item-form').addEventListener('submit', onAddItem);
  document.getElementById('file-input').addEventListener('change', onFileChosen);
  document.getElementById('cart').addEventListener('click', onCartClick);
  document.getElementById('place').addEventListener('click', onPlaceOrder);
}

function updateServiceHint() {
  const service = serviceById(document.getElementById('service-select').value);
  const colourBox = document.getElementById('colour');
  if (!service) return;

  const hasBw = service.bw_price_paise !== null;
  const hasColour = colourAvailable(service);
  const parts = [];
  if (hasBw) parts.push(`B&W ${formatPaise(service.bw_price_paise)} ${unitLabel(service.pricing_unit)}`);
  if (hasColour) parts.push(`Colour ${formatPaise(service.colour_price_paise)} ${unitLabel(service.pricing_unit)}`);
  if (serviceBlocked(service)) parts.push('colour printing is not offered at this shop, so this service cannot be ordered');
  setText('service-hint', parts.join(' · '));

  // Colour is only a choice when the service offers both modes and the shop offers colour.
  // A colour-only service is always colour; a B&W-only service never is.
  colourBox.disabled = !(hasBw && hasColour) || !shopOffersColour(shop);
  if (!hasBw) colourBox.checked = true;
  if (!hasColour || !shopOffersColour(shop)) colourBox.checked = false;
  refreshAddButton();
}

// Uploads as soon as a file is chosen. The server counts the pages, so the
// customer never types them. The Add button stays off until the upload is done.
async function onFileChosen(event) {
  const input = event.currentTarget;
  const addBtn = document.getElementById('add-item');
  const file = input.files && input.files[0];
  const seq = ++uploadSeq;

  pendingUpload = null;
  setText('item-error', '');
  setText('upload-status', '');
  addBtn.disabled = true;
  if (!file) return;

  const problem = checkUploadFile(file);
  if (problem) {
    input.value = '';
    setText('item-error', problem);
    return;
  }

  setText('upload-status', 'Uploading and checking the file…');
  try {
    const upload = await api.uploadFile(shop.slug, file);
    if (seq !== uploadSeq) return; // the customer picked another file meanwhile
    pendingUpload = upload;
    setText('upload-status', `${upload.original_name} · ${plural(upload.page_count, 'page')} · ready to add`);
    refreshAddButton();
  } catch (err) {
    if (seq !== uploadSeq) return;
    input.value = '';
    setText('upload-status', '');
    setText('item-error', err.message);
  }
}

function onAddItem(event) {
  event.preventDefault();
  setText('item-error', '');

  const form = event.currentTarget;
  const data = new FormData(form);
  const service = serviceById(data.get('serviceId'));
  const colourOnly = service && service.bw_price_paise === null;

  if (!pendingUpload) {
    setText('item-error', 'Upload a file first.');
    return;
  }
  if (fileAlreadyInOrder(cart, pendingUpload.file_id)) {
    setText('item-error', 'This file is already in your order. Upload it again to order it twice.');
    return;
  }

  if (serviceBlocked(service)) {
    setText('item-error', 'Colour printing is switched off at this shop, so this service cannot be ordered.');
    return;
  }

  try {
    cart.push(
      buildItem({
        serviceId: data.get('serviceId'),
        file: pendingUpload,
        copies: data.get('copies'),
        colour: colourOnly ? true : data.get('colour') === 'on',
        duplex: data.get('duplex') === 'on',
      })
    );
  } catch (err) {
    setText('item-error', err.message);
    return;
  }

  pendingUpload = null;
  form.reset();
  document.getElementById('add-item').disabled = true;
  setText('upload-status', '');
  updateServiceHint();
  renderCart();
  refreshQuote();
}

function renderCart() {
  const list = document.getElementById('cart');
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = '<li class="muted">No items yet.</li>';
    return;
  }

  list.innerHTML = cart
    .map((item, index) => {
      const service = serviceById(item.service_id);
      const modes = [item.colour ? 'Colour' : 'B&W', item.duplex ? 'double-sided' : 'single-sided'];
      return `
        <li>
          <span>${escapeHtml(service ? service.name : 'Service')} · ${escapeHtml(item.file_name)}
            (${plural(item.page_count, 'page')}) × ${plural(item.copies, 'copy')} · ${modes.join(', ')}</span>
          <button type="button" class="link" data-remove="${index}">Remove</button>
        </li>`;
    })
    .join('');
}

function onCartClick(event) {
  const button = event.target.closest('button[data-remove]');
  if (!button) return;
  cart.splice(Number(button.dataset.remove), 1);
  renderCart();
  refreshQuote();
}

// The server prices the cart. The browser only displays the answer.
async function refreshQuote() {
  const quoteEl = document.getElementById('quote');
  const placeBtn = document.getElementById('place');
  if (!quoteEl || !placeBtn) return;

  const seq = ++quoteSeq;
  placeBtn.disabled = true;

  if (!cart.length) {
    quoteEl.innerHTML = '<p class="muted">Add an item to see the price.</p>';
    return;
  }

  quoteEl.innerHTML = '<p class="muted">Calculating…</p>';
  try {
    const quote = await api.quote(shop.slug, cart);
    if (seq !== quoteSeq) return; // a newer request is already in flight
    quoteEl.innerHTML = quoteTemplate(quote);
    placeBtn.disabled = !shop.is_open;
  } catch (err) {
    if (seq !== quoteSeq) return;
    quoteEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

function quoteTemplate(quote) {
  const rows = quote.items
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.service_name)} · ${escapeHtml(line.file_name ?? '')}${line.duplex ? ' (double-sided)' : ''}</td>
        <td class="num">${line.billable_units} ${escapeHtml(unitLabel(line.pricing_unit))}
          × ${formatPaise(line.unit_price_paise)}</td>
        <td class="num">${formatPaise(line.amount_paise)}</td>
      </tr>`
    )
    .join('');

  return `
    <table class="breakdown">
      <thead><tr><th>Item</th><th class="num">Billed</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="2">Total, pay at counter</th><th class="num">${formatPaise(quote.total_paise)}</th></tr>
      </tfoot>
    </table>
    <p class="muted small">The shop's system recalculates this when you place the order.</p>`;
}

async function onPlaceOrder() {
  const placeBtn = document.getElementById('place');
  const note = document.getElementById('note').value.trim();
  const paymentMethod = document.getElementById('payment-method')?.value === 'upi' ? 'upi' : 'cash';
  setText('order-error', '');
  placeBtn.disabled = true;
  placeBtn.textContent = 'Placing order…';

  try {
    const result = await api.placeOrder(shop.slug, cart, note, paymentMethod);
    renderConfirmation(result);
  } catch (err) {
    setText('order-error', err.message);
    placeBtn.disabled = false;
    placeBtn.textContent = 'Place order';
  }
}

function renderConfirmation(result) {
  cart = [];
  const slug = encodeURIComponent(shop.slug);
  const code = encodeURIComponent(result.tracking_code);
  app.innerHTML = `
    <section class="card confirm">
      <h1>Order received</h1>
      <p>Your tracking code</p>
      <p class="code">${escapeHtml(result.tracking_code)}</p>
      <p>Total <strong>${formatPaise(result.total_paise)}</strong>. ${result.payment_method === 'upi' ? 'UPI payment is pending shop verification.' : 'Pay cash at the counter; the shop verifies it before printing.'}</p>
      <p class="muted">Status: ${escapeHtml(statusLabel(result.status))}</p>
      <p><a href="#/track/${code}">Track this order</a> · <a href="#/s/${slug}">Start another order</a></p>
    </section>
    ${paymentQrCard()}`;
}

// ---------- order tracking ----------

function renderTrack(code) {
  app.innerHTML = `
    <section class="card">
      <h1>Track your order</h1>
      <form id="track-form" class="grid">
        <label>Tracking code
          <input id="track-code" value="${escapeHtml(code)}" autocomplete="off"
                 autocapitalize="characters" maxlength="12" required />
        </label>
        <button type="submit">Check status</button>
      </form>
      <div id="track-result"></div>
    </section>`;

  document.getElementById('track-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('track-code').value.trim();
    if (value) lookupOrder(value);
  });

  if (code) lookupOrder(code);
}

async function lookupOrder(code) {
  const out = document.getElementById('track-result');
  out.innerHTML = '<p class="muted">Checking…</p>';
  try {
    const order = await api.track(code);
    if (!order) {
      out.innerHTML = '<p class="error">No order found with that code.</p>';
      return;
    }
    out.innerHTML = `
      <div class="status">
        <p class="muted">${escapeHtml(order.shop_name)} · ${escapeHtml(new Date(order.created_at).toLocaleString('en-IN'))}</p>
        <p class="code">${escapeHtml(order.tracking_code)}</p>
        <p><strong>${escapeHtml(statusLabel(order.status))}</strong></p>
        <p>Total ${formatPaise(order.total_paise)}</p>
        <p>Payment: <strong>${escapeHtml(order.payment_status === 'paid' ? 'Verified' : order.payment_status === 'pending' ? 'Pending shop verification' : 'Cash due at counter')}</strong></p>
        ${order.payment_rejection_reason ? `<p class="note">${escapeHtml(order.payment_rejection_reason)}</p>` : ''}
      </div>`;
  } catch (err) {
    out.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}
