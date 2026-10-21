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

const fs = require('fs');
const DIR = '/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad';
const SVC_POSTER = 'cccccccc-0000-0000-0000-000000000009';

async function until(test, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const problems = [];
  page.on('dialog', (dialog) => dialog.accept());
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon/i.test(msg.text())) problems.push(`console: ${msg.text()}`);
  });
  await page.route(/supabase\.co/, handleSupabase);
  // Later routes win: serve the stored picture from the mock, not a 404.
  await page.route(/supabase\.co\/storage\/v1\/object\/public\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(`${DIR}/qr-local-download.png`) })
  );

  try {
    // ----- owner: sign in and open the shop -----
    await page.goto(`${BASE}#/owner`);
    await page.locator('#auth-form').waitFor();
    await page.fill('#auth-form input[name=email]', 'owner@example.com');
    await page.fill('#auth-form input[name=password]', 'correct-horse');
    await page.click('#auth-form button[type=submit]');
    await waitText(page, 'Demo Xerox Centre');
    await page.goto(`${BASE}#/owner/shop/demo-xerox`);
    await waitText(page, 'Printing features');

    // 1. Features show what the shop has saved.
    check('features card lists all 8 features', (await page.locator('#features-form input[name=feature]').count()) === 8);
    const startOn = await page.$$eval('#features-form input[name=feature]', (els) =>
      els.filter((el) => el.checked).map((el) => el.value).sort()
    );
    check('colour and double-sided start on, the rest off', JSON.stringify(startOn) === JSON.stringify(['colour_printing', 'double_sided']), JSON.stringify(startOn));

    // 2. Switch colour and double-sided off, stapling on, then save.
    const beforeSave = state.requests.length;
    await page.uncheck('#features-form input[value="colour_printing"]');
    await page.uncheck('#features-form input[value="double_sided"]');
    await page.check('#features-form input[value="stapling"]');
    await page.click('#features-form button[type=submit]');
    await waitText(page, 'Features saved');
    const save = state.requests.slice(beforeSave).find((r) => r.path === '/rest/v1/rpc/set_shop_features');
    check(
      'save sends every feature as yes or no',
      Boolean(save) && Object.keys(save.body.p_features).length === 8 && Object.values(save.body.p_features).every((v) => typeof v === 'boolean'),
      JSON.stringify(save?.body)
    );
    check('save carries the owner token and this shop', Boolean(save) && save.auth.startsWith('Bearer owner-token-') && save.body.p_shop_id === SHOP_ID);
    check(
      'colour and double-sided saved as no, stapling as yes',
      Boolean(save) && save.body.p_features.colour_printing === false && save.body.p_features.double_sided === false && save.body.p_features.stapling === true
    );

    // 3. Payment QR: none yet.
    check('no payment QR yet', (await page.getByText('No payment QR yet').count()) === 1);

    // 4. A text file is refused before any request is sent.
    const beforeBad = state.requests.length;
    await page.setInputFiles('#payment-qr-form input[name=qr]', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.click('#payment-qr-form button[type=submit]');
    await waitText(page, 'Upload a PNG or JPEG image.');
    check(
      'a text file is refused before any request',
      state.requests.slice(beforeBad).every((r) => !r.path.includes('set_payment_qr') && !r.path.startsWith('/storage')) && state.uploads.length === 0
    );

    // 5. A PNG goes into the shop's own folder and is attached to the shop.
    const picture = fs.readFileSync(`${DIR}/qr-local-download.png`);
    await page.setInputFiles('#payment-qr-form input[name=qr]', { name: 'upi.png', mimeType: 'image/png', buffer: picture });
    await page.click('#payment-qr-form button[type=submit]');
    await waitText(page, 'Payment QR saved');
    const first = state.uploads.at(-1);
    check(
      'upload goes to the shop folder with a payment-qr name',
      Boolean(first) && new RegExp(`^${SHOP_ID}/payment-qr-[0-9a-f]{8}\\.png$`).test(first),
      first
    );
    const attach = state.requests.filter((r) => r.path === '/rest/v1/rpc/set_payment_qr').at(-1);
    check('the uploaded file is attached to this shop', Boolean(attach) && attach.body.p_path === first && attach.body.p_shop_id === SHOP_ID, JSON.stringify(attach?.body));
    const preview = await page.locator('img.payment-qr-preview').getAttribute('src');
    check('the owner sees the saved picture', Boolean(preview) && preview.endsWith(first), preview);

    // 6. Replacing the picture removes the old file.
    await page.setInputFiles('#payment-qr-form input[name=qr]', { name: 'upi.png', mimeType: 'image/png', buffer: picture });
    await page.click('#payment-qr-form button[type=submit]');
    const replaced = await until(() => state.deletes.includes(first));
    const second = state.uploads.at(-1);
    check('replacing uploads a new file name', second !== first, second);
    check('the old picture is removed once the new one is attached', replaced, state.deletes.join(','));

    // 7. Customer page: features, payment QR, and the colour and double-sided switches.
    state.services.push({
      id: SVC_POSTER,
      shop_id: SHOP_ID,
      name: 'Colour posters',
      pricing_unit: 'per_copy',
      bw_price_paise: null,
      colour_price_paise: 1500,
      is_active: true,
    });
    await page.goto(`${BASE}#/s/demo-xerox`);
    await page.locator('#service-select').waitFor();
    const offered = await page.locator('p', { hasText: 'Also offered here' }).innerText();
    check(
      'customer page lists the features that are on',
      offered.includes('Stapling') && !offered.includes('Photocopy') && !offered.includes('Colour printing') && !offered.includes('Double-sided'),
      offered
    );
    check('customer page shows the payment QR', (await page.locator('img.payment-qr-preview').count()) === 1);
    const footer = await page.locator('p', { hasText: 'PrintNest does not take any payment' }).count();
    check('footer explains the payment QR', footer === 1);

    await page.selectOption('#service-select', SVC_DOC);
    check('colour is greyed out when the shop has colour switched off', (await page.locator('#colour').isDisabled()) === true);
    check('double-sided is greyed out when the shop has it switched off', (await page.locator('#duplex').isDisabled()) === true);
    check(
      'the greyed-out boxes say why',
      (await page.locator('label', { hasText: 'Double-sided (not offered at this shop)' }).count()) === 1
    );

    await page.selectOption('#service-select', { label: 'Colour posters' });
    const hint = await page.locator('#service-hint').innerText();
    check('a colour-only service says it cannot be ordered', hint.includes('cannot be ordered'), hint);
    check('add to order stays off for a colour-only service', (await page.locator('#add-item').isDisabled()) === true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('customer page has no horizontal scroll at phone width', overflow <= 0, `overflow=${overflow}px`);
    await page.screenshot({ path: `${DIR}/customer-features-phone.png`, fullPage: true });

    // 8. Owner removes the payment QR; the customer page stops showing it.
    await page.goto(`${BASE}#/owner/shop/demo-xerox`);
    await waitText(page, 'Printing features');
    await page.click('[data-action="remove-payment-qr"]');
    const removed = await until(() => state.requests.some((r) => r.path === '/rest/v1/rpc/set_payment_qr' && r.body.p_path === null));
    check('remove sends a null payment QR path', removed);
    await waitText(page, 'No payment QR yet');
    await page.goto(`${BASE}#/s/demo-xerox`);
    await page.locator('#service-select').waitFor();
    check('customer page hides the payment QR after removal', (await page.locator('img.payment-qr-preview').count()) === 0);

    check('no JavaScript errors in the browser', problems.length === 0, problems.join(' | '));
  } catch (err) {
    failures += 1;
    console.log(`FAIL  run stopped: ${err.message}`);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.filter((r) => r.ok).length} of ${results.length} checks passed.`);
  process.exitCode = failures ? 1 : 0;
})();
