# 7C specification consistency report, v2 (read-only, 2026-11-05)

Supersedes the v1 draft in the same folder. Baseline: HEAD `5c82d37` (pushed).
Sources: `STAGE7_DECISIONS.md`, `OWNER_DECISION_SHEET.md`, `supabase/migrations/0011_licence_foundation.sql` (untracked). Line numbers were re-checked against the files on 2026-11-05. Nothing was edited, run, created, committed or pushed.

Status key: **PROPOSED** means not yet approved. Nothing here is recorded as approved.

---

## 1. Custom grant boundaries (PROPOSED D1)

**Proposed rule:** the admin enters Asia/Kolkata calendar dates. Start is 00:00 IST on the start date, inclusive. End is 00:00 IST on the end date, exclusive. Stored as `timestamptz`. A start before the server clock is a backdate and needs explicit confirmation (§12B.3 decision 16; §13 record of 2026-11-02, item 5). `ends_at > starts_at` is already enforced, so a same-day range is refused.

**Conflicting or stale wording to reconcile on recording:**

| Location | Current wording | Conflict |
|---|---|---|
| STAGE7 l.511 (§12A.6 Grant) | "Approved convention (M4)" and "Partly superseded 2026-11-04 (A2): the 00:00 IST boundary is not treated as decided" | Same paragraph calls the convention approved and undecided |
| STAGE7 l.512 (§12A.6 A2 bullet) | "Custom-grant boundaries: OPEN" | Stale once D1 is approved |
| STAGE7 l.652 (§12B.2, M4 row) | "Custom-grant convention APPROVED" with an A2 note that it is OPEN | Same conflict in one row |
| STAGE7 l.707 (§12B.5, fix 9) | Exclusive end confirmed 2026-11-01; "exact display wording still to confirm" | Supports the end boundary only, not the 00:00 start |
| STAGE7 l.815 (§12B.11, admin RPCs) | "Custom grant boundaries at 00:00 IST." then, in the same bullet, the test expectation "is OPEN and is not set" | The bullet contradicts itself |
| STAGE7 l.981 (2026-11-04 record table, A2 row) | "Custom-grant boundaries: OPEN" | Stale once D1 is approved |
| STAGE7 l.1000 (§13 blocker list) | "Custom-grant boundary semantics (A2) ... treated as blocked" | Stale once D1 is approved |
| STAGE7 l.1075 (§13 open list) | "Custom-grant boundaries remain OPEN" | Annotate on recording |
| STAGE7 l.1568 (status table, M4) | "DECIDED" and "Custom-grant convention approved" | Status word contradicts the A2 note |
| OWNER_DECISION_SHEET l.177 (A2 row) | "Custom-grant boundaries OPEN" | Stale once D1 is approved |
| OWNER_DECISION_SHEET l.187 (blocker row) | "Custom-grant boundaries (owner to classify)" | Stale once D1 is approved |

**Required on recording:** a dated §13 record. Annotate the older lines and do not delete them. State the §12B.11 expectation once. Change the M4 status to "decided for custom grants by D1 (date)".

---

## 2. Extend durations (PROPOSED D2: 1-month and 1-year only)

- §12A.6 extend bullet (l.513) gives the start rule (O3) and no duration.
- The gate list says "Extend period lengths: not specified in this file" (l.1001). Sheet row l.187 lists the same gap.
- **Proposed text for the §12A.6 extend bullet:** "Duration: 1 month or 1 year only. The end is computed by the A2 calendar rule from the extend start, which is `greatest(v_now, latest non-revoked end)` (O3)."
- Annotate l.1001 and sheet l.187 as resolved on recording.

---

## 3. Replay ledger for business rejections (PROPOSED D3)

- A4 response contract (l.533): "Whether these rejections write a replay-ledger row is OPEN." The gate list (l.1002) says "not decided. Recommended: no row, as for denials." Sheet l.187 lists it as a blocker.
- Proposed: only committed successful operations (grant, extend, revoke, replace) write `licence_requests`. Authorisation denials (AAL2-3, A4) and business rejections write no row.
- Annotate l.533, l.1002 and sheet l.187 as resolved on recording.

---

## 4. state_version (PROPOSED D5)

**Proposed rule:** incremented once, in the same transaction, for each committed successful admin licence operation. A replace is one operation, so one increment. No increment for authorisation denials, business rejections, replays or reads.

