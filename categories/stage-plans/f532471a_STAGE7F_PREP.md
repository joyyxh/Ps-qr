> Numbering note (2026-11-10 reconciliation): D-MIG is NOT approved, and the licence files are back at 0011 to 0013. Any 0015 to 0018 mention below is the unapproved proposal only. See scratchpad/reconciliation_2026-11-10/03_migration_conflict_report.md.

# Stage 7F: preparation (documentation only; no enforcement code, migration, SQL, deployment or UI change)

Status: rewritten 2026-11-09; updated 2026-11-10 for the owner-authorised working defaults (register §13E). Nothing here is implemented, applied, committed, pushed, deployed or enabled. Enforcement stays off.

Sources read (read-only): local `main` at `37e4623` (Chain A, unpushed), the stage 7 worktree `/home/claude/joyyxh/ps-qr-stage7` (HEAD `5c82d37`, with untracked 0011 to 0013), `STAGE7_DECISIONS.md`, the agent source, the print-agent edge function, and the web source for the owner and customer labels. No hosted database, staging database or edge function was touched.

Companion documents (this folder):
- `STAGE7F_ITEM33_PLAN.md`: lock placement against Chain A bodies, cases, two-session tests (T33-1 to T33-11, T33-A to T33-H), rollback.
- `STAGE7F_Q4_CONTRACT.md`: refusal behaviour, residual R-Q4-1, Options A and B, edge cases, tests (section 10).
- `STAGE7F_ITEM32_KILL_SWITCH.md`: kill-switch design draft. Not approved.

Register: `/home/claude/joyyxh/ps-qr-stage7/STAGE7_DECISIONS.md`. Approved decisions are in §13C. Pending decisions are in §13D (added 2026-11-09, not approved).

## 1. Decision status

### 1a. Approved (preserved; not reopened; not asked again)

| Item | Approved (2026-11-09) | Preparation effect |
|---|---|---|
| Item 33 lock order | Shared licence-meta lock (`licence_lock_shop(shop, 'shared')`) before the order, agent and job locks in `approve_order_for_print`, `agent_claim_next_job` and `agent_mark_printing`. Placement only | Plan rebased to Chain A bodies. Code and two-session tests still need their own approvals |
| Retry | Excluded until item 23 reverses its job-first order | `retry_print_job` takes the job lock before the order (0010 line 515). Not placed |
| Q2 hold start | The time the shop left ACTIVE, derived from the coverage end or revocation instant, never using a future coverage end as a past hold start. No stored marker | Not used until M1 is approved. Never-ACTIVE start is pending (1b) |
| Q4 | A licence refusal returns the job to `queued` without incrementing `claim_count` | Contract prepared. Mechanism is pending (1b) |
| C-3 | Enforcement held back. Disabled until M1 and the held-file release policy are approved | Enabling is blocked |
| Existing 7E labels and UI decisions | Unchanged | No owner-app change in this step |
| Gates | No enforcement while legal, migration, staging and operational gates remain open | Build and enable approvals are not given |

### 1b. Pending, or decided by an owner-authorised working default (register §13D, §13E)

| ID | Question | Recommendation (not approved) |
|---|---|---|
| D-Q4 | Mechanism for the approved Q4 refusal: Option A (two calls) or Option B (atomic refusal in mark) | OWNER-AUTHORISED WORKING DEFAULT (2026-11-10): Option A as drafted. Refusal at mark time writes nothing. Release reverses the increment. A failed release leaves it until lease expiry. Option B not adopted (section 3) |
| D-Q5 | Owner wording, placement and approve refusal text for held jobs | OWNER-AUTHORISED WORKING DEFAULT (2026-11-10) for the wording in section 4. Placement and approve refusal text need a UI change under their own approval |
| D-Q5b | Customer tracking label for held orders (`Printing`) | OPEN. No customer wording change without an approved decision (lawyer review through C-1) |
| D-I32 | Kill-switch design approval and sub-decisions a to e | Pending. Not in the owner's default list. Approve as drafted (section 5) |
| D-HS | Hold start for a shop that was never ACTIVE | OPEN. Prior-ACTIVE rule applies. Clamp not adopted (section 6) |
| D-MIG | Migration numbers (owner decision 2) | OWNER-AUTHORISED WORKING DEFAULT (2026-11-10): Chain A 0011 to 0014 kept. Stage7 licence files renamed to 0015 to 0017 in the stage7 worktree. 0018 reserved for 7F. Hosted history not verified |
| D-R18-T2 | R18 two-session test 2 expectation | Pending. Not in the owner's default list. Re-approve under Option A (section 3) |

