// HTTP client for the print-agent edge function. Every request has a timeout.
// Nothing is retried here: the worker decides what to do after a failure, so a
// retried "start printing" can never print the same file twice.

export class AgentApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
    this.code = code;
  }
}

export function createAgentApi({ serverUrl, token = null, fetchImpl = globalThis.fetch, timeoutMs = 20000 }) {
  const base = String(serverUrl).replace(/\/$/, '');

  async function call(action, body, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchImpl(`${base}/${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AgentApiError(0, 'network', 'Could not reach QRquick. The agent will try again.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new AgentApiError(
        res.status,
        data?.code ?? 'server_error',
        data?.message ?? `QRquick answered with status ${res.status}.`,
      );
    }
    return data;
  }

  return {
    pair: ({ code, name, platform, version }) =>
      call('pair', { code, name, platform, version }, { auth: false }),
    heartbeat: ({ version, printers }) => call('heartbeat', { version, printers }),
    claim: () => call('claim', {}),
    markPrinting: (jobRef) => call('printing', { job_id: jobRef.jobId, attempt: jobRef.attempt }),
    finish: (jobRef, { outcome, errorCode = null, errorMessage = null }) =>
      call('finish', {
        job_id: jobRef.jobId,
        attempt: jobRef.attempt,
        outcome,
        error_code: errorCode,
        error_message: errorMessage,
      }),
  };
}

// Downloads the file behind a short-lived link. Refuses anything over maxBytes.
// Error messages never contain the link.
export async function downloadFile(url, { maxBytes, fetchImpl = globalThis.fetch, timeoutMs = 60000 }) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AgentApiError(0, 'download_failed', 'The file could not be downloaded.');
  }
  if (!res.ok) {
    throw new AgentApiError(res.status, 'download_failed', 'The file could not be downloaded.');
  }
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    throw new AgentApiError(413, 'file_too_large', 'The file is larger than the 10 MB limit.');
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new AgentApiError(413, 'file_too_large', 'The file is larger than the 10 MB limit.');
  }
  return bytes;
}
