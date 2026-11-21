// Small HTTP helpers. Tokens are never placed in a URL. Response bodies are parsed, never rendered as HTML.

export async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function readJson(response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Decodes the payload of a JWT for display and for the aal check only. It does NOT verify the signature.
// The server verifies every token on every call, so nothing here grants access.
export function decodeJwtPayload(token) {
  try {
    const part = String(token ?? '').split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const claims = JSON.parse(text);
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}
