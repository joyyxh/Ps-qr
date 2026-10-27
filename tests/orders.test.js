import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeOrderItem,
  isIrreversibleMove,
  isOpenOrder,
  nextOrderStatuses,
  orderActionLabel,
  ownerStatusLabel,
} from '../src/logic.js';
import { createOwnerApi } from '../src/owner-api.js';

// The moves the database allows (guard_order_changes in migration 0001).
const DB_MOVES = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['printing', 'ready', 'completed', 'cancelled'],
  printing: ['ready', 'completed'],
  ready: ['completed'],
};

const RANK = { pending: 0, approved: 1, printing: 2, ready: 3, completed: 4 };

test('the buttons offered match the moves the database allows', () => {
  for (const [from, targets] of Object.entries(DB_MOVES)) {
    assert.deepEqual([...nextOrderStatuses(from)].sort(), [...targets].sort(), from);
  }
});

test('finished orders offer no buttons', () => {
  for (const status of ['completed', 'rejected', 'cancelled', 'not-a-status']) {
    assert.deepEqual(nextOrderStatuses(status), [], status);
  }
});

test('no button moves an order backwards', () => {
  for (const [from, targets] of Object.entries(DB_MOVES)) {
    for (const to of targets) {
      if (isIrreversibleMove(to)) continue;
      assert.ok(RANK[to] > RANK[from], `${from} -> ${to} must move forward`);
    }
  }
});

test('every offered button has a readable label', () => {
  for (const targets of Object.values(DB_MOVES)) {
    for (const to of targets) {
      assert.notEqual(orderActionLabel(to), to, `label for ${to}`);
    }
  }
});

test('only rejecting and cancelling need a confirmation', () => {
  assert.equal(isIrreversibleMove('rejected'), true);
  assert.equal(isIrreversibleMove('cancelled'), true);
  for (const to of ['approved', 'printing', 'ready', 'completed']) {
    assert.equal(isIrreversibleMove(to), false, to);
  }
});

test('open orders are the ones still waiting for the shop', () => {
  assert.equal(isOpenOrder('pending'), true);
  assert.equal(isOpenOrder('ready'), true);
  assert.equal(isOpenOrder('completed'), false);
  assert.equal(isOpenOrder('rejected'), false);
});

test('owner status labels are short and never fall back to the raw code for known statuses', () => {
  assert.equal(ownerStatusLabel('pending'), 'Waiting for approval');
  assert.equal(ownerStatusLabel('ready'), 'Ready for collection');
  assert.equal(ownerStatusLabel('mystery'), 'mystery');
});

test('describeOrderItem reads like a print ticket', () => {
  assert.equal(
    describeOrderItem({
      service_name: 'Document printing',
      page_count: 12,
      copies: 2,
      colour: false,
      duplex: true,
    }),
    'Document printing · 12 pages × 2 copies · B&W, double-sided'
  );
  assert.equal(
    describeOrderItem({
      service_name: 'Passport photo sheet',
      page_count: 1,
      copies: 1,
      colour: true,
      duplex: false,
    }),
    'Passport photo sheet · 1 page × 1 copy · colour, single-sided'
  );
});

// ----- order requests -----

const config = {
  supabaseUrl: 'https://example-project.supabase.co/',
  publishableKey: 'sb_publishable_TEST',
};
const signedIn = {
  getSession: async () => ({
    access_token: 'owner-token',
    refresh_token: 'refresh',
    expires_at: 9e9,
    user: { id: 'owner-1', email: 'owner@example.com' },
  }),
};

function fakeFetch(responseBody, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('listOrders reads the shop orders with their items, newest first', async () => {
  const { calls, fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  await api.listOrders('shop-1');

  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer owner-token');
  assert.match(calls[0].url, /\/rest\/v1\/orders\?shop_id=eq\.shop-1&select=/);
  assert.match(calls[0].url, /order_items\(id,service_name,/);
  assert.match(calls[0].url, /order=created_at\.desc&limit=100$/);
});

test('updateOrderStatus sends only the status, to one order in one shop', async () => {
  const { calls, fetchImpl } = fakeFetch([{ id: 'order-1', status: 'approved' }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const updated = await api.updateOrderStatus('shop-1', 'order-1', 'approved');

  assert.equal(updated.status, 'approved');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/orders?id=eq.order-1&shop_id=eq.shop-1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { status: 'approved' });
});

test('updateOrderStatus reports no permission when no order was changed', async () => {
  const { fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await assert.rejects(api.updateOrderStatus('shop-1', 'order-x', 'approved'), (err) => err.status === 403);
});

test('a refused status change keeps its database code so the page can explain it', async () => {
  const { fetchImpl } = fakeFetch(
    { code: '22023', message: 'invalid order status change from pending to completed' },
    400
  );
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await assert.rejects(api.updateOrderStatus('shop-1', 'order-1', 'completed'), (err) => {
    assert.equal(err.code, '22023');
    return true;
  });
});

test('listOrders also asks for each item’s file, so the owner can open it', async () => {
  const { calls, fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  await api.listOrders('shop-1');
  assert.match(calls[0].url, /file_id,file_name\)/);
});

test('getFileLink asks the owner-file-link function with the owner token and both ids', async () => {
  const { calls, fetchImpl } = fakeFetch({
    url: 'https://example-project.supabase.co/storage/v1/object/sign/customer-files/x.pdf?token=t',
    file_name: 'notes.pdf',
    expires_in: 300,
  });
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const link = await api.getFileLink('order-1', 'file-1');

  assert.equal(link.file_name, 'notes.pdf');
  assert.equal(link.expires_in, 300);
  assert.equal(calls[0].url, 'https://example-project.supabase.co/functions/v1/owner-file-link');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer owner-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { order_id: 'order-1', file_id: 'file-1' });
});

test('getFileLink reports a file outside the owner’s shop as not found', async () => {
  const { fetchImpl } = fakeFetch(
    { code: 'not_found', message: 'No file for this order was found for your shop.' },
    404
  );
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  await assert.rejects(api.getFileLink('order-x', 'file-x'), (err) => err.status === 404 && /No file/.test(err.message));
});

test('getFileLink sends nothing without a signed-in owner', async () => {
  const { calls, fetchImpl } = fakeFetch({});
  const api = createOwnerApi({ config, auth: { getSession: async () => null }, fetchImpl });
  await assert.rejects(api.getFileLink('order-1', 'file-1'), (err) => err.status === 401);
  assert.equal(calls.length, 0);
});