**Conflicting wording to replace (not annotate):**

| Location | Current wording |
|---|---|
| STAGE7 l.476 (§12A.5, `shop_licence_meta`) | "incremented once per admin RPC request, inside the RPC" |
| STAGE7 l.716 (R2) | "one increment per RPC request, inside the RPC" |
| STAGE7 l.820 (§12B.11, Versioning) | "exactly one increment per RPC request. No increment on reads." |
| 0011 header l.33 | "state_version is set by the admin RPC, once per request (R2)" |

**Open items that D5 resolves (annotate as resolved):**
- STAGE7 l.534 (§12A.8, AAL2 bullet, "Still OPEN (i)").
- STAGE7 l.1042 (§13, AAL2 record, "Whether a denied AAL2 request increments...").
- OWNER_DECISION_SHEET l.204 ("Still open").

**Naming:** the "increments the counter" wording in §12B.11 (l.816, 817) refers to `licence_denial_windows`, not `state_version`. The revised text should use different words for the two.

---

## 5. Denial counters and the R18 transaction rule (see section 8)

§12B.7 (l.753, commit rule) requires the counter and the detailed row to commit with the `forbidden` result. R18 rule 1 (l.1181) says a rate-limit call runs "in its own statement or transaction", before any meta lock. The rule is written for `rate_limits` only (l.999 says applying it to `licence_denial_windows` is an extension for review). Resolution is in section 8.

---

## 6. Local and hosted option names (naming collision)

| Document | Option A | Option B |
|---|---|---|
| §15.2 (l.1639 to 1640) and sheet "Local setup" row (l.248) | Local Supabase stack (Docker, CLI, `supabase init`) | Separate staging Supabase project |
| §12D options table (l.920 to 923) | A: free-plan project | B: additional Micro project on Pro |

The same letters mean different things. §15.2's Option B corresponds to either hosted option in §12D.

**Proposed rename (PROPOSED):**
- Test environments: **T1** = local stack, **T2** = hosted staging project.
- Hosted plans: **P1** = §12D option A (free-plan project), **P2** = §12D option B (Micro on Pro).
- Apply in §12D, §15.2, the sheet "Local setup" row, and Decision L (l.648; sheet l.249).

---

## 7. Hosted Auth test fixture (contradiction 5)

**Gap:** Decision L (STAGE7 l.648; sheet l.249) is a read-only inspection of the **local** Auth schema, after local setup approval. R15 (l.729) is blocked by L. §15.2 (l.1641) says a synthetic fixture needs L and the R15 column check. R16 (l.730, claims) and R17 (l.731, default grants) are both UNVERIFIED "(staging)". So a hosted read is needed, and no approved path for it exists.

**Proposed "L-hosted":** after T2 is approved and created, a read-only inspection of the staging Auth schema, recorded in the decision record. No user is created. The SQL is reviewed before it runs. (Full steps in the D6 plan.)

**Requirements for any hosted fixture (for approval, not creation):**
1. Synthetic identity only. Address on the reserved `.invalid` domain, with a password unique to the fixture and held only in a secret store.
2. Created only in the approved staging project. The runner checks the project reference first and refuses any other.
3. One admin fixture unless the owner approves more (decision 13).
4. TOTP enrolled by the owner, who holds the factor. Open: whether the harness may hold the secret (A12, U4 in the D6 plan).
5. A `platform_admins` row for the fixture, created by a separately approved SQL step. 0011 seeds nothing and must keep seeding nothing.
6. Fixture removed at the end of the test window. Removal needs approval.
7. Auth column names and MFA/email settings are unverified (R15, R16). Fixture SQL is not written until L-hosted has recorded them.

---

## 8. R18 ordering, replay placement and the meta-lock relationship (PROPOSED D7 detail)

**Retained as approved (rules 1 to 3, l.1181 to 1183):**
- Rule 1: rate limits run before any meta lock, and no `rate_limits` row is locked while a meta, order, agent or job lock is held.
- Rule 2: insert-on-conflict, `FOR UPDATE`, then the coverage and audit writes. No order, agent or job lock.
- Rule 3: no coverage row without its meta row.

