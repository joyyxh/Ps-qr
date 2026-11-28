# Owner sign-in fix: database catch-up (0010, 0018, 0019, 0020)

Status (2026-11-21): the fix is written and tested on a clean PostgreSQL 16 database, including the UPI order
fix in `0020_upi_order_and_print_hardening.sql`. The PostgreSQL 17 rehearsal in CI (`owner-catch-up-rehearsal`) passes.
It is **not applied** to the live Supabase project (`qvnwqrevgyootaaunrto`). Applying it needs the owner's
approval, because it changes the hosted database.

## The error

The owner app shows `column shops_1.auto_print_enabled does not exist` at sign-in.

## Root cause

The live project stopped at migration 0009. Its migration history (read-only, 2026-11-19) ends at
`cash_policy_and_payment_hardening`. The branch that the app was built from has migrations 0010, 0015 to 0019
and 0020 on top of that, and none of them were applied to the live project. 0018's own header says
"NOT yet applied to the live project".

The owner app asks for `shops.auto_print_enabled` at sign-in (`listMyShops` in
`web/src/owner-api.js`, called from `web/src/owner.js` lines 864 and 958). That column is created by
0018, so PostgREST rejects the whole sign-in with the error above.

Read-only check of the live project, 2026-11-19: every object that 0010, 0018 and 0019 create is
absent (`shops.auto_print_enabled`, `print_jobs`, `print_agents`, `rate_limits`,
`customer_files.storage_deleted_at`, `owner_print_status`, `set_auto_print`, `approve_order_for_print`
(0010 version), the `orders_auto_print` trigger, `shop_memberships_user_id_idx`).

What this is not:

- Not a query bug. The owner query is correct for the schema the branch defines.
- Not an obsolete column. The column is the intended switch: boolean, not null, default false, changed
  only by the owner through `set_auto_print`, and read by the order trigger.
- Not something to replace with another field. The intended behaviour is "optional automatic printing
  per shop, off by default".

## The UPI order error

Every UPI order failed with `customer payment method is immutable` (42501). The four-argument `place_order`
(0009) inserted each order as cash, then changed it to UPI. The payment guard (0008) forbids that change.
`0020_upi_order_and_print_hardening.sql` writes the payment method in the same insert that creates the order.
The guard is unchanged, so the payment method is still fixed once the order exists.

## What changed in the repository

No application code changed. The client was already correct; the database was behind it.

- `supabase/tests/owner_catch_up/run_catch_up.sh`: reproduces the error on the 0001 to 0009 state,
  applies 0010, 0018, 0019 and 0020 in order, and checks the owner query, the auto-print RPC rules and the
  browser-role rules. Local or CI throwaway databases only.
- `supabase/tests/owner_catch_up/01_seed.sql`, `02_owner_shops_probe.sql`, `03_auto_print_rpc.sql`:
  the seed, the owner's sign-in query, and the RPC and browser-role checks.
- `supabase/tests/owner_catch_up/preflight_hosted.sql`: read-only check for the live project, before
  and after the catch-up.
- `supabase/tests/stage9_upi_tests.sql`: twelve UPI checks, one transaction, rolled back.
- `supabase/migrations/0020_upi_order_and_print_hardening.sql`: the UPI order fix and the browser EXECUTE removal.
- `web/tests/owner-schema-contract.test.js`: five static checks. Every RPC the owner and customer apps
  call is created by a migration; every shop column in the owner query exists; `auto_print_enabled` is
  added once, by 0018, off by default; 0018 comes after 0010.
- `web/package.json`: adds the new test to `npm test`.
- `.github/workflows/stage7-tests.yml`: the `licence-postgres` job also runs `run_catch_up.sh`.
- `.github/workflows/owner-catch-up-rehearsal.yml`: the PostgreSQL 17 rehearsal, on the feature branch only.
- The deployment package in `supabase/deploy/owner_catch_up/` (runbook, rehearsal, guarded rollback, checksums).
- This file.

No new migration is needed for the sign-in fix. The fix is to apply the reviewed migrations to the live
project, in order: 0010, 0018, 0019, then 0020 for UPI.

## Why 0010 must come first

Mutation test: 0018 applied alone installs, and the owner screen then works. But 0018's
`_queue_order_for_print` writes into `print_jobs`, which only 0010 creates. Once an owner switches
automatic printing on, approving a paid order with files would fail. So 0010 is a hard prerequisite.
(Checked by reading the functions; the approve-and-pay path was not run end to end on the live project.)

