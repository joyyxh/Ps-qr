# QRquick platform admin panel (Stage 7D)

A private, static web panel for QRquick platform administrators. It is not the owner app, not the public
customer site, and not part of the public web app folder. Nothing here is deployed.

## Status

- Built locally in the Stage 7 worktree. **Not deployed. Not on any Supabase project.** Hosting is an open
  decision (`STAGE7_DECISIONS.md` §14.2 item 6). Deployment needs its own approval (gate 7D).
- Depends on the Stage 7C write RPCs in `supabase/migrations/0012_licence_admin_rpcs.sql` and the Stage 7D
  read RPCs in `supabase/migrations/0013_licence_admin_read_rpcs.sql`. Both files are untracked and unapplied.
  The number 0013 is provisional on this branch (decision E7).
- `config.js` ships with empty values. With empty values the panel sends no request.

## What it does

- Password sign-in, then TOTP. Only an `aal2` session reaches the dashboard. The server still checks
  `aal2` on every call.
- **Shop search.** Search by name or slug (prefix match), or by exact shop ID. Two to 80 characters.
  At most 10 results are shown. If more match, the panel says so and asks for a narrower search.
- **Licence view for the chosen shop.** Its state (active, scheduled, revoked, expired or none), the access
  end or next start, and its state version. Its live and scheduled coverages are listed with their
  coverage IDs. At most 50 coverages are listed; the panel says when there are more.
- **Auto-filled write fields.** Shop ID, expected state version and target coverage ID are read-only. They
  are filled from the licence view and from the coverage the admin picks. The admin does not type them.
- **Audit history** for the chosen shop, newest first, 25 entries per page, with "Load older entries".
- Grant, extend, revoke and replace, each through the matching write RPC. Each action has a review step,
  a reason, and a confirmation box. Results are shown as committed, rejected (with the server code and a
  plain message), or unknown.
- After a committed change, the licence view and the first audit page reload. After a stale-version
  rejection, the licence view reloads and the review is cleared.
- Unknown outcome (dropped connection, timeout, 5xx): the panel offers Retry. Retry reuses the same
  request ID with an identical payload, so the server returns the stored result instead of writing twice.

## What it does not do (blocked, not invented)

- **Payment entry**: deferred (decision M5).
- **Reads are not retried.** A failed search, licence view or audit page shows its error and nothing else.
- **The recording admin's user ID is not shown in the audit view.** The server still returns `actor_user_id`,
  and the database keeps it. Whether admins may see who recorded each entry is an owner decision that has not
  been made (see `OWNER_DECISION_SHEET.md`, Part 1N, item N5, OPEN). Hiding it is the interim position.
- The read RPCs do not require `READ COMMITTED` (the write RPCs do). Each read is one statement, so its
  snapshot is consistent in either level. This has not been tested under `REPEATABLE READ`.

## Read path

Three RPCs, all `authenticated` only, all checking platform-admin identity and `aal2` the same way the write
RPCs do. A failed check is a committed `forbidden` result and writes the same denial counters.

| Panel call | RPC | Parameters (in order) |
|---|---|---|
| Shop search | `admin_search_shops` | `p_query`, `p_limit` |
| Licence view | `admin_shop_licence` | `p_shop_id` |
| Audit history | `admin_shop_audit` | `p_shop_id`, `p_after_created_at`, `p_after_id`, `p_limit` |

The client checks the request shape and the response shape. The server decides every result. The panel
never sends a request ID with a read, and never retries one.

## Security notes

- Server authority: admin identity, `aal2`, state version, reason, confirmation and every licence rule are
  checked by the RPCs. The panel's checks only shape the request and choose the screen.
- Tokens are kept in memory only. Nothing is written to `localStorage`, `sessionStorage`, cookies or a URL.
  Tokens go in the `Authorization` header only.
- Server data is rendered with `textContent` only. There are no HTML sinks.
- The configuration guard refuses any `sb_secret_` key or any JWT with `role: service_role`.
- A refresh that finishes after sign-out does not keep its tokens.
- Reads run one at a time, and every control is off while a read or a write is in flight. Each session
  refresh uses the refresh token once, so two refreshes must not overlap.
- Content Security Policy is set in `index.html`. It must also be set as an HTTP header at deployment,
  together with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and
  `Cache-Control: no-store`. Meta tags cannot set `frame-ancestors`.
- At deployment, replace the wildcard `connect-src https://*.supabase.co` with the exact project origin.
- Served with `noindex` and `robots.txt` disallowing all crawlers. Keep it off the public `pages.yml` build.
- Not decided, so not implemented: an idle session timeout, the MFA recovery procedure (decision 14, item 5),
  the minimum number of admins (decision 13), and the lockout and break-glass procedure (the draft in
  `docs/STAGE7C_OPERATIONS.md` is not approved).

## Tests

```
npm test                       # unit and static checks, no browser, no network
node tests/browser-smoke.cjs   # local UI smoke test with every request intercepted (needs Playwright)
```

- `npm test` checks:
  - write payload keys against `licence_admin_allowed_keys()` in 0012;
  - every rejection code in 0012 and 0013 has a message;
  - the read parameter lists against the 0013 function signatures, in order;
  - the read privileges in 0013 (authenticated only, the gate to no client role);
  - the read request and response shapes, and the classification of results, rejections, session errors
    and failures (`tests/read-api.test.js`);
  - the time and label formatting for the licence view and the audit history (`tests/read-model.test.js`);
  - the state machine for sign-in and MFA; request-ID reuse rules; the RPC call classification;
  - static security rules (no HTML sinks, no storage, no secret keys, no imports from outside the admin folder,
    a strict CSP, `noindex`, empty configuration).
- The browser smoke test runs three scenarios against the static files: not configured; MFA, then a shop
  search, a licence view, paged audit history, an unknown outcome and Retry (replay), with the 375px layout
  check; a committed-version rejection with a reload; TOTP enrolment with a QR image. Its stub host,
  `smoke-stub.supabase.co`, is routed inside Playwright. The stub is not a Supabase project reference.

**What these tests do not prove.** They are not staging evidence. The unit tests run no RPC and no SQL.
The read RPCs are tested by `supabase/tests/licence_7c/read_api_tests.py` against a local PostgreSQL 16
database, not a Supabase project. The browser test does not run any RPC. Neither verifies hosted AAL2
(O11), the browser against a real project, or the read RPCs under `REPEATABLE READ`. Those need separate
approvals.
