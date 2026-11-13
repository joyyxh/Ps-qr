# 7C specification consistency report (read-only, 2026-11-05)

Baseline: HEAD `5c82d37` (pushed). Sources: `STAGE7_DECISIONS.md`, `OWNER_DECISION_SHEET.md`, `supabase/migrations/0011_licence_foundation.sql` (untracked, not edited).
No decision document, migration, SQL, test, staging project, user, commit or push was touched. Line numbers refer to the current files.

Status key: **PROPOSED** means the owner has not yet approved it. Nothing here is recorded as approved.

---

## 1. Custom grant boundaries (PROPOSED D1)

**Proposed rule:** admin enters Asia/Kolkata calendar dates. Start = 00:00 IST on the start date, inclusive. End = 00:00 IST on the end date, exclusive. Stored as `timestamptz`. A start earlier than the server clock is a backdate and needs explicit confirmation (decision 16). The DB already requires `ends_at > starts_at`, so a same-day range is refused.

**Stale or conflicting wording to reconcile when D1 is recorded:**

| Location | Current wording | Conflict |
|---|---|---|
| STAGE7 l.511 (§12A.6 Grant) | "Approved convention (M4)" and "Partly superseded 2026-11-04 (A2)" in the same paragraph | Calls the 00:00 convention both approved and not decided |
| STAGE7 l.512 (A2 bullet) | "Custom-grant boundaries: OPEN" | Must become decided if D1 is approved |
| STAGE7 l.652 (§12B.2, M4 row) | "Custom-grant convention APPROVED" and "A2: ... OPEN" | Same conflict in one row |
| STAGE7 l.707 (§12B.5, fix 9) | Exclusive end display confirmed 2026-11-01; "exact display wording still to confirm" | Supports the end boundary only, not the 00:00 start |
| STAGE7 l.815 (§12B.11, Admin RPCs) | "Custom grant boundaries at 00:00 IST." then, in the same bullet, "the custom-grant boundary test expectation is OPEN and is not set" | The test expectation contradicts itself |
| STAGE7 l.981 (§13, A2 row) | "Custom-grant boundaries: OPEN" | Stale once D1 is approved |
| STAGE7 l.1000 and sheet l.187 (blocker lists) | "Custom-grant boundaries (owner to classify)" | Stale once D1 is approved |
| STAGE7 l.1075 (§13, 2026-11-02 record) | "Custom-grant boundaries remain OPEN" | Annotation to update |
| STAGE7 l.1568 (status table, M4) | "DECIDED" and "Custom-grant convention approved" | Status word contradicts A2 |
| Sheet l.89 and l.177 (items 11, A2) | "custom-grant boundaries OPEN" | Stale once D1 is approved |

**Required on recording:** add a dated §13 record. Annotate, do not delete, the older lines. Make the §12B.11 expectation one statement. Change the M4 status to "decided for custom grants by D1 (date)".

**Open ambiguities:** see section 10.

---

## 2. Extend durations (PROPOSED D2: 1-month and 1-year only)

- The current spec gives the extend start (O3, STAGE7 l.513) but no duration. The gate list says "Extend period lengths: not specified" (l.1001). The sheet blocker row (l.187) lists the same gap.
- **Proposed text for §12A.6, extend bullet:** "Duration: 1 month or 1 year only. The end is computed by the A2 calendar rule from the extend start, which is `greatest(v_now, latest non-revoked end)` (O3)."
- Annotate l.1001 and sheet l.187 as resolved.

---

## 3. Replay ledger for business rejections (PROPOSED D3)

- Current: STAGE7 l.533 says it is "OPEN". l.1002 says "not decided. Recommended: no row". Sheet l.187 lists it as a blocker.
- Proposed: only committed successful operations (grant, extend, revoke, replace) write `licence_requests`. Authorisation denials (2026-11-02 item 7; A4) and business rejections write no row.
- Annotate l.533, l.1002 and sheet l.187 as resolved on recording.

---

## 4. state_version (PROPOSED D5)

**Proposed rule:** increment once, in the same transaction, for each committed successful admin licence operation. A replace counts as one operation, so one increment. No increment for authorisation denials, business rejections, replays or reads.

**Conflicting wording to replace (not annotate):**

| Location | Current wording |
|---|---|
| STAGE7 l.716 (R2) | "one increment per RPC request, inside the RPC" |
| STAGE7 l.476 (§12A.5, shop_licence_meta) | "incremented once per admin RPC request, inside the RPC" |
| STAGE7 l.820 (§12B.11, Versioning) | "exactly one increment per RPC request. No increment on reads." |
| 0011 header l.33 | "state_version is set by the admin RPC, once per request (R2)" |

**Open items that D5 resolves (annotate as resolved):**
- STAGE7 l.534 (§12A.8, AAL2 bullet, "Still OPEN (i)").
- STAGE7 l.1042 (§13, AAL2 record, "Still open").
- Sheet Part 1J "Still open" list (l.204).

**Naming:** "increments the counter" in §12A.8 (l.816, 817) refers to `licence_denial_windows`, not `state_version`. Use distinct words in the revised text.

---

