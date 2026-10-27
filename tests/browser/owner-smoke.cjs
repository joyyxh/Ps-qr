// Browser smoke test for the owner pages and the customer page.
// Supabase is replaced by an in-memory mock (page.route), so this checks the
// front end only: rendering, navigation, which token each call carries, and
// escaping. It does not test the database (see supabase/tests).
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const BASE = 'http://127.0.0.1:5173/';
const SHOP_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const SVC_DOC = 'cccccccc-0000-0000-0000-000000000001';
const SVC_OLD = 'cccccccc-0000-0000-0000-000000000003';
const CATALOG = [
  { key: 'colour_printing', label: 'Colour printing', affects_orders: true, sort_order: 1 },
  { key: 'double_sided', label: 'Double-sided printing', affects_orders: true, sort_order: 2 },
  { key: 'photocopy', label: 'Photocopy', affects_orders: false, sort_order: 3 },
  { key: 'scanning', label: 'Scanning', affects_orders: false, sort_order: 4 },
  { key: 'spiral_binding', label: 'Spiral or comb binding', affects_orders: false, sort_order: 5 },
  { key: 'lamination', label: 'Lamination', affects_orders: false, sort_order: 6 },
  { key: 'passport_photos', label: 'Passport photos', affects_orders: false, sort_order: 7 },
  { key: 'stapling', label: 'Stapling', affects_orders: false, sort_order: 8 },
];

const state = {
  uploads: [],
  deletes: [],
  shops: [
    {
      id: SHOP_ID,
      slug: 'demo-xerox',
      name: 'Demo Xerox Centre',
      features: { colour_printing: true, double_sided: true, photocopy: false, scanning: false, spiral_binding: false, lamination: false, passport_photos: false, stapling: false },
      payment_qr_path: null,
      phone: '+91 98765 00001',
      address: 'Main Road, Ranchi',
      is_open: true,
    },
  ],
  memberships: [{ user_id: 'owner-1', shop_id: SHOP_ID, role: 'owner' }],
  services: [
    { id: SVC_DOC, shop_id: SHOP_ID, name: 'Document printing', pricing_unit: 'per_side', bw_price_paise: 200, colour_price_paise: 1000, is_active: true },
    { id: SVC_OLD, shop_id: SHOP_ID, name: 'Old inkjet print', pricing_unit: 'per_side', bw_price_paise: 300, colour_price_paise: null, is_active: false },
  ],
  orders: [
    {
      id: 'ord-1',
      shop_id: SHOP_ID,
      tracking_code: 'ABCD2345',
      status: 'pending',
      total_paise: 4800,
      customer_note: '<i>Please staple</i>',
      created_at: '2026-10-15T10:00:00Z',
      order_items: [
        { service_name: 'Document printing', pricing_unit: 'per_side', page_count: 12, copies: 2, colour: false, duplex: true, billable_units: 24, amount_paise: 4800 },
      ],
    },
    {
      id: 'ord-2',
      shop_id: SHOP_ID,
      tracking_code: 'WXYZ2345',
      status: 'pending',
      total_paise: 900,
      customer_note: null,
      created_at: '2026-10-15T11:00:00Z',
      order_items: [
        { service_name: 'Assignment print (per sheet)', pricing_unit: 'per_sheet', page_count: 3, copies: 2, colour: false, duplex: false, billable_units: 6, amount_paise: 900 },
      ],
    },
  ],
  requests: [],
};

// The moves the database allows (guard_order_changes in migration 0001).
const MOVES = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['printing', 'ready', 'completed', 'cancelled'],
  printing: ['ready', 'completed'],
  ready: ['completed'],
};

