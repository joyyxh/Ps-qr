# Stage 7C operational procedures (DRAFT for owner approval)

**Status: DRAFT. Not approved, not executed, not verified.** These procedures are written so the owner can approve, amend or reject them. Under `STAGE7_DECISIONS.md` §13 (2026-11-04, A3; O6; O7), the emergency-disable, break-glass and admin-recovery procedures must be approved before 7C implementation sign-off. Nothing here has been run on any Supabase project, staging or production. Where a step relies on a dashboard feature that has not been checked, the step says so.

Placeholders: `<ADMIN_USER_UUID>`, `<SHOP_UUID>`, `<REPLACEMENT_USER_UUID>`. Never put a real UUID, token, password or secret in this repository. Use placeholders and keep the operator's log outside the repository.

**E-labels.** The labels E1 to E7 are not defined in any file in this repository, and none of them is confirmed. Each reference below cites the section that answers its content. The label itself stays OPEN until the owner confirms which label list is authoritative (earlier review notes use E1 to E7 for different items).

**Evidence levels.** This document keeps four levels apart. Only the first two have happened for Stage 7C.

| Level | What it means | Status on 2026-11-08 |
|---|---|---|
| Local implementation | SQL, app and test files written in the worktree | Done for migrations 0011, 0012 and 0013. Untracked, never committed, not applied to any database. Admin panel built locally. |
| Local testing | Runs on this machine only: the throwaway PostgreSQL 16 database `stage7c_local`, and the browser smoke test with every request stubbed | Logged results only; none is staging or hosted evidence. 2026-11-07: `rpc_tests2.log` 145 passed, 0 failed; `rpc_tests.log` (earlier run, same day) 134 passed, 3 failed; `hash_vectors.log` 41 passed, 0 failed. 2026-11-08: `read_run2.log` and `read-api-run.txt` 125 passed, 0 failed; `read_run1.log` 124 passed, 1 failed (AR-04, cause not recorded); `bw-targeted.txt` BW-01 to BW-06, 6 passed. 2026-11-10: admin `npm test` 72 passed; web `npm test` 212 passed; web browser smoke (`licence_smoke.log`) 33 passed. No log exists for the 282-check RPC suite, the 44-check hash suite or the 65-check browser smoke cited in earlier versions of this document. The 2026-11-07 and 2026-11-08 logs predate the last edits to `rpc_tests.py`, `read_api_tests.py`, `00_local_shims.sql` and `hash_vectors.py` (2026-11-10 06:34 and 2026-11-07 18:46), so none of them shows that the current test files pass. |
| Staging verification | The same tests on a staging project, after owner approval | Not started. Not approved (O12). |
| Hosted verification | Checks on a real Supabase project, including hosted AAL2 (O11) | Not started. Not approved. |

---

## 1. Scope and current facts

- Stage 7C covers the admin RPCs (grant, extend, revoke, replace), the owner read RPC `shop_licence_status`, and denial logging. Admin disable is not in 7C (O6).
- **Current state:** `0011_licence_foundation.sql` and `0012_licence_admin_rpcs.sql` exist only as untracked files in the worktree. They are not applied to any database. `0013_licence_admin_read_rpcs.sql` is also untracked and unapplied, with a provisional number (`STAGE7_DECISIONS.md` §13A, S9). Final migration numbers are **OPEN** (E7). Local `main` already has different migrations numbered 0011, 0012 and 0013 (section 7).
- **Only current disable route:** the break-glass SQL in `STAGE7_DECISIONS.md` §12A.3.
- **Admin list:** `public.platform_admins (user_id, created_at, disabled_at)`. No API or UI path adds admins. Rows are added by a one-time SQL statement run by the owner in the Supabase dashboard.
- **Append-only records:** `licence_coverages` (one revocation update only), `licence_audit_log`, `licence_requests`, `licence_denials`. Denial counters may not decrease. `shop_licence_meta.state_version` must increase by exactly one per update. The 0011 guards refuse DELETE and TRUNCATE. Local tests confirm this for the superuser role (GD-02, GD-08 to GD-12). **Not verified on any hosted project.**