## 5. Denial-counter writes and the R18 transaction rule (see section 8)

§12B.7 (l.753, commit rule) requires the counter and the detailed row to commit with the forbidden result. R18 rule 1 (l.1181) says "in its own statement or transaction". These cannot both hold literally. Resolution is in section 8.

---

## 6. Naming collision between local and hosted test options (contradiction 4)

| Document | Option A | Option B |
|---|---|---|
| §15.2 (l.1637 to 1641) and sheet "Local setup" row (l.248) | Local Supabase stack (Docker, CLI, `supabase init`) | Separate hosted staging project |
| §12D (l.920 to 923) | Free-plan hosted project | Additional Micro project on Pro |

The same letters refer to different things, and hosted Option B in §15.2 corresponds to either hosted option in §12D.

**Proposed rename (PROPOSED):**
- Test environments: **T1** = local stack, **T2** = hosted staging project.
- Hosted plan options in §12D: **P1** = free-plan project, **P2** = additional Micro project on Pro.
- Apply in §12D headings, §15.2, the sheet "Local setup" row, and Decision L (l.648; sheet l.249).

---

## 7. Hosted Auth test fixture (contradiction 5)

**Gap:** Decision L (STAGE7 l.648; sheet l.249) is a read-only inspection of the **local** Auth schema, after local setup approval. R15 (l.729) is blocked by L. §15.2 says a synthetic fixture needs L and the R15 column check. But T2 (hosted) is the only option that checks R16 and R17, so there is no approved way to read the hosted Auth columns.

**Proposed "L-hosted":** after T2 is created and this inspection is approved separately, read the staging Auth schema (read-only), record the column list in the decision record, and create no user.

**Requirements for any hosted fixture (for approval, not creation):**
1. Synthetic identity only. Email on a reserved test domain, not a real mailbox. Password unique to the fixture and held only in a secret store, never in the repo.
2. Created only in the approved staging project. The test runner must check the project reference before any write and refuse to run on any other reference.
3. One admin fixture unless the owner approves more (decision 13).
4. TOTP enrolled by the owner, who holds the factor. Open question: whether the harness may hold the TOTP secret (section 10).
5. A `platform_admins` row linked to the fixture, created by a separately approved SQL step. 0011 seeds nothing, and must keep seeding nothing.
6. Disable or remove the fixture at the end of the test window. Removal needs approval.
7. Auth column names and MFA or email-confirmation settings are unverified (R15, R16). Fixture SQL must not be written until L-hosted has recorded them.

---

## 8. R18 ordering, replay placement and the meta-lock relationship (PROPOSED D7 detail)

**Retained as approved (rules 1 to 3, quoted at l.1181 to 1183):** rule 1 (rate limits before meta, no rate-limit lock while a meta, order, agent or job lock is held); rule 2 (insert-on-conflict, `FOR UPDATE`, then coverage and audit writes, no order, agent or job lock); rule 3 (no coverage without meta).

**Proposed extension 1A (needs explicit approval; not yet part of R18):**
> `licence_denial_windows` rows follow rule 1. The denial path takes no meta, order, agent or job lock. Its counter rows are locked actor row first, global row second, always. Counter rows are never locked after the meta lock is taken. Counter locks may be held until the RPC transaction commits, because the denial path takes no meta lock.

Rule 1's phrase "in its own statement or transaction" is read as "before any meta lock, and holding no meta, order, agent or job lock". That is a clarification that needs approval.

**Why there is no cycle:** the denial path never takes meta. The authorised path never touches counters. Business rejections after the meta lock write no denial row (A4), so they touch no counter. So counter rows (actor, then global) always come before meta, and no transaction takes them in mixed order.

**Proposed authorised-path order (extension 2A, needs approval):**
1. Shape validation with no DB state: reason, `confirm = true`, `request_id` as uuid, custom boundary format, extend duration in {1 month, 1 year}.
2. Shop existence check, plain read, no lock (see section 9).
3. `licence_lock_shop(shop, 'exclusive')`. Creates the meta row if absent and locks it.
4. **Replay lookup** in `licence_requests` by `request_id`. Same payload hash returns the stored result. Different hash returns a committed conflict code.
5. Stale check: `expected_state_version` against the locked version (absent meta counts as 0).
6. Business checks needing state: overlap, backdate confirmation, M2 revocation rule, extend preconditions.
7. Writes: coverage and audit rows, ledger row, one `state_version` increment.
8. Commit.

**Why replay runs before the stale check:** after the first call succeeds, the version has moved. A retry carries the original `expected_state_version`, which is now stale. If the stale check ran first, every successful retry would be refused.

**Concurrency for identical concurrent requests:** the second request waits on meta. Under READ COMMITTED, its replay query runs after the lock and sees the first request's ledger row. The unique key on `request_id` is the backstop.

**Gaps in rules 1 to 3:** rule 2 does not say where the replay lookup goes. It does not require a shop existence check. Both are supplied by extension 2A above.

**Payload hash (not defined in any record):** proposed as SHA-256 of canonical JSON of every business field, including `expected_state_version` and `confirm`, excluding `request_id`. Reviewer to confirm.

