import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createOwnerApi, pickFields } from '../src/owner-api.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co/',
  publishableKey: 'sb_publishable_TEST',
};

// An auth stand-in that always has a fresh session for owner-1.
const signedIn = {
  getSession: async () => ({
    access_token: 'owner-token',
    refresh_token: 'refresh',
    expires_at: 9e9,
    user: { id: 'owner-1', email: 'owner@example.com' },
  }),
};
const signedOut = { getSession: async () => null };

function fakeFetch(responseBody, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(responseBody === null ? null : JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('every owner request is sent with the owner token and the publishable key', async () => {
  const { calls, fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  await api.listServices('shop-1');

  assert.equal(calls[0].init.headers.Authorization, 'Bearer owner-token');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_TEST');
});

test('signed-out owners get a 401 and no request is sent', async () => {
  const { calls, fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedOut, fetchImpl });

  await assert.rejects(api.listMyShops('owner-1'), (err) => err.status === 401);
  assert.equal(calls.length, 0);
});

test('listMyShops reads the owner memberships and sorts the shops by name', async () => {
  const { calls, fetchImpl } = fakeFetch([
    { role: 'owner', shop: { id: 's2', slug: 'b-shop', name: 'Zed Print', is_open: true } },
    { role: 'owner', shop: { id: 's1', slug: 'a-shop', name: 'Alpha Copy', is_open: false } },
    { role: 'staff', shop: null },
  ]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const shops = await api.listMyShops('owner-1');

  assert.match(calls[0].url, /shop_memberships\?user_id=eq\.owner-1&select=role,shop:shops\(/);
  assert.deepEqual(
    shops.map((shop) => shop.name),
    ['Alpha Copy', 'Zed Print']
  );
  assert.equal(shops[0].role, 'owner');
});

test('createShop calls the create_shop function with the shop details', async () => {
  const { calls, fetchImpl } = fakeFetch({ id: 'shop-9', slug: 'new-print' });
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const shop = await api.createShop({ slug: 'new-print', name: 'New Print', phone: null, address: 'Main Road' });

  assert.equal(shop.slug, 'new-print');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/create_shop');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    p_slug: 'new-print',
    p_name: 'New Print',
    p_phone: null,
    p_address: 'Main Road',
  });
});

test('updateShop sends only the editable shop columns, so the slug cannot be changed', async () => {
  const { calls, fetchImpl } = fakeFetch([{ id: 'shop-1', name: 'X', is_open: false }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await api.updateShop('shop-1', { name: 'X', slug: 'hijacked', id: 'other-shop', owner_id: 'me', is_open: false });

  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/shops?id=eq.shop-1');
  assert.equal(calls[0].init.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'X', is_open: false });
});

test('updateShop reports a permission error when the database changes no rows', async () => {
  const { fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await assert.rejects(api.updateShop('someone-elses-shop', { is_open: true }), (err) => {
    assert.equal(err.status, 403);
    assert.match(err.message, /permission/);
    return true;
  });
});

test('createService takes the shop from the page, not from the submitted fields', async () => {
  const { calls, fetchImpl } = fakeFetch([{ id: 'svc-new' }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await api.createService('shop-1', {
    name: 'Black and white print',
    pricing_unit: 'per_side',
    bw_price_paise: 200,
    colour_price_paise: null,
    is_active: true,
    shop_id: 'other-shop',
  });

  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/services');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.shop_id, 'shop-1');
  assert.equal(body.bw_price_paise, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    'bw_price_paise',
    'colour_price_paise',
    'is_active',
    'name',
    'pricing_unit',
    'shop_id',
  ]);
});

test('updateService is limited to one service in one shop', async () => {
  const { calls, fetchImpl } = fakeFetch([{ id: 'svc-1', bw_price_paise: 250 }]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  const service = await api.updateService('shop-1', 'svc-1', { bw_price_paise: 250, shop_id: 'other' });

  assert.equal(service.bw_price_paise, 250);
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/services?id=eq.svc-1&shop_id=eq.shop-1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { bw_price_paise: 250 });
});

test('updateService reports a permission error when no service was changed', async () => {
  const { fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await assert.rejects(api.updateService('shop-1', 'svc-foreign', { name: 'X' }), (err) => err.status === 403);
});

test('pickFields keeps only allowed keys that were given', () => {
  assert.deepEqual(pickFields({ name: 'A', slug: 'x', phone: undefined, is_open: false }, ['name', 'phone', 'is_open']), {
    name: 'A',
    is_open: false,
  });
});

// Every file under src/ (including vendored libraries) plus config.js.
function browserFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    return entry.isDirectory() ? browserFiles(url) : [url];
  });
}

test('the browser code never contains a service-role or secret key', () => {
  const files = [...browserFiles(new URL('../src/', import.meta.url)), new URL('../config.js', import.meta.url)];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /service_role|sb_secret_|SERVICE_ROLE/, `${file.pathname} must not hold a privileged key`);
  }
});
