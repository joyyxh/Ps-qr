# P5 implementation and real server response contract (snapshot 2026-11-13)

Source: scratch chain copy (base 5c82d37 + P2 v5, P3 v3, U6, P4 v5, P5). P5 files are byte-identical to the stage7 worktree. Edge function is the base version (no unit changes it). Full files are in `source_snapshot/`.

## 1. Agent: markPrinting call site (`agent/src/worker.mjs`, from line 258)
```js

      // Note first, so a crash between here and the printer is seen on restart.
      await journal.setActive({ ...jobRef, state: 'starting', at: now() });
      try {
        const mark = await api.markPrinting(jobRef);
        // Fail closed: print only after the server explicitly confirms the start.
        if (mark?.ok !== true) {
          const notConfirmed = new Error('The server did not confirm the start.');
          notConfirmed.code = 'not_confirmed';
          throw notConfirmed;
        }
      } catch (err) {
        // Nothing has been sent to the printer. The server requeues the job when the lease ends,
        // or it has already moved on. Do not report a failure: that would invite a reprint.
        await journal.clearActive();
        log(`${label}: not printed. The server did not confirm the start (${err.code ?? 'error'}).`);
        return;
      }

      await journal.setActive({ ...jobRef, state: 'submitting', at: now() });
      let result;
      try {
        result = await adapter.print({
          printer: printer.name,
          file: filePath,
          copies: settings.copies,
          colour: settings.colour,
          duplex: settings.duplex,
          paper: settings.paper,
          title: `QRquick ${String(job.job_id).slice(0, 8)}`,
          capabilities: printer,
```

## 2. Agent HTTP wrapper (`agent/src/api.mjs`, from line 17)
```js
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
```

## 3. Server: printing handler (`supabase/functions/print-agent/index.ts`, from line 206)
```ts
async function printing(tokenHash: string, body: Record<string, unknown>): Promise<Response> {
  await rpc("agent_mark_printing", {
    p_token_hash: tokenHash,
    p_job_id: requireUuid(body.job_id, "job"),
    p_attempt: requireAttempt(body.attempt),
  });
  return json(200, { ok: true });
}
```

## 4. Server: action dispatch (from line 279)
```ts
        return await heartbeat(tokenHash, body);
      case "claim":
        return await claim(tokenHash);
      case "printing":
        return await printing(tokenHash, body);
      case "finish":
```

## 5. Server: error mapping (from line 287)
```ts
    if (err instanceof ApiError) {
      return json(err.status, { code: err.code, message: err.message });
    }
    console.error("print-agent: unexpected failure");
```

## 6. Response contract used by P5

| Server outcome | HTTP | Body | Agent result | Printed? |
|---|---|---|---|---|
| `agent_mark_printing` succeeds | 200 | `{"ok": true}` | `mark.ok === true`, print proceeds | yes |
| RPC error (job not in the right state, etc.) | non-2xx from `ApiError` or 500 | `{"code","message"}` | `api.call` throws `AgentApiError`, caught, nothing printed | no |
| 2xx with missing or non-JSON body | 2xx | none, or `null` | `mark?.ok !== true` throws `not_confirmed`, caught, nothing printed | no |
| 2xx with `{"ok": false}` or `{}` | 2xx | as stated | `not_confirmed`, caught, nothing printed | no |
| Network or timeout | none | none | `AgentApiError` (`network`), caught, nothing printed | no |

Notes: the agent treats `mark` as confirmed only when `mark?.ok === true`. The new test `does not print unless the server explicitly confirms the start (fail closed)` covers `undefined`, `{}` and `{ ok: false }`. The server never returns `{ ok: true }` without the RPC having completed, because the `{ ok: true }` line follows the awaited RPC call.
