import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  bucketLabel,
  cancelReasonLabel,
  changeText,
  checkRange,
  comparisonRange,
  csvCell,
  dailyReportCsv,
  describeActivity,
  groupDays,
  istToday,
  monthEnd,
  nextPaymentActions,
  ordersCsv,
  paymentLabel,
  percentChange,
  presetRange,
  toCsv,
  weekStart,
  yearEnd,
} from '../src/logic.js';
import { createOwnerApi } from '../src/owner-api.js';

// 2001-03-05 is a Monday. These dates are used throughout, so the expected values are easy to check.

test('istToday uses the calendar day in India, not the device time zone', () => {
  // 20:00 UTC on 4 March is 01:30 on 5 March in India.
  assert.equal(istToday(new Date('2001-03-04T20:00:00Z')), '2001-03-05');
  // 18:20 UTC on 4 March is still 4 March in India (23:50).
  assert.equal(istToday(new Date('2001-03-04T18:20:00Z')), '2001-03-04');
});

test('addDays moves across month ends and leap days', () => {
  assert.equal(addDays('2001-02-28', 1), '2001-03-01');
  assert.equal(addDays('2000-02-28', 1), '2000-02-29');
  assert.equal(addDays('2001-03-01', -1), '2001-02-28');
});

test('weeks start on Monday and month or year ends are correct', () => {
  assert.equal(weekStart('2001-03-11'), '2001-03-05'); // Sunday belongs to the week that began the Monday before
  assert.equal(weekStart('2001-03-05'), '2001-03-05');
  assert.equal(monthEnd('2000-02-10'), '2000-02-29');
  assert.equal(yearEnd('2026-05-01'), '2026-12-31');
});

test('presets run from the start of the period up to today', () => {
  assert.deepEqual(presetRange('today', '2001-03-11'), { from: '2001-03-11', to: '2001-03-11' });
  assert.deepEqual(presetRange('week', '2001-03-11'), { from: '2001-03-05', to: '2001-03-11' });
  assert.deepEqual(presetRange('month', '2001-03-11'), { from: '2001-03-01', to: '2001-03-11' });
  assert.deepEqual(presetRange('year', '2001-03-11'), { from: '2001-01-01', to: '2001-03-11' });
  assert.throws(() => presetRange('custom', '2001-03-11'));
});

test('comparisons use the same length in the same place in the calendar', () => {
  // This week (Mon-Sun) against last week.
  assert.deepEqual(comparisonRange('week', '2001-03-05', '2001-03-11'), { from: '2001-02-26', to: '2001-03-04' });
  // Today against yesterday.
  assert.deepEqual(comparisonRange('today', '2001-03-05', '2001-03-05'), { from: '2001-03-04', to: '2001-03-04' });
  // This month, 18 days in, against the first 18 days of last month.
  assert.deepEqual(comparisonRange('month', '2001-03-01', '2001-03-18'), { from: '2001-02-01', to: '2001-02-18' });
  // A 31-day month against February: cut short at the end of February.
  assert.deepEqual(comparisonRange('month', '2001-03-01', '2001-03-31'), { from: '2001-02-01', to: '2001-02-28' });
  // This year, 291 days in, against the same days of last year.
  assert.deepEqual(comparisonRange('year', '2026-01-01', '2026-10-18'), { from: '2025-01-01', to: '2025-10-18' });
  // A custom range is compared with the days straight before it.
  assert.deepEqual(comparisonRange('custom', '2001-03-05', '2001-03-07'), { from: '2001-03-02', to: '2001-03-04' });
});

test('custom ranges are checked the same way the database checks them', () => {
  assert.equal(checkRange('2001-03-05', '2001-03-05'), null);
  assert.equal(checkRange('2001-03-10', '2001-03-05'), 'The end date is before the start date.');
  assert.equal(checkRange('2001-01-01', '2003-06-01'), 'Choose a range of 800 days or less.');
  assert.equal(checkRange('2001-02-30', '2001-03-01'), 'Choose a start date and an end date.');
  assert.equal(checkRange('', '2001-03-01'), 'Choose a start date and an end date.');
});

test('percentage changes and their wording', () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(90, 100), -10);
  assert.equal(percentChange(5, 0), null);
  assert.equal(changeText(120, 100), 'Up 20% from the previous period');
  assert.equal(changeText(90, 100), 'Down 10% from the previous period');
  assert.equal(changeText(100, 100), 'Same as the previous period');
  assert.equal(changeText(5, 0), 'New compared with the previous period');
  assert.equal(changeText(0, 0), 'Nothing in the previous period');
});