let tokenCounter = 0;
function newSession() {
  tokenCounter += 1;
  return {
    access_token: `owner-token-${tokenCounter}`,
    refresh_token: 'refresh-1',
    expires_in: 3600,
    user: { id: 'owner-1', email: 'owner@example.com' },
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

async function handleSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });

  let body = null; // binary uploads are not JSON
  try {
    body = req.postData() ? JSON.parse(req.postData()) : null;
  } catch {
    body = null;
  }
  const headers = req.headers();
  state.requests.push({
    method: req.method(),
    path: url.pathname + url.search,
    auth: headers['authorization'] ?? null,
    body,
  });

  const json = (status, data) =>
    route.fulfill({
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: data === null ? '' : JSON.stringify(data),
    });
  const eqValue = (name) => {
    const value = url.searchParams.get(name);
    return value && value.startsWith('eq.') ? decodeURIComponent(value.slice(3)) : null;
  };
  const shopFields = (shop) => ({ ...shop });

  // ----- Auth -----
  if (url.pathname === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      if (body.password !== 'correct-horse') {
        return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return json(200, newSession());
    }
    if (grant === 'refresh_token') return json(200, newSession());
  }
  if (url.pathname === '/auth/v1/logout') return json(204, null);

  // ----- Shop memberships (owner's shop list) -----
  if (url.pathname === '/rest/v1/shop_memberships') {
    const userId = eqValue('user_id');
    const rows = state.memberships
      .filter((m) => m.user_id === userId)
      .map((m) => ({ role: m.role, shop: shopFields(state.shops.find((s) => s.id === m.shop_id)) }));
    return json(200, rows);
  }

  // ----- Shops -----
  if (url.pathname === '/rest/v1/shops') {
    if (req.method() === 'GET') {
      const slug = eqValue('slug');
      return json(200, state.shops.filter((s) => s.slug === slug).map(shopFields));
    }
    if (req.method() === 'PATCH') {
      const id = eqValue('id');
      const shop = state.shops.find((s) => s.id === id);
      if (!shop) return json(200, []);
      Object.assign(shop, body);
      return json(200, [shopFields(shop)]);
    }
  }

  // ----- Services -----
  if (url.pathname === '/rest/v1/services') {
    if (req.method() === 'GET') {
      const shopId = eqValue('shop_id');
      const activeOnly = url.searchParams.get('is_active') === 'eq.true';
      return json(
        200,
        state.services.filter((s) => s.shop_id === shopId && (!activeOnly || s.is_active))
      );
    }
    if (req.method() === 'POST') {
      const row = { id: `svc-${state.services.length + 1}`, ...body };
      state.services.push(row);
      return json(201, [row]);
    }
    if (req.method() === 'PATCH') {
      const id = eqValue('id');
      const row = state.services.find((s) => s.id === id);
      if (!row) return json(200, []);
      Object.assign(row, body);
      return json(200, [row]);
    }
  }

  // ----- Orders -----
  if (url.pathname === '/rest/v1/orders') {
    if (req.method() === 'GET') {
      const shopId = eqValue('shop_id');
      return json(
        200,
        state.orders
          .filter((o) => o.shop_id === shopId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((o) => ({ ...o }))
      );
    }
    if (req.method() === 'PATCH') {
      const order = state.orders.find((o) => o.id === eqValue('id') && o.shop_id === eqValue('shop_id'));
      if (!order) return json(200, []);
      if (!(MOVES[order.status] ?? []).includes(body.status)) {
        return json(400, { code: '22023', message: `invalid order status change from ${order.status} to ${body.status}` });
      }
      order.status = body.status;
      return json(200, [{ ...order }]);
    }
  }

  // ----- RPCs -----
  if (url.pathname === '/rest/v1/rpc/create_shop') {
    if (state.shops.some((s) => s.slug === body.p_slug)) {
      return json(409, {
        code: '23505',
        message: `duplicate key value violates unique constraint "shops_slug_key"`,
      });
    }
    const shop = {
      id: `bbbbbbbb-0000-0000-0000-00000000000${state.shops.length + 1}`,
      slug: body.p_slug,
      name: body.p_name,
      phone: body.p_phone,
      address: body.p_address,
      is_open: true,
    };
    state.shops.push(shop);
    state.memberships.push({ user_id: 'owner-1', shop_id: shop.id, role: 'owner' });
    return json(200, shop);
  }

  // ----- Feature catalogue, shop features, payment QR and storage -----
  if (url.pathname === '/rest/v1/feature_catalog') return json(200, CATALOG);
  if (url.pathname === '/rest/v1/rpc/set_shop_features') {
    const shop = state.shops.find((s) => s.id === body.p_shop_id);
    if (!shop) return json(403, { code: '42501', message: 'you do not have permission to change this shop' });
    shop.features = { ...shop.features, ...body.p_features };
    return json(200, shop.features);
  }
  if (url.pathname === '/rest/v1/rpc/set_payment_qr') {
    const shop = state.shops.find((s) => s.id === body.p_shop_id);
    if (!shop) return json(403, { code: '42501', message: 'you do not have permission to change this shop' });
    shop.payment_qr_path = body.p_path;
    return json(200, body.p_path);
  }
  if (url.pathname.startsWith('/storage/v1/object/shop-assets/')) {
    const name = decodeURIComponent(url.pathname.slice('/storage/v1/object/shop-assets/'.length));
    if (req.method() === 'POST') {
      state.uploads.push(name);
      return json(200, { Key: `shop-assets/${name}` });
    }
    if (req.method() === 'DELETE') {
      state.deletes.push(name);
      return json(200, { message: 'Successfully deleted' });
    }
  }
  return json(404, { message: `not mocked: ${req.method()} ${url.pathname}` });
}

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function waitText(page, text, timeout = 8000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  const problems = [];
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.accept();
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    // The browser logs every 4xx response. 400 (wrong password) and 409 (taken address)
    // are triggered on purpose above, so only other console errors count.
    const expected = /Failed to load resource: the server responded with a status of (400|409)/.test(text);
    if (msg.type() === 'error' && !expected && !/favicon/i.test(text)) problems.push(`console: ${text}`);
  });

  await page.route(/supabase\.co/, handleSupabase);

  // 1. Signed out: sign-in form.
  await page.goto(`${BASE}#/owner`);
  await page.locator('#auth-form').waitFor();
  check('signed out shows the owner sign-in form', (await page.locator('#auth-form').count()) === 1);

  // 2. Wrong password shows a clear message and stays signed out.
  await page.fill('#auth-form input[name=email]', 'owner@example.com');
  await page.fill('#auth-form input[name=password]', 'wrong-password');
  await page.click('#auth-form button[type=submit]');
  await waitText(page, 'do not match an account');
  check('wrong password shows a clear message', true);

  // 3. Correct password: shop list, session kept for this tab only.
  await page.fill('#auth-form input[name=password]', 'correct-horse');
  await page.click('#auth-form button[type=submit]');
  await waitText(page, 'Your shops');
  await waitText(page, 'Demo Xerox Centre');
  const stored = await page.evaluate(() => sessionStorage.getItem('printnest.owner.session'));
  const localKeys = await page.evaluate(() => Object.keys(localStorage));
  check('owner session is kept in sessionStorage', Boolean(stored));
  check('owner session is not kept in localStorage', localKeys.every((k) => !k.includes('printnest')));
  check('stored session does not contain the password', stored && !stored.includes('correct-horse'));
  const memberCalls = state.requests.filter((r) => r.path.startsWith('/rest/v1/shop_memberships'));
  check(
    'owner list request carries the owner token',
    memberCalls.length > 0 && memberCalls.every((r) => r.auth && r.auth.startsWith('Bearer owner-token-'))
  );

  // 4. Open the shop: details, services, hidden service shown to owner.
  await page.click('text=Demo Xerox Centre');
  await waitText(page, 'Open for orders');
  const rows = await page.locator('table.breakdown tbody tr').count();
  check('owner sees all services, including hidden ones', rows === 2, `rows=${rows}`);
  check('hidden service is labelled', (await page.getByText('hidden from customers').count()) === 1);
  const pageAddress = await page.locator('input[readonly]').inputValue();
  check('customer page address is shown', pageAddress.endsWith('#/s/demo-xerox'), pageAddress);

  await page.screenshot({ path: '/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/owner-shop-phone.png', fullPage: true });

  // 5. Close the shop: PATCH with only is_open, with the owner token.
  const beforePatch = state.requests.length;
  await page.click('[data-action="toggle-open"]');
  await waitText(page, 'Closed. Customers can see prices');
  const toggle = state.requests.slice(beforePatch).find((r) => r.method === 'PATCH' && r.path.startsWith('/rest/v1/shops'));
  check('toggle sends only is_open', toggle && JSON.stringify(toggle.body) === '{"is_open":false}', JSON.stringify(toggle?.body));
  check('toggle carries the owner token', toggle && toggle.auth.startsWith('Bearer owner-token-'));
  check('shop state changed in the database mock', state.shops[0].is_open === false);

  // 6. Edit a service price: typed rupees become paise.
  await page.click(`button[data-edit="${SVC_DOC}"]`);
  await page.locator('#service-form input[name=bwPrice]').waitFor();
  const prefilled = await page.locator('#service-form input[name=bwPrice]').inputValue();
  check('edit form is filled with the current price', prefilled === '2', `value=${prefilled}`);
  await page.fill('#service-form input[name=bwPrice]', '2.50');
  const beforeEdit = state.requests.length;
  await page.click('#service-form button[type=submit]');
  await waitText(page, 'Service saved.');
  const edit = state.requests.slice(beforeEdit).find((r) => r.method === 'PATCH' && r.path.startsWith('/rest/v1/services'));
  check('service edit is limited to one service in this shop', edit && edit.path.includes(`id=eq.${SVC_DOC}`) && edit.path.includes(`shop_id=eq.${SHOP_ID}`), edit?.path);
  check('service edit sends paise, not rupees', edit && edit.body.bw_price_paise === 250 && !('bw' in edit.body));

  // 7. Bad price: no request sent, clear message.
  await page.click(`button[data-edit="${SVC_DOC}"]`);
  await page.fill('#service-form input[name=bwPrice]', 'abc');
  const beforeBad = state.requests.length;
  await page.click('#service-form button[type=submit]');
  await waitText(page, 'Enter prices in rupees');
  check('invalid price is rejected before any request', state.requests.slice(beforeBad).every((r) => r.method !== 'PATCH'));

  // 8. Add a colour-only service.
  await page.click('[data-action="cancel-edit"]');
  await page.fill('#service-form input[name=name]', 'Spiral binding');
  await page.selectOption('#service-form select[name=pricingUnit]', 'per_copy');
  await page.fill('#service-form input[name=colourPrice]', '40');
  await page.click('#service-form button[type=submit]');
  await waitText(page, 'Service added.');
  const added = state.services.find((s) => s.name === 'Spiral binding');
  check('new colour-only service saved with paise', added && added.colour_price_paise === 4000 && added.bw_price_paise === null);
  check('new service is tied to this shop', added && added.shop_id === SHOP_ID);

  // 9. Shop name with HTML is shown as text, not markup.
  await page.fill('input[name=name]', 'Tom & <b>Jerry</b> <img src=x onerror="window.__xss=1">');
  await page.click('#details-form button[type=submit]');
  await waitText(page, 'Shop details saved.');
  check('shop name is escaped (no <b> or <img> rendered)', (await page.locator('#app b, #app img').count()) === 0);
  check('no script ran from the shop name', (await page.evaluate(() => window.__xss)) === undefined);

  // 9b. Orders: approve one, reject another after confirming, customer note shown as text.
  await page.click('a[href="#/owner/shop/demo-xerox/orders"]');
  await waitText(page, 'Page counts are what customers typed');
  check('orders page lists the two open orders', (await page.locator('.order-list > li.order').count()) === 2);
  check('order shows its tracking code', (await page.locator('.mono', { hasText: 'ABCD2345' }).count()) === 1);
  check(
    'customer note is shown as text, not markup',
    (await page.locator('#app i').count()) === 0 && (await page.getByText('<i>Please staple</i>').count()) === 1
  );
  await page.screenshot({ path: '/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/owner-orders-phone.png', fullPage: true });

  const beforeApprove = state.requests.length;
  await page.click('button[data-order-id="ord-1"][data-next="approved"]');
  await waitText(page, 'is now approved');
  const approve = state.requests
    .slice(beforeApprove)
    .find((r) => r.method === 'PATCH' && r.path.startsWith('/rest/v1/orders'));
  check(
    'approve sends only the new status, to one order in this shop, with the owner token',
    approve &&
      JSON.stringify(approve.body) === '{"status":"approved"}' &&
      approve.path.includes('id=eq.ord-1') &&
      approve.path.includes(`shop_id=eq.${SHOP_ID}`) &&
      approve.auth.startsWith('Bearer owner-token-'),
    approve?.path
  );
  check(
    'approved order offers the next steps, not reject',
    (await page.locator('button[data-order-id="ord-1"][data-next="printing"]').count()) === 1 &&
      (await page.locator('button[data-order-id="ord-1"][data-next="rejected"]').count()) === 0
  );

  const dialogsBeforeReject = dialogs.length;
  const requestsBeforeReject = state.requests.length;
  await page.click('button[data-order-id="ord-2"][data-next="rejected"]');
  await waitText(page, 'is now rejected');
  check(
    'rejecting asks for confirmation first',
    dialogs.length === dialogsBeforeReject + 1 && /cannot be undone/.test(dialogs[dialogs.length - 1]),
    dialogs[dialogs.length - 1]
  );
  const reject = state.requests
    .slice(requestsBeforeReject)
    .find((r) => r.method === 'PATCH' && r.path.includes('id=eq.ord-2'));
  check('reject sends only the new status', reject && JSON.stringify(reject.body) === '{"status":"rejected"}');
  check('the open list no longer shows the rejected order', (await page.locator('.order-list > li.order').count()) === 1);

  await page.click('[data-action="filter"][data-all="true"]');
  await page.locator('.order-list > li.order').nth(1).waitFor();
  check('all orders shows both orders', (await page.locator('.order-list > li.order').count()) === 2);
  check('a rejected order offers no buttons', (await page.locator('button[data-order-id="ord-2"]').count()) === 0);
  check('the rejected order shows its status', (await page.getByText('Rejected', { exact: true }).count()) === 1);

  // 10. Create a second shop.
  await page.evaluate(() => {
    location.hash = '#/owner/new';
  });
  await page.locator('#shop-form').waitFor();
  await page.fill('#shop-form input[name=name]', 'Second Copy Shop');
  await page.fill('#shop-form input[name=slug]', 'second-copy');
  await page.fill('#shop-form input[name=phone]', '+91 98765 11111');
  await page.click('#shop-form button[type=submit]');
  await waitText(page, 'Second Copy Shop');
  await page.locator('#service-form').waitFor();
  const created = state.requests.find((r) => r.path === '/rest/v1/rpc/create_shop');
  check('create shop sends slug and details to create_shop', created && created.body.p_slug === 'second-copy' && created.body.p_name === 'Second Copy Shop');
  check('new shop opens on its manager page', (await page.locator('input[readonly]').inputValue()).endsWith('#/s/second-copy'));

  // 11. Taken web address gives a clear message.
  await page.evaluate(() => {
    location.hash = '#/owner/new';
  });
  await page.locator('#shop-form').waitFor();
  await page.fill('#shop-form input[name=name]', 'Copycat Print');
  await page.fill('#shop-form input[name=slug]', 'demo-xerox');
  await page.click('#shop-form button[type=submit]');
  await waitText(page, 'already taken');
  check('duplicate web address shows a clear message', true);

  // 12. Customer page: no owner token is sent with customer requests.
  const beforeCustomer = state.requests.length;
  await page.evaluate(() => {
    location.hash = '#/s/demo-xerox';
  });
  await page.getByText('Add a print item', { exact: false }).first().waitFor();
  const customerCalls = state.requests.slice(beforeCustomer);
  check(
    'customer page sends no token',
    customerCalls.length > 0 && customerCalls.every((r) => r.auth === null),
    `${customerCalls.length} calls`
  );
  check('customer page hides the closed shop\'s ordering', (await page.locator('#item-form button[type=submit][disabled]').count()) === 1);

  // 13. Sign out clears the session.
  await page.evaluate(() => {
    location.hash = '#/owner';
  });
  await page.getByText('Your shops').first().waitFor();
  await page.click('[data-action="signout"]');
  await page.locator('#auth-form').waitFor();
  const afterSignOut = await page.evaluate(() => sessionStorage.getItem('printnest.owner.session'));
  check('sign out clears the stored session', afterSignOut === null);

  // 14. Layout: no horizontal scroll at phone width on the owner page.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal scroll at phone width', overflow <= 0, `overflow=${overflow}px`);

  // 15. No unexpected browser errors.
  check('no JavaScript errors in the browser', problems.length === 0, problems.join(' | '));

  await browser.close();
  console.log(`\n${results.length - failures} of ${results.length} checks passed.`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(2);
});