**Proposed extension 1A (needs explicit approval; not yet part of R18):**
> Denial counter rows (`licence_denial_windows`) follow rule 1. The denial path takes no meta, order, agent or job lock. Counter rows are locked actor row first, then global row, always. Counter rows are never locked after the meta lock is taken. Counter locks may be held until the RPC transaction commits, because the denial path takes no meta lock.

The rule 1 wording "in its own statement or transaction" is read here as "before any meta lock, holding no meta, order, agent or job lock". That reading needs approval.

**Why there is no cycle:** the denial path never takes the meta lock. The authorised path never touches the counters. Business rejections after the meta lock write no denial row (A4), so they touch no counter. Counter rows (actor, then global) therefore always come before meta, and no transaction takes them in mixed order.

**Note:** the global counter row is locked by every denial, so denials serialise on it. Acceptable for admin traffic, but the owner should know.

**Proposed authorised-path order (extension 2A, needs approval):**
1. Shape validation with no database state: reason, `confirm = true`, `request_id` as uuid, custom boundary format, extend duration in {1 month, 1 year}.
2. Shop existence check, a plain read with no lock (see section 9).
3. `licence_lock_shop(shop, 'exclusive')`. Creates the meta row if absent and locks it.
4. **Replay lookup** in `licence_requests` by `request_id`. Same payload hash returns the stored result. Different hash returns a committed conflict code.
5. Stale check: `expected_state_version` against the locked version (absent meta counts as 0).
6. Business checks that need state: overlap, backdate confirmation, M2 revocation rule, extend preconditions.
7. Writes: coverage and audit rows, the ledger row, one `state_version` increment.
8. Commit.

**Why replay runs before the stale check:** after the first call succeeds the version has moved. A retry carries the original `expected_state_version`, which is now stale. If the stale check ran first, every successful retry would be refused.

**Why the replay lookup must precede any insert:** `licence_coverages.request_id` is `not null unique` in 0011. A retry that skipped the lookup would hit that constraint and raise a raw error instead of returning the stored result.

**Concurrency for identical concurrent requests:** the second request waits on the meta lock. Under READ COMMITTED, its replay query starts after the lock is granted and sees the first request's committed ledger row. The unique primary key on `request_id` is the backstop.

**Gaps in rules 1 to 3:** rule 2 does not say where the replay lookup goes, and does not require a shop existence check. Extension 2A supplies both.

**Payload hash (not defined in any record):** proposed as SHA-256 of the canonical payload, covering every business field including `expected_state_version` and `confirm`, and excluding `request_id`. Proposed further: include the caller's auth UID in the hashed input without storing it (D4 Q2). Reviewer to confirm.

**Lock-order summary (proposed):** counter rows (actor, then global) → meta → coverage, audit and ledger rows. No transaction takes these in another order.

---

## 9. Missing-shop handling before the meta insert

- No record defines it. `licence_lock_shop()` (0011 l.376 to 419) inserts the meta row at l.397. `shop_licence_meta.shop_id` references `shops` with `on delete restrict` (0011 l.55 to 60). A missing shop would therefore raise a raw foreign-key error, not a committed code.
- **Proposed:** after authorisation and shape checks, run a plain existence check on `shops`. If the shop is missing, return a committed `shop_not_found`. It is a business rejection under A4: not counted as an authorisation denial, no ledger row, no version change.
- Authorisation comes first, so a non-admin cannot probe shop IDs and gets `forbidden`.
- Race: a shop deleted after the check raises a foreign-key error, the transaction rolls back, and nothing changes. That is an unexpected error, not a business rejection. Shop deletion is restricted once a meta or licence row exists (0011 l.56, l.64, l.103 all `on delete restrict`), so only shops with no licence history are exposed.
- Do not take `FOR KEY SHARE` on `shops` before the meta lock. `shops` is not in the R18 lock order, so adding it needs review.
- Open: whether a closed shop (`shops.is_open = false`, 0001 lines 17 to 28) can receive a licence. The records are silent. Recommended: no effect. Owner to confirm.

---

## 10. Genuine ambiguities

