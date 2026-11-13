# 7C owner decision sheet (consolidated)

Prepared 2026-11-05 from: `7C-spec-consistency-report-2026-11-05-v2.md`, `D4-licence-tables-migration-scope-2026-11-05.md`, `D6-hosted-staging-setup-plan-2026-11-05.md`. Read-only. Nothing was edited, created, run, committed or pushed.

**Every "recommended" answer below is a proposal. None is approved until you say so.**

Type key:
- **YOUR DECISION**: a real choice that only you can make.
- **YOUR APPROVAL**: approve as drafted, or change.
- **ENGINEERING**: I can specify it safely. You can veto it.
- **YOUR CHECK**: a fact you confirm in the dashboard. Not a choice.

---

## 1. Smallest set needed from you

**To unblock the next step** (record the decisions and make the one approved edit to 0011):

1. **G1.** Answer the custom-grant convention question.
2. **D4-3.** Answer the foreign-key question on denial rows.
3. **Approve the bundle** in section 2 (E1, L1, L3, R1, R2, D4-1, D4-2 and the ENGINEERING items). By approving it you specifically approve these four rule changes: E1 (extend durations), L3 (state_version wording), R1 and R2 (locking contract extensions).

**To unblock 7C implementation start** (later):

4. **P-G1.** Say what "before 7C" means in decision 1.
5. **P-G2.** Say whether hosted `aal` verification is enough, or local verification is also required.
6. Then an explicit 7C implementation approval. It has not been given.

**Not needed for either step:** the staging choices in section 5, the recovery and break-glass texts, and the production items. Staging is needed only if you answer P-G1 with "implementation start", or if you want it created now.

---

## 2. Decisions

### 2a. Custom grants and extend (D1, D2)

| ID | Question, plain language | Recommended (not approved) | Consequence | Type |
|---|---|---|---|---|
| G1 | For custom grants (not 1-month or 1-year), should start and end be midnight IST (00:00), as M4 originally recorded, or keep the clock time, as calendar grants do? | Midnight IST. Start inclusive, end exclusive. | A custom grant ending "1 Jan 2028" covers up to 31 Dec 2027. The record says the owner has not decided this (A2), so it cannot be assumed. | YOUR DECISION |
| G2 | Is a custom grant starting today a backdate that needs confirmation? | Yes. The admin UI defaults to tomorrow. | Same-day grants need one extra confirmation. | YOUR APPROVAL |
| G3 | Should the custom-grant path ship in 7C, or wait until G1 is recorded? | In 7C, after G1 is recorded. | If it waits, 7C ships only the 1-month and 1-year paths. | YOUR APPROVAL |
| G4 | Exact display text for the exclusive end. | "until 1 Jan 2028, 00:00 IST (exclusive)". | Display only. | ENGINEERING |
| E1 | Should extend offer only 1-month and 1-year durations? | Yes. No custom extend. | Extend has the same two options as grant. A custom extension must be entered as a grant. | YOUR APPROVAL |
| E2 | Extend on a shop with no current or future coverage: refuse, or act as a grant? | Refuse with a committed code. The admin uses grant instead. | Keeps extend and grant separate. | ENGINEERING |
| E3 | Is an unlimited number of stacked extends acceptable? | Yes. Each is audited. | No cap is added. | YOUR APPROVAL |

### 2b. Replay ledger and state_version (D3, D5)

| ID | Question | Recommended | Consequence | Type |
|---|---|---|---|---|
| L1 | Should business rejections (for example a stale version or a missing reason) write no replay row? | Yes. Only committed successes write a row. | A rejected request retried later is checked again. A retry of a success returns the stored result. | YOUR APPROVAL |
| L2 | If a request ID is reused with a different payload after a rejection, is that accepted? | Yes. Conflicts are detected only against successes. | A rejected request ID can be reused with different content. | ENGINEERING |
| L3 | Should `state_version` increment once per committed admin operation only, with a replace counting once? No increment for denials, rejections, replays or reads. | Yes. | Replaces "once per RPC request" in R2, §12B.11, §12A.5 and the 0011 header. Stale checks move only on real changes. | YOUR APPROVAL |
| L4 | Do print gates (7F) ever increment `state_version`? | No. | Admin operations only. | ENGINEERING |
| L5 | Is an empty meta row (version 0) left by a committed rejection acceptable? | Yes. Business checks that need no state run before the lock. | A few empty rows exist for shops that were never licensed. | ENGINEERING |

