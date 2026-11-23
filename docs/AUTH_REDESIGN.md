# Owner authentication redesign: username, password, recovery codes

Status: in progress on `stage7-implementation-2026-11-13`. Staging only. Nothing here touches
production, `main`, or PR #3. Update the status table at the end of each step.

## 1. What was assessed (evidence)

| Question | Evidence | Result |
|---|---|---|
| Can Supabase Auth sign in with a username? | GoTrue password login takes `email` (`POST /auth/v1/token?grant_type=password`). No username field is documented or present in the schema. | **No.** A username layer is needed. |
| Do the RLS policies depend on the email? | Policies and RPCs use `auth.uid()` only. No SQL reads an email claim. | **No.** A username layer can sit on top of GoTrue without rewriting policies. |
| Is there an existing rate limiter? | `public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean`, `SECURITY DEFINER`, used by `upload-file`. Fails closed on bad settings. | **Reuse it.** |
| Is `pgcrypto` available? | Installed on staging, version 1.3. | **Use `crypt()`/`gen_salt('bf')`** for hashing (vetted bcrypt), not a custom scheme. |
| Who may create auth users? | Staging auth users: 2, both confirmed, **both with no password hash and no identities**, both with shop memberships. | **Neither legacy account can sign in with a password today.** |
| Can a client create an account without the app? | GoTrue `POST /auth/v1/signup` is reachable with the publishable key. Dashboard settings cannot be read through MCP. | **Yes, unless blocked in the database.** Fixed by a trigger guard (section 3). |
| Staging security advisors (2026-11-22) | `auth_leaked_password_protection` WARN (disabled). `anon`/`authenticated` can run SECURITY DEFINER `place_order`, `quote_order`, `track_order`, and 22 others. RLS with no policy on the 5 service-only tables (intended). | Leaked-password check is an **owner action**. Other warnings predate this work and are reported, not changed. |
| Can this sandbox reach staging? | `CONNECT` to the staging API host returns 403 from the agent proxy (see `/root/.ccr/README.md`). | **Live auth tests must run in CI** (`.github/workflows/owner-auth-staging.yml`). The DB and deploy steps use the Supabase MCP. |
| Does the Supabase migration history match the repo? | `list_migrations` on staging returns 13 entries. The repo has 16 files. Local 0015–0017 are not in the remote list. | **Drift to investigate** before any production catch-up. Not changed here. |

## 2. Chosen approach

Supabase Auth (GoTrue) stays the session authority, so RLS, refresh, and logout keep working unchanged.

- **Username accounts are GoTrue users** with an internal address `<username>@accounts.qrquick.invalid`.
  The `.invalid` TLD is reserved (RFC 2606), so no mail is ever meant for it. The account is created with
  `email_confirm: true` through the admin API, so nothing is sent. Whether GoTrue accepts this address
  is **not yet proven** (see blocker B2).
- **One server function, `owner-auth`** (`verify_jwt = false`), handles signup, sign-in, recovery,
  and code regeneration. It does all validation, rate limiting, reservation, and acceptance checks.
  The browser never hashes anything and never decides whether a check passed.
- **Username reservation** is a primary-key row (`owner_usernames.username`, normalised). A duplicate
  is rejected by the database. A second guard is GoTrue's unique email, which the internal address
  makes equivalent to the username.
- **Database guard on `auth.users`** (BEFORE INSERT trigger): a row is accepted only if its
  `raw_app_meta_data.owner_flow = 'username-v1'` and its email ends in `@accounts.qrquick.invalid`.
  `app_metadata` can be set only by the admin API, so a public `/auth/v1/signup` call with an email
  address is refused by the database, even if the dashboard still allows email sign-up.
