# Owner sign-in fix: database catch-up (0010, 0018, 0019)

Status (2026-11-19): the fix is written and tested on a clean PostgreSQL 16 database. It is **not
applied** to the live Supabase project (`qvnwqrevgyootaaunrto`). Applying it needs the owner's
approval, because it changes the hosted database.

## The error

The owner app shows `column shops_1.auto_print_enabled does not exist` at sign-in.

## Root cause

The live project stopped at migration 0009. Its migration history (read-only, 2026-11-19) ends at
`cash_policy_and_payment_hardening`. The branch that the app was built from has migrations 0010 and
0015 to 0019 on top of that, and none of them were applied to the live project. 0018's own header says
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

## What changed in the repository

No application code changed. The client was already correct; the database was behind it.

- `supabase/tests/owner_catch_up/run_catch_up.sh`: reproduces the error on the 0001 to 0009 state,
  applies 0010, 0018 and 0019 in order, and checks the owner query and the auto-print RPC rules.
  Local or CI throwaway databases only.
- `supabase/tests/owner_catch_up/01_seed.sql`, `02_owner_shops_probe.sql`, `03_auto_print_rpc.sql`:
  the seed, the owner's sign-in query, and the RPC and browser-role checks.
- `supabase/tests/owner_catch_up/preflight_hosted.sql`: read-only check for the live project, before
  and after the catch-up.
- `web/tests/owner-schema-contract.test.js`: five static checks. Every RPC the owner and customer apps
  call is created by a migration; every shop column in the owner query exists; `auto_print_enabled` is
  added once, by 0018, off by default; 0018 comes after 0010.
- `web/package.json`: adds the new test to `npm test`.
- `.github/workflows/stage7-tests.yml`: the `licence-postgres` job also runs `run_catch_up.sh`.
- This file.

No new migration is needed for the sign-in fix. The fix is to apply the three existing, reviewed
migrations to the live project, in order.

**Not covered by this runbook: `0020_upi_order_and_print_hardening.sql`.** It was added afterwards. It
fixes UPI orders (every UPI order failed with "customer payment method is immutable") and removes
anon and authenticated EXECUTE on `auto_print_on_approval`. It is not yet in this runbook, `rehearse.sh`,
`SHA256SUMS`, `ledger.sql` or `rollback.sql`. Live needs it before UPI orders work there. Adding it needs
the same PostgreSQL 17 rehearsal and owner approval as the three migrations above.

## Why 0010 must come first

Mutation test: 0018 applied alone installs, and the owner screen then works. But 0018's
`_queue_order_for_print` writes into `print_jobs`, which only 0010 creates. Once an owner switches
automatic printing on, approving a paid order with files would fail. So 0010 is a hard prerequisite.
(Checked by reading the functions; the approve-and-pay path was not run end to end.)

## Behaviour changes on the live project, for the owner to accept

- 0010 creates four print tables, closed to browsers, and the print RPCs. It adds `storage_deleted_at`
  to `customer_files`. It drops and recreates `track_order`: same fields, plus a limit of 30 lookups
  per minute per connection. Customer tracking keeps working.
- 0018 adds the switch (off for every shop) and the trigger. Nothing is queued automatically until an
  owner turns the switch on. It recreates `approve_order_for_print` to queue the same files as before.
- 0019 replaces the membership read policy with the same rule and adds seven indexes. It does not
  change who can see what.
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
2. Apply `0010_print_agents.sql`, then `0018_auto_print.sql`, then `0019_advisor_fixes.sql`, one at a
   time, checking each succeeds. Do not skip any, and do not apply 0018 without 0010.
3. Run the preflight again. Expect every row to be `true`.
4. If the owner screen still shows the old error a few minutes later, the API's schema cache is stale.
   Reload it with `NOTIFY pgrst, 'reload schema';`. This is not expected on Supabase.
5. Sign in as a real owner (not a test account) on the Android app or the web app. The shop list should
   load, and the orders screen should open.

## Tests run (2026-11-19)

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
- The owner's real sign-in on a device after the catch-up.
