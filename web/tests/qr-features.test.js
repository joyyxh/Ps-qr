import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addressProblem,
  checkPaymentQrFile,
  publicAssetUrl,
  publicBaseAddress,
  shopAddress,
  shopOffersColour,
  shopOffersDoubleSided,
} from '../src/logic.js';
import { qrMatrix, qrSvg } from '../src/qr.js';
import { createOwnerApi } from '../src/owner-api.js';

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

// Answers each request in order with the next reply: { status, body }.
function scriptedFetch(replies) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
    const reply = replies.shift() ?? { status: 200, body: null };
    return new Response(reply.body === null ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

// ---------- the QR address ----------

test('the configured public address is used, trimmed, when it is set', () => {
  const result = publicBaseAddress(
    { publicBaseUrl: '  https://printnest.example/ ' },
    { origin: 'http://127.0.0.1:5173', pathname: '/' }
  );
  assert.equal(result.base, 'https://printnest.example/');
  assert.equal(result.problem, null);
});

test('without a configured address, the page address is used and a local one is reported', () => {
  const result = publicBaseAddress({ publicBaseUrl: '' }, { origin: 'http://127.0.0.1:5173', pathname: '/' });
  assert.equal(result.base, 'http://127.0.0.1:5173/');
  assert.match(result.problem, /local address/);
});

test('addressProblem explains each way a QR code cannot reach customers', () => {
  assert.match(addressProblem('not a web address'), /not a valid web address/);
  assert.match(addressProblem('http://printnest.example/'), /must start with https/);
  assert.match(addressProblem('http://localhost:5173/'), /local address/);
  assert.match(addressProblem('http://[::1]:5173/'), /local address/);
  assert.equal(addressProblem('https://printnest.example/'), null);
});

test('a local address is reported before a plain http one', () => {
  // Both are wrong, but the local address is the one the owner must fix first.
  assert.match(addressProblem('http://127.0.0.1:5173/'), /local address/);
});

test('shopAddress joins the page address and the shop hash, with the slug encoded', () => {
  assert.equal(shopAddress('https://printnest.example', 'demo'), 'https://printnest.example/#/s/demo');
  assert.equal(shopAddress('https://printnest.example/', 'demo'), 'https://printnest.example/#/s/demo');
  assert.equal(shopAddress('https://printnest.example/app/', 'demo'), 'https://printnest.example/app/#/s/demo');
  assert.equal(
    shopAddress('https://printnest.example/app/index.html#/owner', 'demo'),
    'https://printnest.example/app/index.html#/s/demo'
  );
  assert.equal(shopAddress('https://printnest.example/', 'demo xerox'), 'https://printnest.example/#/s/demo%20xerox');
});

// ---------- features ----------

test('colour and double-sided are offered unless the shop has switched them off', () => {
  assert.equal(shopOffersColour({ features: { colour_printing: false } }), false);
  assert.equal(shopOffersColour({ features: { colour_printing: true } }), true);
  assert.equal(shopOffersColour({ features: {} }), true, 'unknown means offered, as the database default');
  assert.equal(shopOffersColour(null), true);
  assert.equal(shopOffersDoubleSided({ features: { double_sided: false } }), false);
  assert.equal(shopOffersDoubleSided({ features: { double_sided: true } }), true);
  assert.equal(shopOffersDoubleSided({}), true);
});

// ---------- payment QR file ----------

test('the payment QR must be a PNG or JPEG of at most 2 MB', () => {
  const png = new File([new Uint8Array(100)], 'upi.png', { type: 'image/png' });
  const jpeg = new File([new Uint8Array(100)], 'upi.jpg', { type: 'image/jpeg' });
  const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });
  const empty = new File([], 'empty.png', { type: 'image/png' });
  const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

  assert.equal(checkPaymentQrFile(png), null);
  assert.equal(checkPaymentQrFile(jpeg), null);
  assert.equal(checkPaymentQrFile(null), 'Choose an image first.');
  assert.equal(checkPaymentQrFile(text), 'Upload a PNG or JPEG image.');
  assert.equal(checkPaymentQrFile(empty), 'The image is empty.');
  assert.match(checkPaymentQrFile(big), /larger than 2 MB/);
});

test('the public picture address is built from the bucket path, one segment at a time', () => {
  assert.equal(
    publicAssetUrl('https://x.supabase.co/', 'shop-1/payment-qr-0a1b2c3d.png'),
    'https://x.supabase.co/storage/v1/object/public/shop-assets/shop-1/payment-qr-0a1b2c3d.png'
  );
  assert.equal(
    publicAssetUrl('https://x.supabase.co', 'shop 1/a b.png'),
    'https://x.supabase.co/storage/v1/object/public/shop-assets/shop%201/a%20b.png'
  );
});

// ---------- the QR code itself ----------

test('the QR matrix has the three finder patterns in the corners', () => {
  const rows = qrMatrix('https://printnest.example/#/s/demo');
  const size = rows.length;
  assert.ok(size >= 21, `size ${size}`);
  assert.ok(rows.every((row) => row.length === size), 'square');

  // A finder pattern: dark outer ring, light ring, dark 3x3 centre.
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let i = 0; i < 7; i += 1) {
      assert.equal(rows[top][left + i], true, 'top edge dark');
      assert.equal(rows[top + 6][left + i], true, 'bottom edge dark');
      assert.equal(rows[top + i][left], true, 'left edge dark');
      assert.equal(rows[top + i][left + 6], true, 'right edge dark');
    }
    assert.equal(rows[top + 1][left + 1], false, 'inner ring light');
    assert.equal(rows[top + 3][left + 3], true, 'centre dark');
  }
});