**Lock-order summary (proposed):** counter rows (actor, then global) → meta → coverage, audit and ledger rows. No transaction takes these in another order.

---

## 9. Missing-shop handling before the meta insert

- Current: no record defines it. `licence_lock_shop()` (0011 l.376 to 419) inserts the meta row, and `shop_licence_meta` has a foreign key to `shops` (0011 l.55 to 60). A missing shop therefore raises a raw foreign-key error, not a committed code.
- **Proposed:** after authorisation and shape checks, run a plain existence check on `shops`. If missing, return a committed `shop_not_found`. It is a business rejection under A4: not counted as an authorisation denial, no ledger row, no version change.
- Authorisation comes first, so a non-admin cannot probe shop IDs. They get `forbidden`.
- Race: a shop deleted after the check raises a foreign-key error. The transaction rolls back and nothing changes. This is an unexpected error, not a business rejection. Shop deletion is restricted once a meta or licence row exists, so only shops with no licence history are exposed.
- Do not take `FOR KEY SHARE` on `shops` before the meta lock. `shops` is not in the R18 lock order, so adding it needs review.
- Open: the records are silent on whether a closed shop (`shops.is_open = false`, 0001 l.23) can receive a licence. Recommended: no effect. Owner to confirm.

---

## 10. Genuine ambiguities in the proposed decisions

| # | Decision | Ambiguity | Recommendation |
|---|---|---|---|
| A1 | D1 | "Start today" is a backdate under the current rule, so the admin must confirm every same-day grant. | Keep the rule, and have the UI default to tomorrow. Owner to choose. |
| A2 | D1 | Does the custom path enter 7C now, or only after D1 is recorded? | Enter 7C after the consistency edits in section 1 are recorded. Owner to confirm. |
| A3 | D1 | Exact display wording for the exclusive end (fix 9, l.707). | Show "until 1 Jan 2028, 00:00 IST (exclusive)". Owner to confirm. |
| A4 | D2 | Extend on a shop with no non-revoked coverage (NONE, or all revoked). | Refuse with a committed code. Admin uses grant instead. |
| A5 | D2 | No cap on stacked extends. | Accept, since every extend is audited. Owner to confirm. |
| A6 | D3 | Payload hash contents (section 8). | Include `expected_state_version` and `confirm`. |
| A7 | D3 | A rejected request can leave an empty meta row (version 0) when the stale check runs after the lock. | Accept. Keep business checks that need no state before the lock. Owner to confirm. |
| A8 | D3 | A payload conflict is detected only against successes, so a rejected attempt can be reused with a different payload. | Accept. Owner to confirm. |
| A9 | D5 | Scope: admin licence operations only. Print gates (7F) never increment. | Confirm. |
| A10 | D5 | One increment per replace, not one per coverage row. | Confirm. |
| A11 | D6 | Keep T1 (local) in addition to T2 (hosted), or T2 only. | T2 only for 7C verification. T1 only if wanted for fast iteration, under separate approval. |
| A12 | D6 | Whether the harness may hold the TOTP secret for the fixture. | No. The owner holds the factor. |
| A13 | D7 | Extension 1A and the rule 1 clarification (section 8). | Approve as drafted, and nothing else in R18. |

---

## 11. Previous-report contradictions: status

| # | Previous item | Status |
|---|---|---|
| 1 | Custom boundaries (M4, A2, §12B.11) | Section 1 |
| 2 | state_version (R2, §12B.11, 0011 header) | Section 4 |
| 3 | Denial counter vs rule 1 transaction wording | Sections 5 and 8 |
| 4 | Local and hosted option names | Section 6 |
| 5 | Decision L vs hosted option (no hosted fixture path) | Section 7 |
| 6 | 0011 header line 42 | Section 12 |
| 7 | Local setup plan not written | Drafted as `D6-hosted-staging-setup-plan-2026-11-05.md`; approval pending |

---

## 12. 0011 header (outdated)

Header-only edits, to be made in the same step as D4, and only after approval:

| Line | Current | Required |
|---|---|---|
| 9 to 15 ("Adds") | Lists current objects only | Add `licence_requests`, `licence_denials`, `licence_denial_windows` (D4) |
| 33 | "state_version ... once per request (R2)" | "incremented once per committed successful admin operation (D5); not on denials, rejections or replays" |
| 38 to 39 | "Each calls `licence_lock_shop(shop, 'exclusive')` first, then writes its coverage and audit rows" | Add: "on success, also the `licence_requests` row and the `state_version` increment. Denial counters are written before the lock." |
| 42 (under "Not in this file") | "Licence denials and their cap (7C)" | Remove. Replace with "denial RPC logic (7C)" |

Lines 3 to 6 (status and lineage), 19 to 21 (admin and lifetime rules, no custom cap) and 45 (no bootstrap seed) remain accurate.

---

## 13. Items not changed by this pass

- No decision document or migration edit.
- Production-owner checks (items 5, 25, 27, 31, 34) untouched.
- Supabase account not queried, including the organisation's plan (§12D says it is unverified). Plan checks are read-only and need the owner's request.
