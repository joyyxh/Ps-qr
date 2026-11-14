// The licence screen for one shop (Stage 7E). It is read only: it shows the status
// the database returns for the shop and has one action, Refresh. It has no controls to
// grant, extend, revoke or replace a licence, and it shows no admin, audit, payment or
// coverage data. The state rules live in licence-status.js.

import { createLicenceStatusController, describeView } from './licence-status.js';
import { escapeHtml } from './logic.js';

export function createLicencePages({
  app,
  ownerApi,
  enabled = true, // false in the Android owner bundle: the licence view is deferred (STAGE7_DECISIONS.md item 13 / decision 19)
  now = () => Date.now(),
  isOnline = () => globalThis.navigator?.onLine !== false,
}) {
  let shop = null; // the shop on screen; null while this page is closed

  const controller = createLicenceStatusController({
    loadStatus: (shopId) => ownerApi.shopLicenceStatus(shopId),
    now,
    isOnline,
    onChange: (view) => {
      if (shop && view.shopId === shop.id) draw(shop, view);
    },
  });

  // Called by owner.js for #/owner/shop/<slug>/licence. Staff are told that the
  // status is for owners, and no request is sent for them.
  function open(nextShop) {
    shop = null; // a check for an earlier shop must not draw over this one
    controller.close();
    if (!enabled) return Promise.resolve(); // switched off: no request and nothing drawn
    shop = nextShop;
    if (nextShop.role !== 'owner') {
      draw(nextShop, null);
      return Promise.resolve();
    }
    return controller.open(nextShop.id);
  }

  // Called by owner.js when the owner leaves this page or signs out. Any check still
  // running is dropped when it arrives, and no licence data is kept.
  function close() {
    shop = null;
    controller.close();
  }

  function refresh() {
    if (shop?.role === 'owner') controller.refresh();
  }

  function draw(current, view) {
    app.innerHTML = pageHtml(current, view);
    app.querySelector('[data-action="licence-refresh"]')?.addEventListener('click', refresh);
  }

  function pageHtml(current, view) {
    const back = `<p class="small"><a href="#/owner/shop/${encodeURIComponent(current.slug)}">← Back to ${escapeHtml(current.name)}</a></p>`;
    if (current.role !== 'owner') {
      return `<section class="card">${back}
        <h1>Licence</h1>
        <p class="muted">The licence status is shown to the shop owner only.</p>
      </section>`;
    }

    const model = describeView(view, now());
    return `<section class="card licence-page">
      ${back}
      <h1>Licence</h1>
      <p class="muted small">Read only. This shows the licence the server holds for this shop. Nothing on this page changes it.</p>
      <div class="licence-status" role="status" aria-live="polite">
        ${model.badge ? `<p class="licence-badge ${model.tone}">${escapeHtml(model.badge)}</p>` : ''}
        ${model.summary ? `<p>${escapeHtml(model.summary)}</p>` : ''}
        ${model.nextStart ? `<p>${escapeHtml(model.nextStart)}</p>` : ''}
        ${model.signIn ? '<p><a class="button secondary" href="#/owner">Sign in again</a></p>' : ''}
      </div>
      <div class="licence-foot">
        <p class="muted small">${escapeHtml(model.checkedText)}</p>
        <button type="button" data-action="licence-refresh" data-label="Refresh"${model.busy ? ' disabled' : ''}>${model.busy ? 'Checking…' : 'Refresh'}</button>
      </div>
    </section>`;
  }

  return { open, close, refresh };
}