### 2c. Lock order and replay placement (R18 extensions)

Context: on 2026-11-01 you approved the R18 contract as a **design**. The approval covered rules 1 to 3 only. Implementation is not approved. These two items extend the design, so they need your approval.

| ID | Question | Recommended | Consequence | Type |
|---|---|---|---|---|
| R1 | Extension 1A: denial-counter rows are locked actor row first, then global row, before any meta lock. The denial path takes no meta lock. Rule 1's "in its own statement or transaction" is read as covering these counters. | Approve as drafted. | No lock cycle is possible. Every denial queues on the global counter row. | YOUR APPROVAL |
| R2 | Extension 2A: the order for an authorised call. (0) Authorisation: `is_platform_admin()` and `aal2`; a failure takes the denial path. (1) Shape validation. (2) Shop existence check; if missing, a committed `shop_not_found`. (3) `licence_lock_shop(shop, 'exclusive')`. (4) Replay lookup. (5) Stale-version check. (6) Business checks. (7) Writes and one version increment. (8) Commit. | Approve as drafted, including step 0. | Retries return the stored result even after the version has moved. A non-admin gets `forbidden`, not validation feedback. My earlier draft left out step 0. | YOUR APPROVAL |
| R3 | Can a closed shop (`shops.is_open = false`) receive a licence? | Yes. No effect. | Does not block 7C. Answer before sign-off. | YOUR DECISION (not blocking) |

### 2d. Decision 1 timing and local verification (gates before 7C)

| ID | Question | Recommended | Consequence | Type |
|---|---|---|---|---|
| P-G1 | Decision 1 says hosted and local `aal` verification "remain prerequisites before 7C". A3 moved only the recovery procedure, to sign-off. Does "before 7C" mean **before implementation starts**, or **before sign-off**? | Read it as **before implementation starts** for hosted `aal` verification, because the unchanged wording says so. Unless you say otherwise. | If "start": a staging project must exist and the R16 claim check must pass before any 7C code is written. If "sign-off": staging can wait for the 7C staging matrix. | YOUR DECISION |
| P-G2 | Is hosted verification of the `aal` claim enough, or is local verification also required? | Hosted only. Record decision 1's local part as waived. Production uses the hosted claim. | Skipping local means no Docker setup. Decision L (the local Auth-schema read) must be moved to a hosted read, which needs staging. | YOUR DECISION |
| P-G3 | Recovery procedure text (A3). | Not needed now. Approve the text before 7C sign-off. | Sign-off blocker only. | YOUR DECISION (later) |
| P-G4 | Break-glass procedure text (O7). | Not needed now. Approve before 7C sign-off. | Sign-off blocker only. | YOUR DECISION (later) |

---

## 3. D4: exact proposed scope for 0011

**Scope of the one approved edit:** add three tables, their guards, RLS and privilege revokes, and the header lines below. Nothing else in 0011 changes. No 7C functions, no grants to `authenticated`, no seed data, no change to 0010 or `licence_lock_shop()`.

**Header lines to edit:** lines 9 to 15 (add the three tables), 33 (state_version wording per L3), 38 to 39 (ledger and counter wording), 42 (denial RPC logic moves to "7C").

### 3.1 `public.licence_requests` (replay ledger, committed successes only)

| Column | Definition |
|---|---|
| `request_id` | `uuid primary key`. Globally unique. The replay lookup key. |
| `action` | `text not null`, check in ('grant','extend','revoke','replace') |
| `shop_id` | `uuid not null`, references `shops(id)` on delete restrict |
| `payload_hash` | `bytea not null`, check `octet_length = 32`. SHA-256 of the canonical payload (see D4-2). |
| `coverage_id` | `uuid`, nullable, references `licence_coverages(id)` on delete restrict. Null for revoke. |
| `state_version_after` | `bigint not null`, check `>= 1` |
| `created_at` | `timestamptz not null default now()` |