### 1c. Other status

| Item | Status |
|---|---|
| Q1 base | DECIDED 2026-11-01 (origin/main lineage) |
| C-1 lawyer review | NOT DONE. Mandatory before the 7F build and before enabling |
| M1 held-job rule | PROPOSAL only. 7-day hold failure not approved |
| Held-file release policy | NOT APPROVED. Depends on C-1 |
| Item 32 kill switch | Draft design exists (scratchpad). Not approved |
| 7F migration number | NOT CHOSEN (D-MIG) |

## 2. Chain A facts (local `main` `37e4623`, unpushed; verified by reading only)

- Chain A adds `0011_service_options.sql`, `0012_print_eligibility.sql`, `0013_order_workflow.sql`, `0014_create_shop_confirmed_email.sql`.
- The 7F base for licence work is origin/main 0010 (Q1). Chain A rewrites the functions that 7F touches, so every base line number differs on Chain A.
- Number collision: resolved in the stage7 worktree on 2026-11-10 under the owner-authorised D-MIG default. The stage7 licence files are now 0015 to 0017. Chain A keeps 0011 to 0014 on local main. Not combined. Hosted history not verified.
- Chain A redefinitions:
  - `approve_order_for_print`: 0011 lines 647 to 706.
  - `agent_claim_next_job`: 0012 lines 98 to about 140.
  - `agent_mark_printing`: 0012 lines 156 to about 188. It takes the order lock at 0012 line 173.
  - New `order_is_printable` (0012 line 43) and trigger `cancel_unprintable_jobs` (0012 lines 58 to 95). The trigger takes order then jobs.
- Base 0010 today:
  - `approve_order_for_print` locks the order (line 451) before the owner check.
  - `agent_mark_printing` locks the job only (line 699).
  - `recover_expired_print_jobs` uses unlocked UPDATEs.
  - Recovery cap: claimed, expired, `claim_count >= 5` becomes `failed` with `too_many_claims` (0010 lines 208 to 211).
  - Claim sets `lease_until = now() + 2 minutes`. A successful mark sets 3 minutes.
- Owner-visible text:
  - `JOB_STATUS_LABELS` queued: "Waiting for a printing computer" (`web/src/logic.js`, lines 413 to 455).
  - `FAILURE_TEXT` `too_many_claims`: "The printing computer could not finish this job after several tries."
  - Customer `STATUS_LABELS` printing: "Printing".
- Owner status RPC `owner_print_status` (0010 lines 320 to 376) returns each job's status, `error_code` and `error_message` to any shop member, including staff.
- Retention: `expired_customer_file_paths` (0010 lines 785 to 810) keeps files for `queued`, `claimed`, `printing` and `needs_check`.
- `orders.shop_id` is immutable through `guard_order_changes` (0001 lines 137 to 170; `shop_id` check at 144 to 148). Chain A does not change it.

## 3. Q4 summary (full detail in `STAGE7F_Q4_CONTRACT.md`)