---

## 2. Emergency disable and recovery

**When:** an admin account is suspected of compromise or misuse. The owner decides. No automatic trigger exists.

**Who:** the owner only, through the Supabase dashboard SQL editor (§12A.3). One person runs the steps. A second person reviews them where available. The second-person rule is **OPEN**.

**Preconditions**

1. Identify the target by Auth user UUID from the dashboard user list. Never infer it from an email address or a name.
2. Count active admins:
   `select count(*) from public.platform_admins where disabled_at is null;`
   If the target is the only active admin, do **not** disable it. Complete section 4 first (add and verify a replacement), then disable.
3. Write the reason, the time and the operator in the owner's change log, outside this repository.

**Steps (not yet run)**

1. Open a transaction in the SQL editor.
2. Disable the target. Expect exactly one row:
   `update public.platform_admins set disabled_at = clock_timestamp() where user_id = '<ADMIN_USER_UUID>' and disabled_at is null;`
3. Confirm the change:
   `select user_id, disabled_at from public.platform_admins where user_id = '<ADMIN_USER_UUID>';`
4. Commit only if step 2 changed exactly one row and step 3 shows a timestamp. Otherwise roll back and record the reason.

**Lock-first rule (O7).** If the same transaction writes any licence table, call `select public.licence_lock_shop('<SHOP_UUID>', 'exclusive');` before the first write, once for each affected shop. A change to `platform_admins` alone writes no licence table and needs no shop lock.

**Verification (to run on staging before relying on this route; not yet run).** The disabled user's admin RPC calls return `forbidden`, and `is_platform_admin()` returns false for that user.

**Recovery of a disabled admin:** the same statement with `disabled_at = null`, under a separate approval (**OPEN**). Section 4 gives the re-enable statement.

**Known gaps**

- Break-glass actions are not written to `licence_audit_log`, because audit rows are written only by RPCs. The operator's change log is the only record. Whether to add a dashboard log is **OPEN**.
- The rules "no self-disable" and "the last active admin is protected" (§12A.8, R11) apply to any future disable path. This route checks the count by hand (step 2 above).

---

## 3. DB-owner break-glass access and recovery (O7)

**Scope:** emergencies that no RPC can handle, for example a corrupt row or a defect in an RPC. Routine grants, extends, revokes and replaces go through the RPCs only.

**Access**

- Holders of owner-role dashboard access: **OPEN**. The owner names them. Use named accounts. No shared logins.
- MFA on the Supabase account and on the admin user: **not confirmed** (decision 14; item 5, OPEN).

**Procedure (not yet approved)**

1. Write the reason and the expected effect in the change log before starting.
2. For every affected shop, take the lock first in the same transaction: `select public.licence_lock_shop('<SHOP_UUID>', 'exclusive');` (O7).
3. Make the smallest possible change. Prefer one statement per transaction.
4. Check the result with read-only queries. Check `shop_licence_status` and `shop_licence_state` for each affected shop.
5. Record the before and after values of each changed row (no secrets), the transaction time, the operator and the reviewer.

**Prohibited, including for the owner**

- DELETE or TRUNCATE on any append-only table listed in section 1.
- Manual writes to `licence_coverages` other than the one-time revocation, or to `shop_licence_meta.state_version`.
- Manual writes to `licence_requests` or `licence_audit_log`.
- Setting `session_replication_role` to `replica`. Triggers, including the 0011 guards, do not fire in that mode. This is standard PostgreSQL behaviour and was **not tested here**. The owner's runbook must forbid it.
- Ad hoc edits to functions in the dashboard. A defect in an RPC needs a reviewed forward migration with owner approval.

---

## 4. Admin access recovery when every platform admin is unavailable

**Scenarios**

- A. Every admin row is disabled.
- B. The only admin has lost the TOTP factor, so admin RPCs refuse the session (`aal2` is required).
- C. The only admin's Auth user has been deleted. `platform_admins.user_id` has `on delete restrict`, so the user cannot be deleted while the row exists. Confirm this on staging.