No `result_code` column, because rejections write no row. No extra indexes. Guard: refuses UPDATE, DELETE and TRUNCATE.

### 3.2 `public.licence_denials` (detailed denial records, capped at 20 per actor per UTC hour by the 7C RPC)

| Column | Definition |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `actor_user_id` | `uuid not null`. Foreign key to `auth.users` is the open question D4-3. |
| `function_name` | `text not null`, length 1 to 64 (D4-7) |
| `denial_reason` | `text not null`, length 1 to 40. Internal only (D4-4). |
| `request_id` | `uuid`, nullable, not unique (D4-6) |
| `occurred_at` | `timestamptz not null default now()` |

Index on `(actor_user_id, occurred_at desc)` for the cap query. Guard: refuses UPDATE, DELETE and TRUNCATE (D4-5).

### 3.3 `public.licence_denial_windows` (counters, per actor and global, per UTC hour)

| Column | Definition |
|---|---|
| `id` | `bigint generated always as identity primary key` |
| `scope` | `text not null`, check in ('actor','global') |
| `actor_user_id` | `uuid`, nullable. Null for the global row. Foreign-key question as D4-3. |
| `window_start` | `timestamptz not null`. Start of a UTC hour, computed in UTC explicitly (D4-8). |
| `denial_count` | `integer not null default 0`, check `>= 0` |
| `detail_omitted_count` | `integer not null default 0`, check `>= 0 and <= denial_count` (D4-10) |

Constraints: a table check that a global row has no actor and an actor row has one. Partial unique indexes: `(actor_user_id, window_start) where scope = 'actor'` and `(window_start) where scope = 'global'`. Guard: refuses DELETE and TRUNCATE; refuses changes to `scope`, `actor_user_id` or `window_start`; refuses any decrease in either count.

### 3.4 Privileges, for all three tables

RLS enabled, no policies. `revoke all` from `public`, `anon`, `authenticated` and `service_role`. Revoke `execute` on the three guard functions from the same four roles. No grants added.

### 3.5 D4 decisions and schema questions

| ID | Question | Recommended | Consequence | Type |
|---|---|---|---|---|
| D4-1 | Approve the three-table addition and header edits in 0011, as one step. | Approve. | Nothing is applied, committed or tested by this approval. Commit and apply each need their own approval. | YOUR APPROVAL |
| D4-2 | (Q2) Should the ledger store `actor_user_id`? Or should the payload hash include the caller's UID without storing it? | Do not store it. Hash the caller's UID into the payload hash. | A retry by the same admin matches. A different admin gets a conflict. The ledger holds no personal data. The canonical payload definition is set in review. | YOUR APPROVAL (privacy) |
| D4-3 | (Q4) Should the actor columns in `licence_denials` and `licence_denial_windows` be foreign keys to `auth.users` with on delete restrict? | Drop the foreign keys. Store a plain uuid. | With a foreign key, any authenticated user who ever triggered a denial cannot have their account deleted while those rows exist. That covers shop owners and staff, not only admins. Without it, the rows can outlive the account until the retention decision (D4-5). I did not check how `licence_audit_log` references actors. The same question applies there. | YOUR DECISION |
| D4-4 | (Q3) What goes in `denial_reason`? | Internal reasons only, such as "not platform admin", "AAL2 missing" or "not write-permitted". Never returned to callers. The public response stays `forbidden`. | Gives you a reason for review without changing what callers see. Values are fixed in review. | ENGINEERING (veto) |
| D4-5 | (Q5) Can denial and counter rows be deleted? | No. Guards refuse deletes until a retention decision and a purge approval exist. | No purge job exists. Retention is the legal item in section 4. | YOUR APPROVAL |
| D4-6 | (Q6) Can a denial row have no `request_id`? | Yes. Null is allowed. | | ENGINEERING |
| D4-7 | (Q7) Which RPC names may appear in `function_name`? | Length check only, until names are fixed in implementation review. | | ENGINEERING |
| D4-8 | Is the UTC hour computed explicitly? Can counts only increase within a window? | Yes, and yes. | `date_trunc` on `timestamptz` uses the session time zone, so the UTC hour must be computed explicitly. | ENGINEERING |
| D4-9 | Every denial updates the global row, so denials queue on it. | Accept for admin traffic. | Acceptable at admin scale. You acknowledge it. | ENGINEERING (acknowledge) |
| D4-10 | `detail_omitted_count` (overflow counts with a visible marker) is approved for synthetic staging only (O10). Production acceptance is C-12, still OPEN. | No production decision yet. | Decide before production, not before staging. | YOUR DECISION (later) |
| D4-11 | Scope of the one edit: is anything else needed? Partial unique indexes, not `NULLS NOT DISTINCT`. | Partial indexes. | Avoids requiring PostgreSQL 15, whose version is unverified. | ENGINEERING |

