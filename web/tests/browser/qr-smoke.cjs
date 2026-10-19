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

// ---- QR code checks: the on-screen code and the downloaded PNG must both scan ----
const fs = require('fs');
const DIR = '/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad';
const { execFileSync } = require('child_process');
const WEB = '/home/claude/printnest/web';
const configSource = fs.readFileSync(`${WEB}/config.js`, 'utf8');

function decode(file) {
  return execFileSync('python3', ['-I', `${DIR}/decode-qr.py`, file], { encoding: 'utf8' }).trim();
}

function wire(page, problems) {
  page.on('dialog', (dialog) => dialog.accept());
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !/favicon/i.test(text)) problems.push(`console: ${text}`);
  });
}

async function signIn(page) {
  await page.goto(`${BASE}#/owner`);
  await page.locator('#auth-form').waitFor();
  await page.fill('#auth-form input[name=email]', 'owner@example.com');
  await page.fill('#auth-form input[name=password]', 'correct-horse');
  await page.click('#auth-form button[type=submit]');
  await waitText(page, 'Demo Xerox Centre');
}

let browserRef = null;

async function scenario(label, { publicBase = null, expectUrl, expectBanner }) {
  const context = await browserRef.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const problems = [];
  wire(page, problems);
  await page.route(/supabase\.co/, handleSupabase);
  if (publicBase) {
    await page.route(/\/config\.js(\?.*)?$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: configSource.replace("publicBaseUrl: ''", `publicBaseUrl: '${publicBase}'`),
      })
    );
  }

  await signIn(page);
  await page.goto(`${BASE}#/owner/shop/demo-xerox`);
  await page.locator('[data-action="download-qr"]').waitFor();

  const shown = await page.locator('input[readonly]').inputValue();
  check(`${label}: address field shows the QR address`, shown === expectUrl, shown);

  const banners = await page.locator('.banner').allInnerTexts();
  const hasLocalWarning = banners.some((text) => /local address/.test(text));
  check(
    `${label}: warning shown only for a local address`,
    expectBanner ? hasLocalWarning : banners.length === 0,
    JSON.stringify(banners)
  );

  check(
    `${label}: code is drawn on the page`,
    (await page.locator('.qr-box svg rect').count()) === 1 && (await page.locator('.qr-box svg path').count()) === 1
  );

  const screenFile = `${DIR}/qr-${label}-screen.png`;
  await page.locator('.qr-box').screenshot({ path: screenFile });
  const screenText = decode(screenFile);
  check(`${label}: on-screen code scans to the shop address`, screenText === expectUrl, `decoded=${screenText}`);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="download-qr"]'),
  ]);
  check(
    `${label}: download is named for the shop`,
    download.suggestedFilename() === 'printnest-demo-xerox-qr.png',
    download.suggestedFilename()
  );
  const pngFile = `${DIR}/qr-${label}-download.png`;
  await download.saveAs(pngFile);
  const pngText = decode(pngFile);
  check(`${label}: downloaded PNG scans to the shop address`, pngText === expectUrl, `decoded=${pngText}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal scroll at phone width`, overflow <= 0, `overflow=${overflow}px`);
  await page.locator('.qr-box').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/qr-${label}-phone.png` });
  check(`${label}: no JavaScript errors`, problems.length === 0, problems.join(' | '));
  await context.close();
}

(async () => {
  browserRef = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    // A. Config left empty: the page's own address is used, and the owner is warned it is local.
    await scenario('local', {
      expectUrl: 'http://127.0.0.1:5173/#/s/demo-xerox',
      expectBanner: true,
    });
    // B. A published address set in config.js: the QR points there and no warning shows.
    await scenario('published', {
      publicBase: 'https://printnest.example/',
      expectUrl: 'https://printnest.example/#/s/demo-xerox',
      expectBanner: false,
    });
  } catch (err) {
    failures += 1;
    console.log(`FAIL  run stopped: ${err.message}`);
  } finally {
    await browserRef.close();
  }
  console.log(`\n${results.filter((r) => r.ok).length} of ${results.length} checks passed.`);
  process.exitCode = failures ? 1 : 0;
})();