// A daily row as shop_stats_daily returns it.
function day(date, extra = {}) {
  return {
    date,
    orders: 0,
    order_value_paise: 0,
    completed: 0,
    completed_paise: 0,
    stopped: 0,
    earned_orders: 0,
    earned_paise: 0,
    refunds_paise: 0,
    ...extra,
  };
}

test('daily rows group into days, weeks, months and years', () => {
  const rows = [
    day('2001-03-05', { orders: 1, earned_paise: 1000, earned_orders: 1 }),
    day('2001-03-09', { orders: 2, earned_paise: 1200, earned_orders: 1, refunds_paise: 800 }),
    day('2001-03-11', { orders: 1, earned_paise: 200 }),
    day('2001-04-02', { orders: 1, earned_paise: 500, earned_orders: 1 }),
  ];

  const byWeek = groupDays(rows, 'week');
  assert.equal(byWeek.length, 2); // Mon 5 to Sun 11 March, then the week of 2 April
  assert.equal(byWeek[0].earnedPaise, 2400);
  assert.equal(byWeek[0].refundsPaise, 800);
  assert.equal(bucketLabel(byWeek[0], 'week'), '5 Mar 2001 – 11 Mar 2001');

  const byMonth = groupDays(rows, 'month');
  assert.equal(byMonth.length, 2);
  assert.match(bucketLabel(byMonth[0], 'month'), /Mar 2001/);
  assert.match(bucketLabel(byMonth[1], 'month'), /Apr 2001/);
  assert.equal(byMonth[0].orders, 4);

  const byYear = groupDays(rows, 'year');
  assert.equal(byYear.length, 1);
  assert.equal(bucketLabel(byYear[0], 'year'), '2001');
  assert.equal(byYear[0].earnedPaise, 2900);
  assert.equal(byYear[0].earnedOrders, 3);
});

test('CSV cells are escaped and cannot start a spreadsheet formula', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(42), '42');
  assert.equal(toCsv([['a', 'b'], ['1,5', 'x']]), 'a,b\r\n"1,5",x\r\n');
});

test('the daily report puts money in rupees with two decimals', () => {
  const csv = dailyReportCsv([
    day('2001-03-05', { orders: 1, order_value_paise: 1000, completed: 1, earned_paise: 1000, earned_orders: 1 }),
  ]);
  const [header, row] = csv.trim().split('\r\n');
  assert.equal(
    header,
    'Date (IST),Orders placed,Order value (INR),Completed,Net earnings (INR),Net orders,Refunds (INR),Cancelled or rejected'
  );
  assert.equal(row, '2001-03-05,1,10.00,1,10.00,1,0.00,0');
});

test('the orders export shows India times and the payment details', () => {
  const csv = ordersCsv([
    {
      tracking_code: 'ABC123',
      status: 'completed',
      total_paise: 1000,
      created_at: '2001-03-04T20:00:00Z', // 01:30 on 5 March in India
      payment_status: 'paid',
      payment_channel: 'cash',
      paid_at: '2001-03-04T20:05:00Z',
      refunded_at: null,
      refund_paise: null,
      cancel_reason: null,
      order_items: [
        { service_name: 'Document printing', pricing_unit: 'per_side', page_count: 4, copies: 2, colour: false, duplex: false, amount_paise: 1000 },
      ],
    },
  ]);
  assert.ok(csv.includes('ABC123,2001-03-05 01:30,completed,10.00,paid,cash,2001-03-05 01:35'));
  assert.match(csv, /Document printing · 4 pages × 2 copies · B&W, single-sided/);
});

test('payment buttons follow the database rules', () => {
  const labels = (order) => nextPaymentActions(order).map((step) => step.label);

  assert.deepEqual(labels({ status: 'approved', payment_status: 'unpaid' }), [
    'Mark paid in cash',
    'Mark paid online',
    'Online payment pending',
  ]);
  // A cancelled or rejected order cannot take a new payment.
  assert.deepEqual(labels({ status: 'cancelled', payment_status: 'unpaid' }), []);
  // A paid order can always be refunded, even after it was rejected.
  assert.deepEqual(labels({ status: 'rejected', payment_status: 'paid' }), ['Record refund']);
  // A pending online payment can be confirmed or cleared while the order is open.
  assert.ok(labels({ status: 'printing', payment_status: 'pending' }).includes('Confirm online payment'));
  assert.ok(labels({ status: 'cancelled', payment_status: 'pending' }).includes('Clear pending payment'));
  assert.ok(!labels({ status: 'cancelled', payment_status: 'pending' }).includes('Confirm online payment'));
});