0020 must come after 0018, because it removes EXECUTE from `auto_print_on_approval`, which 0018 creates.

## Behaviour changes on the live project, for the owner to accept

- 0010 creates four print tables, closed to browsers, and the print RPCs. It adds `storage_deleted_at` to
  `customer_files`. It drops and recreates `track_order`: same fields, plus a limit of 30 lookups per minute
  per connection. Customer tracking keeps working.
- 0018 adds the switch (off for every shop) and the trigger. Nothing is queued automatically until an
  owner turns the switch on. It recreates `approve_order_for_print` to queue the same files as before.
- 0019 replaces the membership read policy with the same rule and adds seven indexes. It does not
  change who can see what.
- 0020 replaces `place_order` (both overloads) so that UPI orders can be placed. Cash orders behave as before.
  It removes browser EXECUTE from the auto-print trigger function; the trigger still fires.
- No data is deleted or changed. There are no down migrations; the safe rollback is to leave the new
  objects in place.

## Not included: licence migrations 0015 to 0017

These are separate, and need their own decision. 0015 says its pre-staging review (O2) is still
required, and 0016 says the production licence value is open. Until they are applied, the "Licence
status" screen will show an error. The sign-in fix does not depend on them: the licence read is only
made when that screen is opened.

## Steps (need the owner's approval)

The exact SQL, the read-only pre- and post-checks, the gates, the guarded rollback and the local rehearsal
are in `supabase/deploy/owner_catch_up/RUNBOOK.md`. None of the steps below has been run against the
hosted project.

1. Run `supabase/tests/owner_catch_up/preflight_hosted.sql` on the live project. Expect every row to be
   `false`.
2. Apply `0010_print_agents.sql`, then `0018_auto_print.sql`, then `0019_advisor_fixes.sql`, then
   `0020_upi_order_and_print_hardening.sql`, one at a time, checking each succeeds. Do not skip any, do not
   apply 0018 without 0010, and do not apply 0020 before 0018.
3. Run the preflight again. Expect every row to be `true`.
4. If the owner screen still shows the old error a few minutes later, the API's schema cache is stale.
   Reload it with `NOTIFY pgrst, 'reload schema';`. This is not expected on Supabase.
5. Sign in as a real owner (not a test account) on the Android app or the web app. The shop list should
   load, and the orders screen should open.

## Tests run

2026-11-21 (adds 0020):

- `run_catch_up.sh` on a clean PostgreSQL 16.15: passes, including the browser-role check on `auto_print_on_approval`.
- `rehearse.sh` on PostgreSQL 16.15: passes. Stage 8: 48 ok. Stage 9 (UPI): 12 ok. Full rollback restores the 0009 state exactly.
- Stage 9 on the staging project (not live): 12 of 12, rolled back.
- Base SQL suites: eight suites, 282 checks, on PostgreSQL 16.
- PostgreSQL 17.12: `owner-catch-up-rehearsal` passes (run 44881267088): `rehearse.sh`, `run_catch_up.sh` and the base suites.

2026-11-19 (0010, 0018, 0019):

- `npm test` (web): 243 of 243 pass. The 5 new contract tests are included.
- `npm test` (admin): 72 of 72 pass.
- `run_catch_up.sh` on a clean PostgreSQL 16.15: passes. Step 2 reproduces
  `column s.auto_print_enabled does not exist` on 0001 to 0009; steps 4 and 5 pass after the catch-up.
- Mutations, to show the checks can fail: without 0018, the owner query fails with the reported error;
  with 0018 removed or the column renamed in the client only, the contract test fails.
- `licence_7c/run_suites.sh` on the same PostgreSQL 16 cluster: all four steps pass.
- Browser checks, mocked backend: owner-smoke 43 of 43, owner-shell-smoke 41 of 41, registration-smoke
  13 of 13.

## Not verified

- The live project. The sandbox cannot reach `supabase.co`, and nothing has been applied. The
  preflight results above are read-only catalogue queries.
- That PostgREST on the live project behaves like the local PostgreSQL 16 cluster, which uses shims for
  the Supabase `auth` schema.
- PostgreSQL 17.11 (the hosted version) behaviour on the live project; the CI rehearsal ran on 17.12.
- The owner's real sign-in on a device after the catch-up.
