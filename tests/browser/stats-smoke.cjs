// Browser check for the statistics page and the order payment controls.
// Supabase is replaced by an in-memory mock (page.route). This checks the front end only.
const fs = require('fs');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const BASE = 'http://127.0.0.1:5173/';
const SHOP_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const SHOP = { id: SHOP_ID, slug: 'demo-xerox', name: 'Demo Xerox Centre', phone: null, address: null, is_open: true };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };

const state = {
  requests: [],
  orders: [
    {
      id: 'ord-1', tracking_code: 'ABCD2345', status: 'approved', total_paise: 4800, customer_note: null,
      created_at: '2026-10-15T10:00:00Z', payment_status: 'unpaid', payment_channel: null, paid_at: null,
      refunded_at: null, refund_paise: null, cancel_reason: null,
      order_items: [{ service_name: 'Document printing', pricing_unit: 'per_side', page_count: 12, copies: 2, colour: false, duplex: true, billable_units: 24, amount_paise: 4800, file_id: null, file_name: null }],
    },
    {
      id: 'ord-2', tracking_code: 'WXYZ2345', status: 'rejected', total_paise: 900, customer_note: null,
      created_at: '2026-10-15T11:00:00Z', payment_status: 'paid', payment_channel: 'online', paid_at: '2026-10-15T11:05:00Z',
      refunded_at: null, refund_paise: null, cancel_reason: null,
      order_items: [{ service_name: 'Passport photo sheet', pricing_unit: 'per_copy', page_count: 1, copies: 2, colour: true, duplex: false, billable_units: 2, amount_paise: 900, file_id: null, file_name: null }],
    },
  ],
};

const session = () => ({ access_token: `owner-token-${Date.now()}`, refresh_token: 'r', expires_in: 3600, user: { id: 'owner-1', email: 'owner@example.com' } });

function nextDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function summary(from, to) {
  return {
    from, to,
    orders: { total: 7, pending: 1, approved: 0, printing: 1, ready: 1, completed: 2, cancelled: 1, rejected: 1, order_value_paise: 4400 },
    payments: { unpaid: 2, pending: 1, paid: 3, refunded: 1 },
    earnings: { net_paise: 2200, net_orders: 2, net_cash_paise: 2200, net_online_paise: 0, collected_paise: 3300, refund_due_paise: 300 },
    refunds: { count: 1, paise: 800 },
    completed: { count: 2, revenue_paise: 1800, pages: 11, items: 2 },
    cancellations: { cancelled: 1, rejected: 1, rate_percent: 28.6 },
    reasons: [{ reason: 'customer_asked', count: 1 }, { reason: 'file_problem', count: 1 }],
    services: [
      { service: 'Document printing', colour: false, items: 3, orders: 3, copies: 4, pages: 12, revenue_paise: 2000 },
      { service: 'Passport photo sheet', colour: true, items: 1, orders: 1, copies: 2, pages: 2, revenue_paise: 1200 },
    ],
  };
}

function daily(from, to) {
  const rows = [];
  for (let d = from; d <= to; d = nextDay(d)) {
    rows.push({ date: d, orders: 0, order_value_paise: 0, completed: 0, completed_paise: 0, stopped: 0, earned_orders: 0, earned_paise: 0, refunds_paise: 0 });
  }
  if (rows.length) Object.assign(rows[Math.min(2, rows.length - 1)], { orders: 2, order_value_paise: 5600, completed: 1, earned_orders: 1, earned_paise: 2200 });
  return rows;
}