**Note:** the D4 document is inconsistent here. Its section 1 says Q1 to Q4 block the edit. Its section 7 says Q1 to Q7 are needed. Treat all seven as inputs. Q5 to Q7 have safe defaults.

---

## 4. Recording and documentation edits

| ID | Action | Type |
|---|---|---|
| F1 | Record D1 to D3, D5 and R1 and R2 in a dated §13 record. Annotate older lines, do not delete them. Replace the "once per RPC request" wording (R2, §12B.11, §12A.5, 0011 header). | YOUR APPROVAL (to edit the two decision docs) |
| F2 | Rename hosted options to P1 (§12D A, free) and P2 (§12D B, Pro). Rename local to T1 and hosted to T2. | YOUR APPROVAL |
| F3 | Reconcile the stale custom-boundary wording (consistency report section 1). | ENGINEERING, after G1 |
| F4 | Corrections I found while consolidating: (a) the D4 Q1–Q4 versus Q1–Q7 inconsistency above; (b) D4-3 was understated (above); (c) step 0 was missing from R2 (above); (d) my earlier recommendation to skip local (A11) conflicts with decision 1 (P-G2). | ENGINEERING |

**Still open, not in these three documents, and not blocking 7C implementation:**
- Production items (decision record, "Production, all OPEN", line 1134): the production backdating window, the production ceiling value, the denial threshold and alert mechanism, legal review of denial retention, replay-ledger retention, audit retention and DPDP, admin UUID and MFA status, the production migration list, and final C-12 acceptance.
- Retention periods (D4-11): proposed 90 days for denial detail, under legal review. Counter retention is open. Ledger retention has no period yet.

---

## 5. D6: hosted staging

### 5a. Free versus Pro (USD, before tax, checked on the public pricing page today; matches §12D)

| Scenario | Monthly cost | What it means |
|---|---|---|
| **P1**: free-plan project, organisation stays on Free | **$0** | Needs a free slot (2 active projects maximum). Paused after 1 week of inactivity. Free has no automatic backups and no point-in-time recovery. |
| **P2**, organisation is on Free today | **$25 Pro + $10 staging Micro = $35** | Pro is priced per organisation (the pricing page links to organisation-based billing). The live project moves to the Pro plan too: never paused, 7-day daily backups. Any live compute above the one-Micro credit is billed. Live compute size is unverified. |
| **P2**, organisation is already on Pro, live project is Micro | **+$10** | The $10 credit is already used by the live project. |
| **P2**, organisation is already on Pro, live project is larger than Micro | **+$10** | The live project's own compute cost is unchanged. Staging adds one Micro. |

Costs to keep off: point-in-time recovery from $100 a month, phone MFA ($75 a month for the first project), log drains ($60 a month each), custom domains ($10 a month each), branching ($0.01344 an hour, about $9.81 a month). Branching from the live project is also ruled out because it may copy production data.

### 5b. Risks to the live project