test('the same text always makes the same code, and different text a different one', () => {
  assert.deepEqual(qrMatrix('https://a.example/#/s/x'), qrMatrix('https://a.example/#/s/x'));
  assert.notDeepEqual(qrMatrix('https://a.example/#/s/x'), qrMatrix('https://a.example/#/s/y'));
});

test('the SVG has a four-module quiet zone around the code', () => {
  const svg = qrSvg('https://printnest.example/#/s/demo');
  const size = qrMatrix('https://printnest.example/#/s/demo').length;
  assert.match(svg, new RegExp(`viewBox="0 0 ${size + 8} ${size + 8}"`));
  assert.match(svg, /^<svg /);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fff"\/>/);
});

// ---------- features and payment QR requests ----------

test('saveFeatures sends yes/no values only and refuses anything else before any request', () => {
  const { calls, fetchImpl } = scriptedFetch([{ status: 200, body: { colour_printing: false } }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  assert.throws(() => api.saveFeatures('shop-1', { colour_printing: 'no' }), /must be yes or no/);
  assert.equal(calls.length, 0);
});

test('saveFeatures calls the database function for the shop', async () => {
  const { calls, fetchImpl } = scriptedFetch([{ status: 200, body: { colour_printing: false, stapling: true } }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  const saved = await api.saveFeatures('shop-1', { colour_printing: false, stapling: true });

  assert.deepEqual(saved, { colour_printing: false, stapling: true });
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/set_shop_features');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.Authorization, 'Bearer owner-token');
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_shop_id: 'shop-1',
    p_features: { colour_printing: false, stapling: true },
  });
});

test('listFeatureCatalog reads the catalogue in display order', async () => {
  const { calls, fetchImpl } = scriptedFetch([{ status: 200, body: [] }]);
  await createOwnerApi({ config, auth: signedIn, fetchImpl }).listFeatureCatalog();
  assert.match(calls[0].url, /feature_catalog\?select=key,label,affects_orders,sort_order&order=sort_order$/);
});

test('uploadPaymentQr stores the picture in the shop folder, attaches it, then removes the old one', async () => {
  const { calls, fetchImpl } = scriptedFetch([
    { status: 200, body: { Key: 'shop-assets/shop-1/x' } }, // storage upload
    { status: 200, body: 'shop-1/payment-qr-new.png' }, // set_payment_qr
    { status: 200, body: { message: 'Successfully deleted' } }, // delete the old picture
  ]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  const file = new File([new Uint8Array(64)], 'upi.png', { type: 'image/png' });

  const path = await api.uploadPaymentQr('shop-1', file, 'shop-1/payment-qr-00000000.png');

  const name = calls[0].url.split('/storage/v1/object/shop-assets/')[1];
  assert.match(name, /^shop-1\/payment-qr-[0-9a-f]{8}\.png$/);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'image/png');
  assert.equal(calls[0].headers.Authorization, 'Bearer owner-token');
  assert.equal(calls[1].url, 'https://example-project.supabase.co/rest/v1/rpc/set_payment_qr');
  assert.deepEqual(JSON.parse(calls[1].body), { p_shop_id: 'shop-1', p_path: decodeURIComponent(name) });
  assert.equal(calls[2].method, 'DELETE');
  assert.equal(calls[2].url, 'https://example-project.supabase.co/storage/v1/object/shop-assets/shop-1/payment-qr-00000000.png');
  assert.equal(path, 'shop-1/payment-qr-new.png');
});

test('uploadPaymentQr removes the new picture again when the shop cannot be pointed at it', async () => {
  const { calls, fetchImpl } = scriptedFetch([
    { status: 200, body: { Key: 'x' } },
    { status: 403, body: { code: '42501', message: 'you do not have permission to change this shop' } },
    { status: 200, body: { message: 'Successfully deleted' } },
  ]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  const file = new File([new Uint8Array(64)], 'upi.jpg', { type: 'image/jpeg' });

  await assert.rejects(api.uploadPaymentQr('shop-1', file, null), (err) => {
    assert.equal(err.status, 403);
    assert.match(err.message, /permission/);
    return true;
  });
  assert.equal(calls[2].method, 'DELETE');
  assert.match(calls[2].url, /\/storage\/v1\/object\/shop-assets\/shop-1\/payment-qr-[0-9a-f]{8}\.jpg$/);
});

test('uploadPaymentQr refuses a bad file before any request', async () => {
  const { calls, fetchImpl } = scriptedFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  const text = new File(['hi'], 'notes.txt', { type: 'text/plain' });

  await assert.rejects(api.uploadPaymentQr('shop-1', text, null), /Upload a PNG or JPEG image/);
  assert.equal(calls.length, 0);
});

test('removePaymentQr detaches the picture, then removes the file, and ignores a failed delete', async () => {
  const { calls, fetchImpl } = scriptedFetch([
    { status: 200, body: null }, // set_payment_qr with null
    { status: 500, body: { message: 'storage is down' } }, // delete fails
  ]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  assert.equal(await api.removePaymentQr('shop-1', 'shop-1/payment-qr-00000000.png'), null);
  assert.deepEqual(JSON.parse(calls[0].body), { p_shop_id: 'shop-1', p_path: null });
  assert.equal(calls[1].method, 'DELETE');
});

test('a shop list row carries the features and the payment QR path', async () => {
  const { calls, fetchImpl } = scriptedFetch([{ status: 200, body: [] }]);
  await createOwnerApi({ config, auth: signedIn, fetchImpl }).listMyShops('owner-1');
  assert.match(calls[0].url, /features,payment_qr_path/);
});
