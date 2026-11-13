# Stage 7E: owner licence status (read only)

**Status: implemented, labels applied 2026-11-09, not committed.** Branch `stage7e-owner-licence-status`, worktree
`/home/claude/joyyxh/ps-qr-stage7e`, based on `stage7-payments` at `5c82d37`. Nothing is pushed,
merged, deployed, or applied to any database. The RPC this screen calls (migration `0012`) is
still untracked on `stage7-payments` and is not applied anywhere.

## Scope (resolved by owner decision 1, 2026-11-09)

The brief asked for the licence view in the **owner Android app**. The decision records say the
owner **web** view is 7E, and the Android view is **DEFERRED** (`STAGE7_DECISIONS.md` §12B.2 D,
§14.2 item 13, line ~591).

This branch follows the records. The screen is in the shared owner web app (`web/`). `mobile/`
packages that same `web/` folder with Capacitor, so the screen is in the Android source bundle
too. **The Android build switches it off.** `mobile/scripts/copy-web.mjs` sets `ownerApp: true`.
Then `web/src/owner.js` (`licenceEnabled`) removes the Licence button and the
`#/owner/shop/<slug>/licence` route, and `owner-licence.js` sends no request. The Android app
therefore does not show the licence screen. Item 13 stays deferred. No native Android code was
written.

**Owner decision 1 (2026-11-09):** keep the Android view disabled, following item 13. Native
Android scope is not reopened. Showing the view in Android would need a new owner decision.

## What the owner sees

Route: `#/owner/shop/<slug>/licence`. Reached from a **Licence** button on the shop page. The
button appears only when the signed-in user's membership role is `owner`.

| What is shown | When | Notes |
|---|---|---|
| **Active**, "Lifetime access. No expiry." | `active` and `no_expiry` | Approved by the owner, 2026-11-09 (item 13 / decision 19; proposal P4) |
| **Active**, "Access until 1 Jan 2028, 00:00 IST." | `active`, `access_end` set | The end is exclusive (decision 9). Approved by the owner (decision 2, 2026-11-09) |
| **Not active**, "No access is active now." and, on its own line, "The next access starts …" | `next_start` set and not active | One inactive badge for scheduled and ordinary inactive states (approved P2, 2026-11-09). The next start is kept on its own line |
| **Not active**, "No printing access is active for this shop." | not active, no `next_start`. This is also the empty state | Same badge. Approved by the owner, 2026-11-09 (confirmation W1) |
| **Check again**, "The end time … has passed since the last check. Refresh to see the current status." | the stored time is already past on this device's clock | Kept (approved P3). Refresh is needed |
| **Status unavailable** (with a reason) | offline, network, server, service missing, sign-in, forbidden, malformed, unknown | Kept with its eight reason texts (approved P5). Nothing from earlier checks is shown |
| Checking… | a check is running | Kept (approved P6). Refresh is disabled. Earlier results are cleared |

No printing-permitted line is shown. It was removed on 2026-11-09 (approved P1) and returns only with
Stage 7F enforcement.

Approved labels (owner, 2026-11-09): "Access until 1 Jan 2028, 00:00 IST."; "Lifetime access. No expiry."; the inactive badge "Not active", with "No access is active now." and "The next access starts …" on its own line, or "No printing access is active for this shop."; "Check again"; "Status unavailable" with its eight reasons; "Checking…", "Refresh", "Last checked" and "Last attempt"; and the staff-only message. Any other change needs a new approval.

The only action is **Refresh**. There are no controls to grant, extend, revoke or replace a licence.
The page shows the time of the last successful check, or of the last attempt when that failed.

Staff: no link. Opening the page directly shows "The licence status is shown to the shop owner
only." and sends **no** request.

## The RPC contract

Called through `web/src/owner-api.js` → `shopLicenceStatus(shopId)`:

```
POST /rest/v1/rpc/shop_licence_status
Authorization: Bearer <owner access token>
body: {"p_shop_id": "<uuid>"}
```

Defined in `supabase/migrations/0012_licence_admin_rpcs.sql` (`security definer`, `stable`,
`search_path = pg_catalog, public`). Execute is granted to `authenticated` only. It returns:

- Owner: `{"ok": true, "active": bool, "no_expiry": bool, "access_end": timestamptz|null, "next_start": timestamptz|null}`
- Anyone else, anonymous, or a null shop id: `{"ok": false, "code": "forbidden"}`

The RPC writes no denial row and changes no counter (decision H4; an explicit exception to A4).
`ACTIVE` gives `active = true`. `SCHEDULED` gives `next_start`. `REVOKED`, `EXPIRED` and `NONE`
all give the same inactive reply, so the screen cannot name the reason (see below).

**How this was checked.** The 0012 function text was run inside a transaction that ends in
`ROLLBACK`, on the local throwaway PostgreSQL 16.15 cluster (`stage7c_local`). Only the state
helper `public.shop_licence_state` was replaced by a stub that returns a fixed state. The ten
replies are saved in `web/tests/fixtures/licence-status-rpc.json`. This is **not** a Supabase run. No capture script or log for this run has been located in the worktree or the scratchpad (checked 2026-11-10), so the statement that the capture was made on 2026-11-08 is not backed by a saved log.