| # | Decision | Ambiguity | Recommendation |
|---|---|---|---|
| A1 | D1 | "Start today" is a backdate under the current rule, so every same-day grant needs confirmation. | Keep the rule. The UI defaults to tomorrow. Owner to choose. |
| A2 | D1 | Does the custom path enter 7C now, or only after D1 is recorded? | After the section 1 edits are recorded. Owner to confirm. |
| A3 | D1 | Exact display wording for the exclusive end (fix 9, l.707). | "until 1 Jan 2028, 00:00 IST (exclusive)". Owner to confirm. |
| A4 | D2 | Extend on a shop with no non-revoked coverage (NONE, or all revoked). | Refuse with a committed code. The admin uses grant instead. |
| A5 | D2 | No cap on stacked extends. | Accept, since each extend is audited. Owner to confirm. |
| A6 | D3 | Payload hash contents (section 8). | Include `expected_state_version` and `confirm`. |
| A7 | D3 | A rejection after the meta lock commits and leaves an empty meta row (version 0). | Accept. Keep business checks that need no state before the lock. Owner to confirm. |
| A8 | D3 | A payload conflict is detected only against successes, so a rejected attempt can be reused with a different payload. | Accept. Owner to confirm. |
| A9 | D5 | Scope: admin licence operations only. Print gates (7F) never increment. | Confirm. |
| A10 | D5 | One increment per replace, not one per coverage row. | Confirm. |
| A11 | D6 | Keep T1 (local) alongside T2 (hosted), or T2 only. | T2 only for 7C verification. T1 only for faster iteration, under separate approval. |
| A12 | D6 | Whether the harness may hold the TOTP secret for the fixture. | No. The owner holds the factor (D6 S7). Owner decides. |
| A13 | D7 | Extension 1A and the rule 1 reading (section 8). | Approve as drafted, and nothing else in R18. |
| A14 | D6 | **Decision 1 timing.** Hosted and local `aal` verification "remain prerequisites before 7C". A3 moves only the recovery procedure, to sign-off. The records do not say whether "before 7C" means implementation start or sign-off. | Owner to decide. If it means start, the hosted staging project is on the critical path now (D6 U6). |
| A15 | D6 | **Live plan conflict.** The README says the live project is on the free plan. §5 uses Pro as the cost base. §12D says the live plan is unverified. | Owner to confirm in the dashboard. The staging cost depends on it (D6 U8). |
| A16 | D4 | Ledger stores `actor_user_id`, or the payload hash includes the caller without storing it (§12B.8 says store it only where replay needs it). | Hash the caller without storing it (D4 Q2). Owner to confirm. |
| A17 | D4 | §12B.7 says the denial record stores "the denial code", but every public response is `forbidden`. | Store an internal denial reason, never returned to callers (D4 Q3). Owner to confirm. |

---

## 11. Status of the previous contradictions

| # | Previous item | Status |
|---|---|---|
| 1 | Custom boundaries (M4, A2, §12B.11) | Section 1 |
| 2 | state_version (R2, §12B.11, 0011 header) | Section 4 |
| 3 | Denial counter vs rule 1 transaction wording | Sections 5 and 8 |
| 4 | Local and hosted option names | Section 6 |
| 5 | Decision L vs hosted option (no hosted fixture path) | Section 7 |
| 6 | 0011 header line 42 | Section 12 |
| 7 | Local setup plan not written | The hosted plan (D6) is written at `scratchpad/D6-hosted-staging-setup-plan-2026-11-05.md`. Local setup (T1) is not planned. Approval pending. |

---

## 12. 0011 header (outdated)

Header-only edits, made in the same step as D4, and only after approval. The full proposed text is in the D4 scope document, section 5.

| Line | Current | Required |
|---|---|---|
| 9 to 15 ("Adds") | Current objects only | Add the three D4 tables |
| 33 | "state_version ... once per request (R2)" | "incremented once per committed successful admin operation (D5)" |
| 38 to 39 | Lock-first wording without the ledger or counter | Add the ledger row and the version increment on success; denial counters written before the meta lock |
| 42 | "Licence denials and their cap (7C)" under "Not in this file" | "Denial RPC logic and cap enforcement (7C)" |

Lines 3 to 6 (status and lineage), 19 to 21 (admin and lifetime rules, no custom cap) and 45 (no bootstrap seed) remain accurate.

---

## 13. Not changed by this pass

- No decision document, migration or sheet was edited.
- No SQL was run and no tests were run.
- No staging project, user, credential, Supabase setting or MCP action was taken. The Supabase plan figures were checked on the public pricing page only.
- Production-owner checks (items 5, 25, 27, 31, 34) untouched.
