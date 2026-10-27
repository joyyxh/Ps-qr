import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co/',
  publishableKey: 'sb_publishable_TEST',
};

// A fake fetch that records every request and returns a canned response.
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

test('quote posts the cart to the quote_order RPC with only the publishable key', async () => {
  const { calls, fetchImpl } = fakeFetch({ total_paise: 4800, items: [] });
  const api = createApi(config, fetchImpl);

  const cart = [
    { service_id: 'svc-1', file_id: 'file-1', file_name: 'notes.pdf', page_count: 12, copies: 2, colour: false, duplex: true },
  ];
  const result = await api.quote('demo-xerox', cart);

  assert.equal(result.total_paise, 4800);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/quote_order');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_TEST');
  assert.equal(calls[0].init.headers.Authorization, undefined, 'no user token is sent');

  // The file id goes up; the page count and the display name stay in the browser.
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, {
    p_shop_slug: 'demo-xerox',
    p_items: [{ service_id: 'svc-1', file_id: 'file-1', copies: 2, colour: false, duplex: true }],
  });
});

test('placeOrder strips price and total fields before sending', async () => {
  const { calls, fetchImpl } = fakeFetch({ tracking_code: 'ABCD2345' });
  const api = createApi(config, fetchImpl);

  const tampered = [
    {
      service_id: 'svc-1',
      file_id: 'file-1',
      page_count: 1,
      copies: 1,
      colour: false,
      duplex: false,
      unit_price_paise: 1,
      amount_paise: 1,
      total_paise: 1,
    },
  ];
  await api.placeOrder('demo-xerox', tampered, '  ');

  const body = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url.endsWith('/rpc/place_order'), true);
  assert.equal(body.p_customer_note, null, 'blank notes are sent as null');
  assert.equal(body.p_payment_method, 'cash');
  assert.deepEqual(Object.keys(body.p_items[0]).sort(), [
    'colour',
    'copies',
    'duplex',
    'file_id',
    'service_id',
  ]);
  assert.equal('unit_price_paise' in body.p_items[0], false);
  assert.equal('amount_paise' in body.p_items[0], false);
  assert.equal('total_paise' in body.p_items[0], false);
});

test('placeOrder sends UPI only when explicitly selected', async () => {
  const { calls, fetchImpl } = fakeFetch({ tracking_code: 'ABCD2345', payment_method: 'upi' });
  const api = createApi(config, fetchImpl);
  await api.placeOrder('demo-xerox', [], 'note', 'upi');
  assert.equal(JSON.parse(calls[0].init.body).p_payment_method, 'upi');
});

test('track sends the tracking code to the track_order RPC', async () => {
  const { calls, fetchImpl } = fakeFetch({ status: 'approved' });
  const api = createApi(config, fetchImpl);
  const result = await api.track('ABCD2345');
  assert.equal(result.status, 'approved');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_code: 'ABCD2345' });
});

test('getShop builds an encoded, active-only query', async () => {
  const { calls, fetchImpl } = fakeFetch([{ id: 'shop-1', name: 'Demo' }]);
  const api = createApi(config, fetchImpl);
  const shop = await api.getShop('demo xerox&x');
  assert.equal(shop.id, 'shop-1');
  assert.match(calls[0].url, /\/rest\/v1\/shops\?slug=eq\.demo%20xerox%26x&select=/);
});

test('getShop returns null when no shop matches', async () => {
  const { fetchImpl } = fakeFetch([]);
  const api = createApi(config, fetchImpl);
  assert.equal(await api.getShop('nobody'), null);
});

test('server error messages are surfaced to the caller', async () => {
  const { fetchImpl } = fakeFetch({ message: 'shop is closed' }, 400);
  const api = createApi(config, fetchImpl);
  await assert.rejects(api.placeOrder('demo-xerox', [], null), /shop is closed/);
});

test('uploadFile sends the raw file with only the publishable key and returns what the server measured', async () => {
  const { calls, fetchImpl } = fakeFetch({ file_id: 'file-1', page_count: 3, original_name: 'Notes final.pdf' });
  const api = createApi(config, fetchImpl);
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'Notes final.pdf', {
    type: 'application/pdf',
  });

  const result = await api.uploadFile('demo-xerox', file);

  assert.equal(result.page_count, 3);
  assert.equal(calls[0].url, 'https://example-project.supabase.co/functions/v1/upload-file?shop=demo-xerox');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_TEST');
  assert.equal(calls[0].init.headers.Authorization, undefined, 'customers send no user token');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/pdf');
  assert.equal(calls[0].init.headers['X-File-Name'], encodeURIComponent('Notes final.pdf'));
  assert.equal(calls[0].init.body, file, 'the file goes up as the raw body');
});

test('uploadFile surfaces the reason the server gave, with its code', async () => {
  const { fetchImpl } = fakeFetch(
    { code: 'shop_closed', message: 'This shop is closed right now, so it is not taking files.' },
    409
  );
  const api = createApi(config, fetchImpl);
  const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });

  await assert.rejects(api.uploadFile('demo-xerox', file), (err) => {
    assert.equal(err.code, 'shop_closed');
    assert.equal(err.status, 409);
    assert.match(err.message, /closed/);
    return true;
  });
});

test('uploadFile explains a dropped connection in plain words', async () => {
  const api = createApi(config, async () => {
    throw new TypeError('Failed to fetch');
  });
  const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
  await assert.rejects(api.uploadFile('demo-xerox', file), /Could not reach the server/);
});