- **Creating P1 does not touch the live project.** The 2-project limit on Free may block creation. That is a blocked step, not a risk to live.
- **Choosing P2 changes the organisation's plan.** The live project's data is untouched. Billing changes, and the live project's compute cost depends on its size, which is unverified.
- **Existing risk, not caused by staging:** the README says the live project is on Free. If so, it pauses after 1 week of inactivity, and it has no automatic backups. That is the most important live-project risk, and it exists whether or not staging is created. Check it in step S6.
- **Tool risk:** the Supabase tools in this session appear to reach every project in the organisation, including tools that pause, restore, branch, migrate or deploy. Mitigated by S5.
- **Data risk:** copying live data into staging, by branching or restoring a backup, is ruled out.

### 5c. Staging decisions

| ID | Question | Recommended | Type |
|---|---|---|---|
| S6 | Check in the dashboard: the organisation's plan, the number of projects, the live project's compute size, whether the $10 credit is used, and whether backups exist. | Do this first. It decides the rest. | YOUR CHECK |
| S1 | P1 (free) or P2 (Pro)? | P1 if a free slot exists and pausing between windows is acceptable. P2 only if you accept organisation-level Pro billing. | YOUR DECISION |
| S2 | Region and project name. | You choose the region. Default name `qrquick-stage7-staging`. No design effect. | YOUR DECISION (trivial) |
| S3 | Where do the database password, service-role key and publishable key live? | Your password manager, or a local file outside any repo with permissions 600. Never in chat, the scratchpad, the repo, `web/`, `mobile/` or logs. | YOUR APPROVAL |
| S4 | Who holds the TOTP factor for the test admin? | You, entering the code for each run. The harness does not hold the secret. A harness-held staging-only secret is possible, but it is a standing admin credential. | YOUR DECISION |
| S5 | May the Supabase MCP tools touch staging? | No MCP SQL, migration, branch, pause or restore tools for 7C. Use a staging-only connection string under a separate approval. Scoping the MCP connection to staging is an alternative, if it can be done and verified. | YOUR DECISION |
| S7 | Create a local Docker stack (T1)? | No, unless you want faster local iteration. Linked to P-G2. | YOUR DECISION |

### 5d. When staging is required

| Gate | Staging needed before it? | Basis |
|---|---|---|
| 7C implementation **start** | Only if P-G1 is "implementation start". Then the hosted R16 claim check comes first. | Decision 1 wording |
| 7C implementation **approval** | No | It is a separate decision |
| Apply 0011 to staging | Yes, after D4-1 is approved, D1, D3 and D5 are recorded, and the O2 pre-staging review is done | §12A.5, O2 |
| 7C staging matrix and R18 two-session tests (O13) | Yes, before sign-off. Needs 7C implemented, which is not approved. | O13 |
| Recovery procedure text (P-G3) and break-glass text (P-G4) | No, before sign-off | A3, O7 |
| Production release | Yes, plus the production items in section 4 | Decision record |

**Answer to your question:** staging is **not** required before implementation starts, unless you answer P-G1 with "implementation start". It **is** required before sign-off: the 7C staging matrix, the R18 two-session tests, the hosted `aal` and default-grant checks, and the Auth fixture check.

---

## 6. Counts

- **Your decisions:** G1, E1, L1, L3, R1, R2 (approval), R3 (not blocking), P-G1, P-G2, D4-1, D4-2, D4-3, D4-5, S1 to S5, S7. Later: P-G3, P-G4, D4-10, production items.
- **Your approvals (as drafted):** G2, G3, E3, L1, L3, R1, R2, D4-1, D4-2, D4-5, F1, F2.
- **Your checks:** S6.
- **Engineering (I specify, you may veto):** G4, E2, L2, L4, L5, D4-4, D4-6, D4-7, D4-8, D4-9, D4-11, F3, F4, the shop-existence check, the fixture rules, and which O11 checks can run before 7C (U7).

**Not approved by this sheet:** any edit, migration, SQL, test, staging creation, user, Supabase setting change, commit, push, or 7C implementation.
