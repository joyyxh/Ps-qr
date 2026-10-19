// Shared helpers for talking to Supabase over fetch (REST, RPC and Auth).

export async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

// Builds an Error from a failed response. Supabase puts the reason in
// different fields depending on the endpoint, so check each one. The HTTP
// status and the Postgres or Auth error code are kept so callers can react
// to them (for example 401 means "sign in again", 23505 means "already taken").
export function apiError(response, data, fallback = 'Request failed') {
  const message =
    data?.message ||
    data?.msg ||
    data?.error_description ||
    data?.error ||
    `${fallback} (${response.status})`;
  const error = new Error(String(message));
  error.status = response.status;
  // Postgres codes are strings such as "23505". Auth also sends a numeric
  // "code" (the HTTP status), so only string codes count as error codes.
  const code = typeof data?.code === 'string' ? data.code : data?.error_code;
  error.code = code || null;
  return error;
}