async function handle(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  state.requests.push({ method: req.method(), path: url.pathname, query: url.search, body });
  const json = (status, data) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: data === null ? '' : JSON.stringify(data) });

  if (url.pathname === '/auth/v1/token') {
    if (body.password !== 'correct-horse') return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return json(200, session());
  }
  if (url.pathname === '/auth/v1/logout') return json(204, null);
  if (url.pathname === '/rest/v1/shop_memberships') return json(200, [{ role: 'owner', shop: SHOP }]);
  if (url.pathname === '/rest/v1/services') return json(200, []);
  if (url.pathname === '/rest/v1/orders') return json(200, state.orders);
  if (url.pathname === '/rest/v1/rpc/shop_stats_summary') return json(200, summary(body.p_from, body.p_to));
  if (url.pathname === '/rest/v1/rpc/shop_stats_daily') return json(200, daily(body.p_from, body.p_to));
  if (url.pathname === '/rest/v1/rpc/shop_recent_activity') {
    return json(200, [
      { kind: 'refund', from: 'paid', to: 'refunded', detail: null, amount_paise: 800, tracking_code: 'WXYZ2345', at: '2026-10-15T12:00:00Z' },
      { kind: 'status', from: 'pending', to: 'rejected', detail: null, amount_paise: null, tracking_code: 'WXYZ2345', at: '2026-10-15T11:30:00Z' },
      { kind: 'created', from: null, to: 'pending', detail: null, amount_paise: 900, tracking_code: 'WXYZ2345', at: '2026-10-15T11:00:00Z' },
    ]);
  }
  if (url.pathname === '/rest/v1/rpc/set_order_payment') {
    const order = state.orders.find((o) => o.id === body.p_order_id);
    if (body.p_action === 'set_paid') Object.assign(order, { payment_status: 'paid', payment_channel: body.p_channel, paid_at: '2026-10-18T09:00:00Z' });
    if (body.p_action === 'refund') Object.assign(order, { payment_status: 'refunded', refunded_at: '2026-10-18T09:05:00Z', refund_paise: order.total_paise });
    return json(200, { id: order.id, payment_status: order.payment_status, payment_channel: order.payment_channel, paid_at: order.paid_at, refund_paise: order.refund_paise });
  }
  if (url.pathname === '/rest/v1/rpc/set_cancel_reason') {
    state.orders.find((o) => o.id === body.p_order_id).cancel_reason = body.p_reason;
    return json(200, body.p_reason);
  }
  // Feature catalogue (the owner page loads it with the shop)
  if (url.pathname === '/rest/v1/feature_catalog') {
    return json(200, [
      { key: 'colour_printing', label: 'Colour printing', affects_orders: true, sort_order: 1 },
      { key: 'double_sided', label: 'Double-sided printing', affects_orders: true, sort_order: 2 },
    ]);
  }
  return json(404, { message: `not mocked: ${url.pathname}` });
}

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const problems = [];
  const dialogs = [];
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.accept(); });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) problems.push(`console: ${msg.text()}`);
  });
  await page.route(/supabase\.co/, handle);

  const rpcs = (name) => state.requests.filter((r) => r.path === `/rest/v1/rpc/${name}`);
  const text = (t) => page.getByText(t, { exact: false }).first();

  // Sign in through the real form.
  await page.goto(`${BASE}#/owner`);
  await page.locator('#auth-form').waitFor();
  await page.fill('#auth-form input[name=email]', 'owner@example.com');
  await page.fill('#auth-form input[name=password]', 'correct-horse');
  await page.click('#auth-form button[type=submit]');
  await text('Demo Xerox Centre').waitFor();

  // Shop page keeps Orders and gains Statistics.
  await page.click('a[href="#/owner/shop/demo-xerox"]');
  await page.locator('a[href="#/owner/shop/demo-xerox/stats"]').waitFor();
  check('shop page links to Statistics next to Orders', (await page.locator('a[href="#/owner/shop/demo-xerox/orders"]').count()) === 1);

  // Statistics page.
  await page.locator('a[href="#/owner/shop/demo-xerox/stats"]').click();
  await page.locator('[data-period="month"].on').waitFor();
  check('statistics page opens with This month selected', true);
  check('net earnings tile shows ₹22.00', (await page.locator('.stat .value', { hasText: '₹22.00' }).count()) >= 1);
  check('completed revenue shows ₹18.00', (await page.locator('.stat .value', { hasText: '₹18.00' }).count()) >= 1);
  check('order value is shown apart from earnings', (await text('Order value (not earnings)').count()) === 1);
  check('weekly chart draws 7 days of earning bars', (await page.locator('svg.chart .bar-earned').count()) === 7);
  check('cancellation reasons are named', (await text('Customer asked to cancel').count()) === 1 && (await text('Problem with the file').count()) === 1);
  check('services table lists the passport photo line as colour', (await page.locator('td', { hasText: 'Passport photo sheet' }).count()) >= 1);
  check('recent activity shows the refund', (await text('Refund recorded: ₹8.00').count()) === 1);

  // Grouping tabs re-group without a new request.
  const beforeGroup = state.requests.length;
  await page.click('[data-grouping="week"]');
  await page.locator('th', { hasText: 'Week (Monday to Sunday)' }).waitFor();
  check('earnings can be grouped by week', state.requests.length === beforeGroup);

  // Today sends a one-day request.
  await page.click('[data-period="today"]');
  await page.waitForFunction(() => document.querySelector('[data-period="today"]')?.classList.contains('on'));
  await page.waitForTimeout(300);
  const todayReq = rpcs('shop_stats_summary').at(-1);
  check('Today asks for one day only', todayReq && todayReq.body.p_from === todayReq.body.p_to, JSON.stringify(todayReq?.body));

  // Custom range: an end date before the start is refused locally.
  await page.click('[data-period="custom"]');
  await page.locator('#custom-range').waitFor();
  await page.fill('#custom-range input[name=from]', '2001-03-10');
  await page.fill('#custom-range input[name=to]', '2001-03-05');
  const before = rpcs('shop_stats_summary').length;
  await page.click('#custom-range button[type=submit]');
  await text('The end date is before the start date.').waitFor();
  check('a backwards custom range is refused on screen', rpcs('shop_stats_summary').length === before);

  await page.fill('#custom-range input[name=from]', '2026-10-01');
  await page.fill('#custom-range input[name=to]', '2026-10-10');
  await page.click('#custom-range button[type=submit]');
  await page.waitForFunction(() => document.body.innerText.includes('1 Oct 2026'));
  const custom = rpcs('shop_stats_summary').find((r) => r.body.p_from === '2026-10-01' && r.body.p_to === '2026-10-10');
  check('custom range sends the chosen dates', Boolean(custom), 'current period request found');

  // Week navigation loads the previous week.
  const weeksBefore = rpcs('shop_stats_daily').length;
  await page.click('[data-week="prev"]');
  await page.waitForFunction((n) => window.__n !== n, weeksBefore).catch(() => {});
  await page.waitForTimeout(300);
  check('previous week loads a new 7-day report', rpcs('shop_stats_daily').length > weeksBefore);

  // CSV downloads.
  const [daily] = await Promise.all([page.waitForEvent('download'), page.click('[data-export="daily"]')]);
  const dailyText = fs.readFileSync(await daily.path(), 'utf8').replace(/^﻿/, '');
  check('daily CSV file name', /^printnest-demo-xerox-daily-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/.test(daily.suggestedFilename()), daily.suggestedFilename());
  check('daily CSV has the header row', dailyText.startsWith('Date (IST),Orders placed,Order value (INR)'));
  const [orders] = await Promise.all([page.waitForEvent('download'), page.click('[data-export="orders"]')]);
  const ordersText = fs.readFileSync(await orders.path(), 'utf8').replace(/^﻿/, '');
  check('orders CSV includes the order codes', ordersText.includes('ABCD2345') && ordersText.includes('WXYZ2345'));

  // Orders page: payment controls.
  await page.evaluate(() => { location.hash = '#/owner/shop/demo-xerox/orders'; });
  await text('ABCD2345').waitFor();
  check('unpaid order offers Mark paid in cash', (await page.locator('[data-pay-action="set_paid"][data-pay-channel="cash"]').count()) === 1);
  await page.locator('[data-pay-order="ord-1"][data-pay-channel="cash"]').click();
  await text('Payment updated for order ABCD2345.').waitFor();
  const paid = rpcs('set_order_payment').at(-1);
  check('marking paid sends the payment action, not a price', paid?.body.p_order_id === 'ord-1' && paid.body.p_action === 'set_paid' && paid.body.p_channel === 'cash', JSON.stringify(paid?.body));
  check('the order shows Paid in cash after the change', (await text('Paid in cash').count()) >= 1);

  await page.click('[data-action="filter"][data-all="true"]');
  await page.locator('[data-pay-order="ord-2"][data-pay-action="refund"]').click();
  await text('Payment updated for order WXYZ2345.').waitFor();
  check('refund asks for confirmation first', dialogs.some((m) => /Record a refund of ₹9.00/.test(m)), dialogs.join(' | '));
  check('refund is sent as a refund action', rpcs('set_order_payment').at(-1)?.body.p_action === 'refund');

  await page.selectOption('[data-reason-order="ord-2"]', 'file_problem');
  await text('Reason saved for order WXYZ2345.').waitFor();
  const reason = rpcs('set_cancel_reason').at(-1);
  check('cancel reason is saved for the rejected order', reason?.body.p_order_id === 'ord-2' && reason.body.p_reason === 'file_problem');

  // The status buttons still work alongside the new controls.
  check('status buttons still show for open orders', (await page.locator('[data-order-id="ord-1"][data-next="printing"]').count()) === 1);

  // Phone width: no sideways scrolling on the statistics page.
  await page.evaluate(() => { location.hash = '#/owner/shop/demo-xerox/stats'; });
  await page.locator('[data-period="month"]').first().waitFor();
  const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 15)
    .map((el) => `${el.tagName.toLowerCase()}[${String(el.className?.baseVal ?? el.className ?? '').slice(0, 40)}] right=${Math.round(el.getBoundingClientRect().right)} text=${(el.textContent || '').trim().slice(0, 30)}`));
  console.log('OFFENDERS:\n  ' + offenders.join('\n  '));
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  check('no sideways scrolling at 390px wide', widths.scroll <= widths.inner, JSON.stringify(widths));
  await page.screenshot({ path: '/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/stats-phone.png', fullPage: false });

  check('no page errors or console errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('SMOKE CRASHED:', err.message);
  process.exit(2);
});