**Steps (not yet run; steps 3 and 5 depend on features that are not verified)**

1. Sign in to the Supabase dashboard as the organisation owner (section 3 access rules).
2. Identify the replacement Auth user UUID `<REPLACEMENT_USER_UUID>` from the dashboard user list. If a new user is needed, create it in the dashboard and record the UUID. Never copy a UUID from elsewhere.
3. Scenario B only: remove the lost TOTP factor for the admin user through the dashboard, if the dashboard offers this. **Not verified.** Check it on hosted staging first (O11).
4. Add or re-enable the admin with the one-time statement (§12A.3). This statement also re-enables a disabled row, so use it only for a row the owner has identified:
   `insert into public.platform_admins (user_id) values ('<REPLACEMENT_USER_UUID>') on conflict (user_id) do update set disabled_at = null;`
5. Enrol TOTP for the admin account. Sign in and confirm that an admin RPC request carries `aal = aal2` before any protected operation is attempted.
6. Record the event: date, reason, UUID used, operator and reviewer.

**Open decisions:** the procedure text for a lost TOTP factor (decision 14; item 5, **OPEN**); whether at least two admins are required (decision 13, **OPEN**); staging tests of steps 3 to 5 (O11; execution **not approved**).

---

## 5. Rollback and recovery for the 7C RPC migration

**Current state.** Nothing is applied, so there is nothing to roll back in any database. Before commit, the owner may ask for the untracked files to be removed from the worktree. That needs approval and is not part of this document.

**After a staging apply (not approved).**

- **Preferred:** a forward-fix migration, reviewed and approved. Do not reverse in place.
- **Function-only rollback:** drop the 0012 functions and their grants. This removes the RPCs and keeps the 0011 tables and their records. It needs a reviewed migration, approval, and a staging run first.
- **Table rollback (dropping 0011 tables):** destructive. The guards refuse DELETE and TRUNCATE, so this needs an owner-approved break-glass step. It discards ledger, audit and denial evidence. **Not recommended.**
- **Test data:** coverage rows, ledger rows, audit rows and denial counters cannot be deleted or reduced. Test state is therefore reset only by a fresh staging database. Remove test grants with the revoke RPC, not by deletion.
- **The `licence_config` staging row:** under `STAGE7_DECISIONS.md` §13A S1 (E1), 0012 refuses every backdate when the row is absent. Removing the row therefore stops backdating, which is the safe direction. Production has no row, so it refuses every backdate until decision 5 sets a window. The 0012 change is local and unapplied. The backdate-window checks BW-01 to BW-14 passed on 2026-11-08 against the 0012 file of that date (`bw-targeted.txt`, `read_run1.log`, `read_run2.log`, `read-api-run.txt`). `rpc_tests.py` and `read_api_tests.py` changed on 2026-11-10, so those results do not show that the current test files pass.
- **Before any staging apply:** take a backup or check point-in-time recovery, if the plan supports it. **Not verified.**
- **Production:** no apply is approved. The migration list and live signatures are **OPEN** (items 25 and 26).

**Checks after any rollback or re-apply (staging only, not yet run)**

- RPCs are not callable by `anon` or `service_role`.
- The 0011 guards are still in place.
- Ledger, audit and denial counts are unchanged except for the expected test rows.

---

## 6. Staging verification checklist (NOT approved to start)

**Preconditions. Each needs its own approval.**

- Staging project creation (O12): **not approved**.
- SQL execution on staging: **not approved**.
- `0010` applied to a staging copy, and a pre-staging review of 0011 (O2): **OPEN**.
- A synthetic admin account for the AAL2 checks (§15.2): **not approved**.
- Final migration numbers (E7; §13A S9): **OPEN**. 0013 is provisional and collides with a local `main` file (section 7).
- The fail-closed backdating change in 0012 (E1; §13A S1): **made locally** under the owner's 2026-11-08 instruction for local implementation. Not applied anywhere. Applying it to staging: **not approved**.

**A. Hosted AAL2 (O11; objective checks only)**