test('payment and reason labels read well and fall back safely', () => {
  assert.equal(paymentLabel({ payment_status: 'paid', payment_channel: 'cash' }), 'Paid in cash');
  assert.equal(paymentLabel({ payment_status: 'paid', payment_channel: 'online' }), 'Paid online');
  assert.equal(paymentLabel({ payment_status: 'refunded', refund_paise: 800 }), 'Refunded ₹8.00');
  assert.equal(paymentLabel({ payment_status: 'unpaid' }), 'Not paid yet');
  assert.equal(cancelReasonLabel('file_problem'), 'Problem with the file');
  assert.equal(cancelReasonLabel('not_given'), 'Reason not recorded');
  assert.equal(cancelReasonLabel('something-new'), 'Other');
});

test('activity lines describe each kind of change', () => {
  assert.equal(describeActivity({ kind: 'created', amount_paise: 1200 }), 'Order placed (₹12.00)');
  assert.equal(describeActivity({ kind: 'status', from: 'pending', to: 'approved' }), 'Status: Waiting for approval → Approved');
  assert.equal(describeActivity({ kind: 'payment', to: 'paid', detail: 'cash' }), 'Marked paid in cash');
  assert.equal(describeActivity({ kind: 'payment', to: 'unpaid', detail: null }), 'Payment cleared');
  assert.equal(describeActivity({ kind: 'refund', amount_paise: 500 }), 'Refund recorded: ₹5.00');
});

// ---------- the statistics calls in owner-api ----------

const config = { supabaseUrl: 'https://example-project.supabase.co', publishableKey: 'sb_publishable_TEST' };
const signedIn = {
  getSession: async () => ({ access_token: 'owner-token', expires_at: 9e9, user: { id: 'owner-1' } }),
};

function fakeFetch(bodyFor) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const body = typeof bodyFor === 'function' ? bodyFor(url) : bodyFor;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

test('statistics are requested with the shop and the dates, as the owner', async () => {
  const { calls, fetchImpl } = fakeFetch({ orders: { total: 7 } });
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const summary = await api.statsSummary('shop-1', '2001-03-05', '2001-03-11');

  assert.equal(summary.orders.total, 7);
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/shop_stats_summary');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer owner-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_shop_id: 'shop-1', p_from: '2001-03-05', p_to: '2001-03-11' });
});

test('payments and cancel reasons send only the fields the database function takes', async () => {
  const { calls, fetchImpl } = fakeFetch({ id: 'order-1', payment_status: 'paid' });
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await api.setOrderPayment('order-1', 'set_paid', 'cash');
  await api.setOrderPayment('order-1', 'set_unpaid');
  await api.setCancelReason('order-1', 'out_of_stock');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/set_order_payment');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_order_id: 'order-1', p_action: 'set_paid', p_channel: 'cash' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { p_order_id: 'order-1', p_action: 'set_unpaid', p_channel: null });
  assert.equal(calls[2].url, 'https://example-project.supabase.co/rest/v1/rpc/set_cancel_reason');
  assert.deepEqual(JSON.parse(calls[2].init.body), { p_order_id: 'order-1', p_reason: 'out_of_stock' });
});

test('the export reads every page of the period, with India-time bounds', async () => {
  const fullPage = (tag) => Array.from({ length: 1000 }, (_, i) => ({ tracking_code: `${tag}${i}` }));
  const { calls, fetchImpl } = fakeFetch((url) => (new URL(url).searchParams.get('offset') === '0' ? fullPage('A') : [{ tracking_code: 'LAST' }]));
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const rows = await api.listOrdersBetween('shop-1', '2001-03-05T00:00:00+05:30', '2001-03-12T00:00:00+05:30');

  assert.equal(rows.length, 1001);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /created_at=gte\.2001-03-05T00%3A00%3A00%2B05%3A30/);
  assert.match(calls[0].url, /created_at=lt\.2001-03-12T00%3A00%3A00%2B05%3A30/);
  assert.match(calls[1].url, /offset=1000/);
});

test('an export that would be cut short is refused, not truncated', async () => {
  const fullPage = Array.from({ length: 1000 }, (_, i) => ({ tracking_code: `T${i}` }));
  const { calls, fetchImpl } = fakeFetch(fullPage);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await assert.rejects(
    api.listOrdersBetween('shop-1', '2001-01-01T00:00:00+05:30', '2003-01-01T00:00:00+05:30'),
    (err) => err.status === 413 && /shorter period/.test(err.message)
  );
  assert.equal(calls.length, 50);
});
