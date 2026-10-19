// Requests made as the signed-in shop owner. Each call sends the owner's
// access token, so row level security applies to every request as that owner.
// The database decides what may be read and written. This file only shapes the
// requests and keeps the browser from sending columns it has no business
// changing (for example the shop slug, which is fixed after creation).

import { apiError, readJson } from './http.js';
import { checkPaymentQrFile, PAYMENT_QR_TYPES } from './logic.js';

const SHOP_FIELDS = ['name', 'phone', 'address', 'is_open', 'cash_payment_timing', 'minimum_order_paise'];
const SERVICE_FIELDS = ['name', 'pricing_unit', 'bw_price_paise', 'colour_price_paise', 'is_active'];
const ORDER_SELECT =
  'id,tracking_code,status,total_paise,customer_note,created_at,' +
  'payment_status,payment_channel,paid_at,refunded_at,refund_paise,cancel_reason,' +
  'order_items(service_name,pricing_unit,page_count,copies,colour,duplex,billable_units,amount_paise,file_id,file_name)';
// Fields for the CSV export. File names are left out: the export does not need them.
const EXPORT_SELECT =
  'tracking_code,status,total_paise,created_at,payment_status,payment_channel,paid_at,refunded_at,refund_paise,cancel_reason,' +
  'order_items(service_name,pricing_unit,page_count,copies,colour,duplex,billable_units,amount_paise)';
const EXPORT_PAGE = 1000; // rows the API returns per request
const EXPORT_MAX_PAGES = 50; // 50,000 orders at most in one export

// Copies only the allowed keys that were actually given (undefined is skipped).
export function pickFields(fields, allowed) {
  const picked = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) picked[key] = fields[key];
  }
  return picked;
}

function withStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function createOwnerApi({ config, auth, fetchImpl = globalThis.fetch }) {
  const base = config.supabaseUrl.replace(/\/$/, '');

  async function request(method, path, { body, prefer } = {}) {
    const session = await auth.getSession();
    if (!session) throw withStatus('Please sign in again.', 401);

    const headers = {
      apikey: config.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetchImpl(`${base}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'Request failed');
    return data;
  }

  const enc = encodeURIComponent;

  // Calls the storage API for the shop-assets bucket. The storage policies only
  // allow files in the owner's own shop folder, so this cannot reach other shops.
  async function storage(method, objectPath, { body, contentType } = {}) {
    const session = await auth.getSession();
    if (!session) throw withStatus('Please sign in again.', 401);

    const headers = { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` };
    if (contentType) headers['Content-Type'] = contentType;
    const encoded = objectPath.split('/').map(enc).join('/');
    const response = await fetchImpl(`${base}/storage/v1/object/shop-assets/${encoded}`, {
      method,
      headers,
      body,
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'The file could not be saved.');
    return data;
  }

  // Removes an old file after the shop has moved on. A failure here is harmless
  // (the file is simply left behind), so it is not reported to the owner.
  async function removeFileQuietly(objectPath) {
    if (!objectPath) return;
    try {
      await storage('DELETE', objectPath);
    } catch {
      // Ignored on purpose: the shop's record is already correct.
    }
  }

  return {
    // Shops this owner belongs to, with their role.
    async listMyShops(userId) {
      const rows = await request(
        'GET',
        `shop_memberships?user_id=eq.${enc(userId)}` +
          '&select=role,shop:shops(id,slug,name,phone,address,is_open,features,payment_qr_path,cash_payment_timing,minimum_order_paise)'
      );
      return rows
        .filter((row) => row.shop)
        .map((row) => ({ role: row.role, ...row.shop }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    // Creates the shop and the owner membership in one database transaction.
    createShop({ slug, name, phone, address }) {
      return request('POST', 'rpc/create_shop', {
        body: {
          p_slug: slug,
          p_name: name,
          p_phone: phone ?? null,
          p_address: address ?? null,
        },
      });
    },

    async updateShop(shopId, fields) {
      const rows = await request('PATCH', `shops?id=eq.${enc(shopId)}`, {
        body: pickFields(fields, SHOP_FIELDS),
        prefer: 'return=representation',
      });
      // RLS hides rows the owner may not change, so an empty result means no permission.
      if (!rows.length) throw withStatus('You do not have permission to change this shop.', 403);
      return rows[0];
    },

    // Includes inactive services, which customers cannot see.
    listServices(shopId) {
      return request(
        'GET',
        `services?shop_id=eq.${enc(shopId)}` +
          '&select=id,name,pricing_unit,bw_price_paise,colour_price_paise,is_active&order=name'
      );
    },

    async createService(shopId, fields) {
      const rows = await request('POST', 'services', {
        body: { shop_id: shopId, ...pickFields(fields, SERVICE_FIELDS) },
        prefer: 'return=representation',
      });
      return rows[0];
    },

    async updateService(shopId, serviceId, fields) {
      const rows = await request(
        'PATCH',
        `services?id=eq.${enc(serviceId)}&shop_id=eq.${enc(shopId)}`,
        {
          body: pickFields(fields, SERVICE_FIELDS),
          prefer: 'return=representation',
        }
      );
      if (!rows.length) throw withStatus('You do not have permission to change this service.', 403);
      return rows[0];
    },

    // Newest first, with each order's items (a price snapshot the owner cannot change).
    listOrders(shopId, limit = 100) {
      return request(
        'GET',
        `orders?shop_id=eq.${enc(shopId)}&select=${ORDER_SELECT}&order=created_at.desc&limit=${limit}`
      );
    },

    // A five-minute link to one order's file. The function checks the owner's
    // membership first (RLS on order_items), so a file from another shop is a 404.
    async getFileLink(orderId, fileId) {
      const session = await auth.getSession();
      if (!session) throw withStatus('Please sign in again.', 401);

      const response = await fetchImpl(`${base}/functions/v1/owner-file-link`, {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId, file_id: fileId }),
      });
      const data = await readJson(response);
      if (!response.ok) throw apiError(response, data, 'The file could not be opened.');
      return data;
    },

    // ----- statistics and payments -----
    // Each function checks on the database side that the signed-in user owns the shop.

    // Totals for one period. Dates are calendar days in India time, both ends included.
    statsSummary(shopId, from, to) {
      return request('POST', 'rpc/shop_stats_summary', {
        body: { p_shop_id: shopId, p_from: from, p_to: to },
      });
    },

    // One row per day in the period.
    statsDaily(shopId, from, to) {
      return request('POST', 'rpc/shop_stats_daily', {
        body: { p_shop_id: shopId, p_from: from, p_to: to },
      });
    },

    recentActivity(shopId, limit = 30) {
      return request('POST', 'rpc/shop_recent_activity', {
        body: { p_shop_id: shopId, p_limit: limit },
      });
    },

    // action: set_pending, set_paid, set_unpaid or refund. channel: cash or online.
    setOrderPayment(orderId, action, channel = null) {
      return request('POST', 'rpc/set_order_payment', {
        body: { p_order_id: orderId, p_action: action, p_channel: channel },
      });
    },

    setCancelReason(orderId, reason) {
      return request('POST', 'rpc/set_cancel_reason', {
        body: { p_order_id: orderId, p_reason: reason },
      });
    },

    // Every order placed in [startIso, endIso), read a page at a time. Refuses
    // rather than returning a partial file when the period is too large.
    async listOrdersBetween(shopId, startIso, endIso) {
      const all = [];
      for (let page = 0; ; page += 1) {
        if (page >= EXPORT_MAX_PAGES) {
          throw withStatus('That period has too many orders to export at once. Choose a shorter period.', 413);
        }
        const rows = await request(
          'GET',
          `orders?shop_id=eq.${enc(shopId)}&created_at=gte.${enc(startIso)}&created_at=lt.${enc(endIso)}` +
            `&select=${EXPORT_SELECT}&order=created_at.asc,id.asc` +
            `&limit=${EXPORT_PAGE}&offset=${page * EXPORT_PAGE}`
        );
        all.push(...rows);
        if (rows.length < EXPORT_PAGE) return all;
      }
    },

    // Only the status is sent. The database refuses invalid moves and any change
    // to money or identity fields, so the browser cannot skip a step.
    async updateOrderStatus(shopId, orderId, status) {
      const rows = await request('PATCH', `orders?id=eq.${enc(orderId)}&shop_id=eq.${enc(shopId)}`, {
        body: { status },
        prefer: 'return=representation',
      });
      if (!rows.length) throw withStatus('You do not have permission to change this order.', 403);
      return rows[0];
    },

    // ----- shop features and payment QR -----

    // The features a shop can switch on or off: key, label and whether it changes the price.
    listFeatureCatalog() {
      return request('GET', 'feature_catalog?select=key,label,affects_orders,sort_order&order=sort_order');
    },

    // features: { key: true | false }. Only yes/no values are sent. The database
    // refuses unknown keys. Returns the features as saved.
    saveFeatures(shopId, features) {
      for (const [key, value] of Object.entries(features)) {
        if (typeof value !== 'boolean') throw withStatus(`${key} must be yes or no.`, 400);
      }
      return request('POST', 'rpc/set_shop_features', {
        body: { p_shop_id: shopId, p_features: features },
      });
    },

    // Stores the picture in the shop's own folder, then points the shop at it.
    // Every upload gets a new file name, so customers never see an old picture.
    // Returns the new path. The previous picture is removed once the new one is saved.
    async uploadPaymentQr(shopId, file, previousPath = null) {
      const problem = checkPaymentQrFile(file);
      if (problem) throw withStatus(problem, 400);

      const name = `${shopId}/payment-qr-${randomHex(4)}.${PAYMENT_QR_TYPES[file.type]}`;
      await storage('POST', name, { body: file, contentType: file.type });
      let path;
      try {
        path = await request('POST', 'rpc/set_payment_qr', {
          body: { p_shop_id: shopId, p_path: name },
        });
      } catch (err) {
        await removeFileQuietly(name); // not attached to the shop, so do not keep it
        throw err;
      }
      if (previousPath && previousPath !== name) await removeFileQuietly(previousPath);
      return path;
    },

    // Detaches the payment QR from the shop, then removes the file.
    async removePaymentQr(shopId, currentPath) {
      await request('POST', 'rpc/set_payment_qr', { body: { p_shop_id: shopId, p_path: null } });
      await removeFileQuietly(currentPath);
      return null;
    },
  };
}

// A random string of hex digits: 2 * bytes characters.
function randomHex(bytes) {
  const values = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
}