- **Recovery codes**: 10 per account, 16 characters from a 31-symbol alphabet
  (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`: no `0 O 1 I L`), shown as four groups of four and once only. Each code
  carries about 79 bits (16 × log2 31). Bytes at or above 248 are discarded before `% 31`, so every symbol is
  equally likely. Stored as bcrypt hashes (`crypt(code, gen_salt('bf', 8))`), single use. The
  whole set is replaced on a successful reset and on an explicit regenerate.
- **Terms and Privacy acceptance** is checked by the function against `legal_documents` (current versions
  only). Acceptance rows (`owner_policy_acceptances`) are written server-side with a timestamp. A signup
  without the current versions is refused before any account is created.
- **Rate limits** use `consume_rate_limit` with keys that are HMAC-SHA256 of the normalised username or IP
  (keyed with the server secret). Failure to check the limit returns an error, not an allowance.
- **Sign-in** returns one generic message for "unknown username" and "wrong password". For an unknown
  username the function still runs one bcrypt comparison (`owner_auth_burn`), which narrows the timing gap.
- **Reset** requires username plus a recovery code. It revokes refresh sessions (`revoke_user_sessions`),
  sets the new password through the admin API, rotates the code set, then signs in and returns the new codes.

### Rejected alternatives

| Alternative | Why not |
|---|---|
| Issue our own JWTs and bypass GoTrue | Would replace the session authority RLS relies on, and add key management. High risk. |
| Hash passwords in the browser | Violates the requirement. The browser cannot hold a secret, so the hash is the password. |
| Supabase phone (SMS) auth | Adds an SMS provider and a new external dependency. Not requested. |
| Anonymous sign-in plus a username column | Anonymous users cannot sign back in. |
| Keep email, hide it in the UI | Violates the requirement. Email would still be required by GoTrue. |
| Trust the front end to show the terms | Not enforced, so bypassable. Acceptance is enforced by the function. |

## 3. Database changes (migration `0021_owner_username_auth`)

- New tables, all with RLS enabled, no policies, and no grants to `anon` or `authenticated`:
  `owner_usernames`, `owner_recovery_codes`, `legal_documents`, `owner_policy_acceptances`.
- Functions, `SECURITY DEFINER`, `search_path = ''`, executable by `service_role` only:
  `owner_replace_recovery_codes`, `owner_consume_recovery_code`, `owner_auth_burn`, `revoke_user_sessions`.
- Trigger `owner_guard_auth_users` on `auth.users` (BEFORE INSERT), described in section 2.
- Seed: `legal_documents` rows for `terms` and `privacy`, version `2026-11-22.1`, effective 2026-11-22.

## 4. Blockers and owner decisions (not solvable in code)

| # | Item | What the owner does | Status |
|---|---|---|---|
| B1 | Leaked-password protection is **off** (advisor). | Authentication → Attack protection / Password security: turn on the HaveIBeenPwned check. Confirm it applies to admin-created users; if not, record that. | Owner |
| B2 | GoTrue acceptance of `@accounts.qrquick.invalid` is **unverified**. | The CI staging test creates one account and must pass. If GoTrue refuses the domain, stop and choose another internal domain (see section 6). | Proved by CI |
| B3 | Email sign-up in the dashboard. | Turn email sign-up **off** when the new client is live. The trigger already refuses email rows, so this is defence in depth. | Owner |
| B4 | Legacy email-only owners. | Staging has 2 such accounts, with no password. Production is unknown. Decide: an admin-assisted claim (identity checked by the owner, then a reservation row added by hand), or recreate. **Not implemented.** | Owner decision |
| B5 | Recovery-code loss. | Without codes, a forgotten password cannot be reset by the app. Mitigation: the signed-in "new recovery codes" action (needs the current password). Fallback is a manual admin reset, which needs a process. | Accepted risk, to be shown in the UI |
| B6 | Access tokens outlive a reset. | Refresh sessions are revoked at once. Existing access tokens last until their expiry (default 1 hour). | Documented |
| B7 | Username-taken message on signup. | Signup must say "taken" to be usable. This reveals that a name is registered. Login does not reveal it. | Accepted trade-off |
| B8 | Public email endpoints (`/auth/v1/recover`, `/auth/v1/otp`) still exist for legacy accounts. | The app does not call them. Full removal means turning the email provider off, which also removes legacy access. Owner decision. | Owner decision |
| B9 | Live tests cannot run from this sandbox (proxy 403 to staging). | Run `owner-auth-staging.yml` in CI. Its result is the only proof of the live path. | Open until CI is green |
| B10 | Migration drift (remote 13 vs repo 16). | Compare before any production catch-up. Not changed here. | Open |
| B11 | Pre-existing advisor warnings (anon-callable `place_order`, `quote_order`, `track_order`; authenticated SECURITY DEFINER RPCs). | Not part of this change. Review separately. | Open |

## 5. Status

| Step | State |
|---|---|
| Architecture assessment (this file) | Done |
| Migration `0021_owner_username_auth` on staging (two migrations: `owner_username_auth`, `owner_guard_revoke_execute`), verified in a rolled-back transaction, advisors re-run | Done (staging) |
| `owner-auth` function: 30 unit tests against a mocked GoTrue/PostgREST pass (`web/tests/owner-auth-function.test.js`) | Done |
| `owner-auth` deployed to staging, `verify_jwt = false`, status ACTIVE | Done (staging) |
| Live staging checks, `web/tests/live/owner-auth-live.mjs` run by `owner-auth-staging.yml`: policies, terms refusal, weak password, reserved name, sign-up with the `.invalid` address, duplicate, sign-in, reset with a code, a stale code refused, new codes, rate limit | Written. Not run yet: this sandbox cannot reach staging, so the first CI run is the proof for B2 and B9. Refusing direct email sign-up is not in the script; it depends on the dashboard setting (B3). |
| Client: `auth.js`, `session.js`, `logic.js`, `owner.js` screens, `app.js` routes, `legal.js` Terms and Privacy pages | Done locally. The Terms and Privacy text is a DRAFT with [bracketed] placeholders that the operator must complete and approve. |
| Email code removed: `pending-signup.js` and its test deleted; OTP, email recovery and email sign-up removed from the client | Done locally |
| Local tests: `npm test` 258 of 258; browser smokes against mocks: owner-smoke 43/43, owner-shell-smoke 51/51, registration-smoke 44/44, qr-smoke 12/12, licence-smoke 33/33, features-smoke 24/24, stats-smoke exit 0 | Pass |
| Staging browser smoke (`staging-owner-smoke.cjs`) moved to usernames; its owner secrets are now `STAGING_OWNER_USERNAME` and `STAGING_OWNER_PASSWORD` | Done; not run against staging (needs the owner secret) |
| Commit and push to `stage7-implementation-2026-11-13` | Pending until pushed; see the branch log |

## 6. Fallbacks if a step fails

- **GoTrue refuses `.invalid`:** use a domain the project controls and does not send to. Options: a subdomain
  of the company domain with no MX record, or `*.invalid` replaced by a second reserved TLD. Each option
  needs the owner to confirm before the change.
- **Trigger breaks an admin insert:** the trigger checks `raw_app_meta_data` and the email suffix only.
  An admin insert that sets `owner_flow` passes. Any other insert fails by design.
- **CI cannot reach staging:** run the live suite from the owner's machine with the staging URL and the
  staging publishable key. Never with a service key.
