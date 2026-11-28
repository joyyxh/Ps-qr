// Refuses any configuration that could expose a secret. Only the publishable key may reach the browser.
import { decodeJwtPayload } from './http.js';

export function isServiceKey(key) {
  const text = String(key ?? '');
  if (text.startsWith('sb_secret_')) return true;
  const claims = decodeJwtPayload(text);
  return Boolean(claims && claims.role === 'service_role');
}

export function isUsableConfig(config) {
  if (!config || typeof config !== 'object') return false;
  const url = config.supabaseUrl;
  const key = config.publishableKey;
  if (typeof url !== 'string' || !url.startsWith('https://')) return false;
  if (typeof key !== 'string' || key.trim() === '') return false;
  return !isServiceKey(key);
}