- [ ] Admin account with TOTP enrolled. A sign-in produces a token with `aal = aal2`.
- [ ] An admin RPC succeeds with an `aal2` token, in a test that makes no committed change beyond its own test shop.
- [ ] An `aal1` token is refused with a committed `forbidden` and a denial row.
- [ ] A token with no `aal` claim is refused the same way.
- [ ] The recovery steps in section 4, step 3, are tested, after confirming the feature exists.
- Record: project reference (not a secret), dates, and the claim values seen. Never record the tokens.

**B. Concurrency (item 33; R18 lock map; two sessions)**

- [ ] Grant and revoke on the same shop, in both orders: one version step, no lost update.
- [ ] Replace and revoke on the same target: one succeeds, the other gets a committed rejection, and no partial state is left.
- [ ] The same `request_id` and payload from two sessions: one commit and one replay.
- [ ] The same `request_id` with a different payload: a committed conflict.
- [ ] Concurrent denials from one actor: each denial adds one to each counter (local analogue: CD-01).
- [ ] An admin write and a print-gate read on the same shop: no deadlock and a consistent result.
- [ ] No deadlock over repeated runs in both orders.
- Record: session timings, lock waits and results.

**C. Staging matrix**

- [ ] Every item in `STAGE7_DECISIONS.md` §12A.11 and §12B.11 that has not been run on staging.
- [ ] The 31-day staging window boundaries (BW tests).
- [ ] Future starts (E6; §12A Grant, clarified 2026-11-07): a `one_month` or `one_year` start later than now is refused as `future_start_not_allowed`, on Grant and Replace. Lifetime future starts are allowed. **Custom future starts: OPEN** for the owner. Do not test them as accepted or refused until that is decided.
- [ ] Replace audit rows (E5; §12A Replace, clarified 2026-11-07): two rows, both `replace`, sharing one `request_id`.
- [ ] `shop_licence_status` (E4; §12A, H4 correction 2026-11-07; §13A S2): owner only, through `is_shop_owner`. Staff, other users and anonymous callers are denied with no denial row. Local tests H4-01 to H4-04 (`read_api_tests.py`) cover this. No staging run yet.
- [ ] Fail-closed backdating (E1; §13A S1): with no window row, every backdate is refused. The change is in 0012 (unapplied). Local tests BW-05 (`rpc_tests.py`) and BW-07 to BW-14 (`read_api_tests.py`) cover it. No staging run yet. Production window value: **OPEN** (decision 5).
- Local results (the logged RPC, hash and read-API runs in the Local testing row, all on a local throwaway database) are **not** staging evidence.

**D. Evidence and sign-off**

- Record the date, the environment name, the commit SHA (once approved), the test IDs, pass or fail, the operator and the reviewer. No secrets, tokens or personal data beyond what the tests need.
- Any failure stops the checklist. A fix needs a new reviewed change, and then a re-run.
- A passing staging run does not approve production.

---

## 7. Open blockers (carried from the decision records)

- E1 (§13A S1): resolved locally. 0012 fails closed on an absent window row. The production window value stays **OPEN** (decision 5). No staging run.
- Final migration numbers (E7; §13A S9): **OPEN**. Local `main` has diverged from origin/main (one commit ahead, four behind). Its unpushed commit `37e4623` adds `0011_service_options.sql`, `0012_print_eligibility.sql`, `0013_order_workflow.sql` and `0014_create_shop_confirmed_email.sql`. origin/main ends at 0010. The owner must decide the numbering before any apply, merge or integration.
- Hosted AAL2 verification and recovery (O11). Local claim verification is **OPEN** (decision 14).
- Approval of the emergency-disable, break-glass and admin-recovery procedures in this document (A3, O6, O7).
- Staging project creation and its approvals (O12): **not approved**.
- Production backdating window value (decision 5). Production denial-detail cap (decision 5; O9). Production admin identity and MFA (item 5; decision 14).
- Legal retention periods and DPDP review (§4; Part 6).
- Alert threshold and alert mechanism (O9): **OPEN**. No alerting is implemented or claimed.

---

## Approval (blank; not signed)

Approved by: ______________________  Date: ____________  (not approved until completed by the owner)