- Approved: a licence refusal returns the job to `queued` and does not increment `claim_count`.
- Option A (OWNER-AUTHORISED WORKING DEFAULT, 2026-11-10; refusal writes nothing): `agent_mark_printing` refuses with `licence_inactive` and writes nothing. The agent then calls a release RPC that reverses the claim's increment. Not atomic. A failed release leaves the increment until lease expiry.
- Option B (not adopted): the refusal is atomic inside mark, and the increment is reversed in the same transaction. Mark returns `{"refused":"licence_inactive"}` and reverses the increment in the same statement. The edge function maps it to HTTP 409, so the agent's non-2xx handling applies. Deploy order: database, then edge, then agent. Rollback order: reverse.
- Claim identity: claim never changes `attempt`, so a release keyed on (agent, attempt, status) could match a later claim by the same agent. The contract uses the `lease_until` value returned by claim as the claim token.
- Residual R-Q4-1 (accepted by the owner's working default): a failed release leaves the claim's +1 until lease expiry. Five unresolved refusals then trigger the recovery cap, which fails the job as `too_many_claims` with the misleading text in section 2. Option B removes this residual.

## 4. Q5: held-job wording (owner-authorised working default; no UI code changed)

Current state: a held job shows "Waiting for a printing computer", which names the wrong cause.

Owner-authorised text for a held job (2026-11-10):

> Printing is paused. This shop has no active QRquick licence, so this file will not print until the licence is active.

Why this text:
- It names the cause in general words only. It gives no licence state, reason code or admin detail.
- It makes no promise about deletion, time limits or what happens to the file. M1 and C-1 have not settled those.
- It does not say "stays in the queue". That is true only while C-3 holds enforcement back. If M1 is approved, the wording must change to say when jobs fail.

Placement (recommended):
- Replace the queued label for held jobs only. Other queued jobs keep the current label.
- The held flag is derived by the server and returned to the owner app. The browser never computes it.

Staff text (owner-authorised, 2026-11-10): "Printing is paused for this shop." Staff receive no licence information (decision A5).

Approve refusal (pending): plain English with the same meaning. Exact wording to be approved in D-Q5.

Earlier options A, B and C from the previous version of this file are superseded by the text above.

## 5. Item 32 kill switch (design draft, not approved)

Full design: `STAGE7F_ITEM32_KILL_SWITCH.md`. Summary:
- One global row, in a table with a check constraint, RLS on with no policies, no client grants, and no DELETE or TRUNCATE.
- Default `off`. Missing or invalid row is treated as `off` (D-I32-b). A database error fails the statement, so nothing prints.
- Emergency disable is a DB-owner break-glass action with one operator. Activation needs two operators and an `approval_ref` (D-I32-c). No client can reach the switch.
- Append-only audit table, written in the same transaction as each change.
- The switch is a leaf in the lock order. Print functions read it with a plain SELECT. They never take a lock on it.
- Activation needs a dry-run function (migration approval), staging tests S1 to S9, deployment verified with the switch off, and the owner decisions listed in the design.
- The break-glass script is not written.

## 6. Hold start analysis

- Approved: the time the shop left ACTIVE (section 1a). The derivation counts only coverage ends at or before the check time.
- Finding: `v_last_end` in `shop_licence_state` can include future periods, so the hold-start derivation must not reuse it as is.
- Open: a shop that was never ACTIVE has no derived start (D-HS).
- Clamp proposed earlier (NOT adopted; the 2026-11-10 default leaves never-ACTIVE OPEN): `start = max(derived instant, job created_at, enforcement enabled_at)`.
  - `job created_at` stops a never-ACTIVE shop from being held before its job existed.
  - `enforcement enabled_at` stops any hold from counting before enforcement starts.
- Interaction: decision 18 (no grace) is recommended but not approved. The clamp does not add a grace period.
- Not testable on staging until D-HS is decided.

## 7. Technical findings (no approval needed to record them)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | The edge function maps neither `licence_inactive` nor `order_not_printable`. Both fall to HTTP 500 `server_error` | Edge `mapDatabaseError` (lines 77 to 97), default 500 | The 7F edge change must map them |
| F2 | The agent treats any 2xx from printing as printed | Agent `api.mjs` (`AgentApiError`, `markPrinting` near line 52) | A refusal must be non-2xx (Option B uses 409) |
| F3 | `owner_print_status` returns `error_code` and `error_message` to staff | 0010 lines 320 to 376 | No licence reason may be stored in those fields |
| F4 | New lock class: the cancel trigger takes order then jobs. Recovery's unlocked updates can conflict with it | Chain A 0012 lines 58 to 95; case (o) and test T33-G in the plan | Needs D-R18-T2 and the rule 10 decision |
| F5 | Retry is still a 7F gate. It takes the job before the order | Base 0010 line 515; register line 592 | Needs a licence check after item 23 |
| F6 | The Send-to-printer button is shown for inactive shops | `web/src/owner.js` lines 961 to 963; `onSendToPrint` lines 1117 to 1123 | Owner UI decision with D-Q5 |
| F7 | Customer tracking shows "Printing" for held orders | Customer `STATUS_LABELS` | D-Q5b |
| F8 | `orders.shop_id` is immutable | 0001 `guard_order_changes` lines 137 to 170 (check 144 to 148). Read only, not tested | No change needed |
| F9 | Helper ownership and grants for the 0011 helpers were checked by reading only | 0011 helper grants | Not tested on any database |
| F10 | The web `call()` request shape was checked by reading only | `web/` source | Not tested |
| F11 | Whether the print-agent function is deployed on hosted Supabase is unverified | Register items 26 and 27. A hosted SQL login failed earlier with `28P01` | Hosted check needed (blocked) |
| F12 | Chain A and the stage7 licence files share numbers 0011 to 0013 | Section 2 | D-MIG |
| F13 | Retention keeps files for `queued`, `claimed`, `printing` and `needs_check` | 0010 lines 785 to 810 | Held files stay stored. Release policy pending under C-1 |
| F14 | The `too_many_claims` text is misleading for a licence-caused failure | Section 2 | Removed by Option B; under Option A it can still occur (R-Q4-1) |
| F15 | Claim lease is 2 minutes. A successful mark sets 3 minutes | Base 0010 | Bounds how long a missed release lasts |
| F16 | The worker treats any throw from `markPrinting` as "not printed", clears its journal, and does not release | `agent/src/worker.mjs` catch, about lines 257 to 265 | The agent needs a release or refusal branch |
| F17 | `v_last_end` in `shop_licence_state` can include future coverage periods | Register §13C (Q2 row) | The hold-start derivation must not reuse it as is |

Also: `STAGE7_DECISIONS.md` §12B.9 says "No test was run" for S-5. That text is stale because a local agent test exists. Correction needs the owner's record (S-5).

## 8. Blockers and gates

| # | Blocker | Status | Reference |
|---|---|---|---|
| B1 | C-1 lawyer review of the held-file release rule and customer-facing text | NOT DONE (mandatory) | §14.3 C-1; §12B.9 |
| B2 | C-3 | DECIDED 2026-11-09 (hold back) | §13C |
| B3 | M1 and the held-file release policy approved | NOT APPROVED | §12B.2; §12B.9 |
| B4 | S-4: 180-second file-link window accepted or reduced | NOT ACCEPTED | §14.4 S-4 |
| B5 | S-5: owner record of the local agent test | Test exists. Owner record missing | §14.4 S-5 |
| B6 | Item 25: live `place_order` signatures and grants | NOT DONE (owner dashboard) | §14.2 item 25 |
| B7 | Item 26: live migration state | NOT DONE (owner dashboard) | §14.2 item 26 |
| B8 | Item 32: kill switch approved | Draft design only. Approval pending (D-I32) | §14.2 item 32; §13D |
| B9 | Item 33 code and two-session tests | Placement DECIDED. Code and tests NOT APPROVED | §13C; §14.2 item 33 |
| B10 | Q4 mechanism | Approved outcome. Working default Option A (2026-11-10). Contract not built or tested | §13C; §13E |
| B11 | Never-ACTIVE hold start | OPEN (D-HS). Not decided by the owner's defaults | §13C; §13E |
| B12 | Recovery SKIP LOCKED and cancel-trigger lock class (rule 10) | Design only. Printing approval needed | §12B.5 |
| B13 | Item 23 (retry diff review) and item 24 (refund choice) | NOT APPROVED | §14.2 items 23, 24 |
| B14 | Duplicate-print fix, refund and claim fix | NOT APPROVED | §12B.4 |
| B15 | 7F migration number | NOT CHOSEN (D-MIG) | §15.3 |
| B16 | Staging database for SQL and two-session tests | NOT SET UP (O12). Separate approval | §12B.12 |
| B17 | Approvals for the build, staging tests and enabling | NONE GIVEN | §15.3 7F |
| B18 | Item 11 existing-shop count and 30-day notice | Owner count not given. Lawyer review needed | §14.2 item 11 |
| B19 | Items 29 and 30 privacy text and retention | NOT STARTED (lawyer) | §14.2 items 29, 30 |
| B20 | Q5 wording, placement and staff text | Wording set by working default (2026-11-10). Placement and approve text need UI approval | §13E |
| B21 | Customer "Printing" label for held orders | OPEN (D-Q5b). Lawyer review through C-1 | §13D; §13E |
| B22 | R18 test 2 expectation | Pending (D-R18-T2) | §13D |

External blockers, in one list: C-1 lawyer review; M1 and held-file release policy; staging database and approval for two-session tests (O12); hosted checks for migration history, edge deployment, live signatures and grants (items 25, 26, 27, owner); local catalog check (needs local setup approval); item 24 refund decision; items 10 and C-11 refund lawyer review; items 26 and 27 production owner.

## 9. Verification log

| Check | Result |
|---|---|
| Source line references in sections 2 and 7 | Checked by reading only, in earlier steps, at `37e4623` and the stage7 worktree |
| Register sections edited in this step | Approved text unchanged. Stale entries corrected with evidence. §13D added |
| Local catalog checks (Postgres) | NOT RUN. No local cluster; `pg_isready` gave no response. Starting one needs local setup approval |
| Hosted checks | BLOCKED. Not attempted in this step |
| Staging checks | BLOCKED. O12 not set up; separate approval needed |
| Automated tests | Not re-run in this step. Earlier 7E results (46 and 14 unit tests; 212 `npm test` in `web/`; 33 browser smoke tests, mocked) are recorded for reference only |
| 2026-11-10 admin tests (`npm test`) | 72 of 72 pass before and after renumbering |
| 2026-11-10 migration rename | 0011, 0012, 0013 to 0015, 0016, 0017 in the stage7 worktree. Non-comment SQL identical to the pre-rename copy |
| 2026-11-10 Python and shell | Syntax only (`ast` parse, `bash -n`). Behavioural tests NOT RUN (no local PostgreSQL) |
| Edge deployment status | UNVERIFIED (F11) |

## 10. Test pointers

| Group | Where |
|---|---|
| Lock order and two-session tests | `STAGE7F_ITEM33_PLAN.md` §6 (T33-1 to T33-11; T33-A to T33-H) |
| Q4 agent, edge function and SQL tests | `STAGE7F_Q4_CONTRACT.md` §10 |
| Kill switch tests | `STAGE7F_ITEM32_KILL_SWITCH.md` §11 (S1 to S9) |
| Existing, must pass unchanged | `stage8_print_tests.sql`, `print_eligibility_tests.sql`, `order_workflow_tests.sql` (Chain A and origin/main); `agent/test/worker.test.mjs`; `supabase/tests/print_agent_api_checks.test.js` |
| Owner-default outcome tests (release succeeds; release fails) | `STAGE7F_Q4_CONTRACT.md` §10.4 (NOT RUN) |
| Owner status regression | Owner status shows D fields only in every state (7E) |

SQL tests run only on a staging copy (CLAUDE.md). Two-session tests and any hosted test need separate approval.

## 11. Decisions needed from the owner

The decision sheet is in the register §13D and in the reply that accompanies this file. Decisions are listed there with their recommendations. None is approved by this file.

## 12. C-1 evidence and external gates

See `/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/STAGE7F_C1_GATES.md`.
