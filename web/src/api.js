// Thin wrapper around the Supabase REST API for customers (no sign-in).
// The fetch implementation is injectable so the tests can check exactly what
// would be sent.
//
// Only the publishable key is used here. It is safe in a browser because
// row level security limits what it can read and write. Never put a
// service-role or secret key in this file.

import { apiError, readJson } from './http.js';

// Only these fields may leave the browser for an order item. Anything else
// (prices, totals, flags injected by a tampered page) is dropped here, and the
// database ignores price fields anyway.
// The page count is not sent: the server measures it from the uploaded file.
const ITEM_FIELDS = ['service_id', 'file_id', 'copies', 'colour', 'duplex'];

export function toServerItems(items) {
  return items.map((item) =>
    Object.fromEntries(ITEM_FIELDS.map((field) => [field, item[field] ?? null]))
  );
}

export function createApi(config, fetchImpl = globalThis.fetch) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: config.publishableKey,
    'Content-Type': 'application/json',
  };

  async function rpc(name, body) {
    const response = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data);
    return data;
  }

  async function select(path) {
    const response = await fetchImpl(`${base}/rest/v1/${path}`, { headers });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data);
    return data;
  }

  // Sends one file as raw bytes, with no user token: customers are anonymous.
  // The server checks the type from the bytes, counts the pages and stores the
  // file privately. The browser's file type and name are only hints.
  async function sendFile(shopSlug, file) {
    let response;
    try {
      response = await fetchImpl(
        `${base}/functions/v1/upload-file?shop=${encodeURIComponent(shopSlug)}`,
        {
          method: 'POST',
          headers: {
            apikey: config.publishableKey,
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'upload'),
          },
          body: file,
        }
      );
    } catch {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'The upload did not go through.');
    return data;
  }

  return {
    uploadFile(shopSlug, file) {
      return sendFile(shopSlug, file);
    },

    async getShop(slug) {
      const rows = await select(
        `shops?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,phone,address,is_open,features,payment_qr_path`
      );
      return rows[0] ?? null;
    },

    // Feature labels for the customer page (readable without signing in).
    getFeatureCatalog() {
      return select('feature_catalog?select=key,label,affects_orders,sort_order&order=sort_order');
    },

    getServices(shopId) {
      return select(
        `services?shop_id=eq.${encodeURIComponent(shopId)}&is_active=eq.true` +
          '&select=id,name,pricing_unit,bw_price_paise,colour_price_paise&order=name'
      );
    },

    quote(shopSlug, items) {
      return rpc('quote_order', { p_shop_slug: shopSlug, p_items: toServerItems(items) });
    },

    placeOrder(shopSlug, items, note, paymentMethod = 'cash') {
      const trimmed = typeof note === 'string' ? note.trim() : '';
      return rpc('place_order', {
        p_shop_slug: shopSlug,
        p_items: toServerItems(items),
        p_customer_note: trimmed || null,
        p_payment_method: paymentMethod === 'upi' ? 'upi' : 'cash',
      });
    },

    track(code) {
      return rpc('track_order', { p_code: code });
    },
  };
}