## Client rules

- The client never queries a licence table, never calls another licence RPC, and never calls
  `shop_licence_state`. A guard test checks this in the source.
- A reply is accepted only if it matches the contract exactly (`web/src/licence-status.js`,
  `parseLicenceStatus`). All five keys must be present. `active` cannot coexist with `next_start`,
  `no_expiry` cannot coexist with `access_end`, and every time must carry an explicit zone.
  Anything else is **malformed**, which is shown as unavailable.
- A missing session, an HTTP error, a network error, or offline all count as **unavailable**.
  Offline is decided by the device before any request is sent, so it is never shown as inactive.
- A **stale reply is dropped**. Every open and close starts a new generation. A reply for an
  earlier shop, or one that arrives after sign-out or navigation away, is ignored.
- **Overlapping Refresh presses share one request.** The button is disabled while a check runs.
- **Sign-out and leaving the page clear the data**, including any check still in flight.
- The client never shows a previous status as current. A refresh clears it first, and a failed
  refresh shows no status.
- No grace period and no expiry extension is invented. A time that is already past only triggers
  "Check again". It never changes the state to active or inactive.

## Not shown, and why

| Item | Reason |
|---|---|
| Coverage start | The RPC does not return it |
| Expired vs revoked vs never licensed | The RPC gives one inactive state for all three |
| Scheduled end, or the reason for a scheduled start | The RPC returns only `next_start` |
| Admin notes, actor IDs, audit rows, denial counts, payment references, coverage IDs, revocation reasons | Decision D excludes them; the RPC does not return them |
| Whether an admin grant may show a label | Still open (decision 19). Not shown |
| Printing status line | Removed on 2026-11-09 (approved P1) until Stage 7F enforcement exists. The screen says nothing about printing |
| Printing enforcement | Stage 7F. Not implemented. Nothing on this screen blocks or allows printing |

## Limitations

- **Manual refresh only.** The status is checked when the page opens and when Refresh is pressed.
  It does not poll.
- **The device clock** decides only whether to show "Check again". The server decides the status.
- **Wording.** The labels are owner-approved (2026-11-09, item 13 / decision 19; P1–P9, and confirmations W1–W3
  for the inactive sentence, the muted badge and the scheduled wording). Any other change needs a new approval.
- **The Android switch is checked in a browser only.** The browser check serves `config.js` with
  `ownerApp: true`, the setting the Android bundle uses. The APK was not built or run.
- **The contract is not applied anywhere.** On a real project, the screen will show "Status
  unavailable" (service missing) until the migration is applied. That depends on the migration plan
  (owner decision 6). Nothing has been renumbered or applied.
- **Android is not built or run** (`mobile/` is built only in GitHub Actions; the APK has never been built).

## Verification level

| Level | What ran | Result |
|---|---|---|
| Unit, mocked (`node --test`) | `tests/licence-status.test.js`: contract (incl. the 10 captured replies), failure reasons, display rules, controller (shop switch, sign-out, refresh de-duplication, offline, stale replies), static guards (including the approved-label guard), Android switch-off (3 of these are new) | **46 of 46** |
| Unit, mocked | `tests/owner-api.test.js`: the RPC call, signed-out, missing function | **14 of 14** (3 new) |
| Full `web/` suite | `npm test` (includes the two files above) | **212 of 212** |
| Browser, mocked network, 390 px | `tests/browser/licence-smoke.cjs` (Supabase replaced by `page.route`). Runs the web build, then a fresh context with `config.js` served as the Android bundle (`ownerApp: true`) | **33 of 33** |
| Database shape check | Local throwaway PostgreSQL, rolled back, stubbed state helper (see above) | 10 replies in the fixture; no capture log located (see above) |
| Supabase integration (hosted or staging) | **Not run.** There is no staging database and the migrations are not applied | **Gate** (below) |
| Regression, existing browser smokes | `owner-smoke.cjs`, `stats-smoke.cjs`, `features-smoke.cjs` run against this branch and against baseline `5c82d37` | **Identical outcomes on both.** Pre-existing failures: owner 3 (run stops after 34 checks), stats 1, features 3. Not caused by 7E and not fixed here |

The mocked tests and the mocked browser run use fake replies. Only the database shape check ran
against a real Postgres, and it uses a stubbed state function. The coverage rules were not run.

## Remaining gates

1. **Migration plan (decision 6).** No renumbering and no application until the owner approves the
   integration plan. The RPC's file name and number are set by that plan. This doc calls it `0012`
   until then.
2. **Real Supabase integration test,** after decision 6 and a separate staging approval: an owner
   sees their shop's status; staff and another owner are refused; a call with an expired session
   is refused. The owner-membership check is exercised by a real signed-in owner.
3. **Commit, push, PR, merge, deployment:** each needs its own approval. None has been given.
4. **7F is separate.** Printing enforcement needs C-1 (lawyer review) and C-3 (owner policy), plus
   M1 and an approved held-file release policy (decisions 3–5). 7E does not depend on these and
   enforces nothing.
