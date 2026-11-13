# Decision and blocker register (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**How to read this.** Each row gives why the item matters, whether it can be resolved locally, what evidence is missing, who must approve it, and what it blocks: **I** = implementation, **S** = staging, **P** = production. Nothing here is marked complete. A working default is an owner-authorised default recorded in the register; it is not an approval.

**Where the IDs come from.** Numbers such as "item 25", "S-4", "M8", "C-1", "O6", "R-D", "R-a" and "D-Q4" are as written in `STAGE7_DECISIONS.md` or `OWNER_DECISION_SHEET.md`. G1–G17, L1–L8 and E12 are as numbered in `STAGE7F_C1_GATES.md` (local evidence folder). The labels RB-, EX- and CF- were assigned in this reconciliation. CF-1 to CF-5 are recorded in register §13F. Section E lists the points this pass could not confirm.

## A. Release blockers

| ID | Item | Why it matters | Local resolution? | Missing evidence | Approver | Blocks |
|---|---|---|---|---|---|---|
| RB-01 | Item 5: admin identity, MFA and Auth UUID. The aal2 requirement is approved (2026-11-02); verification open | Platform-admin RPCs need a real admin identity with AAL2. The UUID must never be inferred | No | Production owner's UUID and MFA status; hosted AAL2 check | Production owner | P; real AAL2 checks in S |
| RB-02 | Item 6: admin UI hosting (RECOMMENDED: separate private deployment) | Decides where 7D runs and what is exposed | No | Owner confirmation | Owner | P |
| RB-03 | G5: hosted migration history (UNVERIFIED). Item 26: live migration state | Numbering and apply order depend on what is applied. Evidence: the Supabase Preview check on `main` reports "Remote migration versions not found in local migrations directory"; hosted tools were not used to confirm it. G5 notes a hosted SQL login that failed earlier with `28P01`; not re-tested here | No. No credential search; no hosted SQL | Owner's read-only list of applied migrations | Owner or production owner | S; P; any renumbering |
| RB-04 | Item 25 and G7: live `place_order` signatures and grants | 7F gates need the live signatures | No | Production owner's read-only list | Production owner | 7F build; P |
| RB-05 | Item 27 and R-D: purge deployment, secrets and capacity. R-D says cleanup stays disabled, but `cleanup-files.yml` on `origin/main` is scheduled (`cron "30 20 * * *"`) | Whether the purge runs is unknown. Evidence: all 21 scheduled runs since 2026-10-21 failed. 15 of them ran on commit `717717b` (2026-10-27 to 2026-11-10); the latest is 42902937080, 2026-11-10. Other runs on `717717b` include 42414034241, 42523229116 and 42701319139. See 13. Each fails at the step that prints "Set QRQUICK_CLEANUP_URL and CLEANUP_SECRET in the repository secrets." | Analysis only; a workflow change needs approval | Whether the workflow is deployed; whether the two secrets are set (names only, never values); recent runs; owner decision on implementing R-D | Production owner; owner (R-D) | P; any claim that the purge is off |
| RB-06 | Item 31 and G8: live Auth and MFA settings | Underpin admin identity | No | Owner's read-only record | Production owner | P; 7C sign-off |
| RB-07 | Item 34: test data and demo seed on live | Demo data on live would show to real shops | No | Whether `supabase/seed/demo_seed.sql` ever ran on live | Production owner | P |
| RB-08 | Items 23 and 24; G14: duplicate-print defect (23) and refund-and-claim defect (24). Owner choice for 24 is R-a, R-b or R-c | Printing and money correctness. Retry is excluded until item 23 | Diff review only, after a proposed change | Diff review (M7); owner choice for item 24 | Owner; reviewer | 7F closure; retry; P |
| RB-09 | S-4: signed file link valid 180 s (RECOMMENDED; under item 35) | A modified agent could print with a link issued before a lapse, without calling `mark_printing` | No | Owner accepts the window or reduces it | Owner | 7F build gate; enabling |
| RB-10 | S-5: a `markPrinting` failure returns without printing or reporting (IMPLEMENTATION GATE; under item 35; G11 "Missing") | Static reading only: `worker.mjs` lines 258–264, verified 2026-10-30 | A test can be written locally; running it needs local-test approval | Local runtime test result and owner's record of it | Owner | 7F build |
| RB-11 | Item 32: kill switch (IMPLEMENTATION GATE); D-I32 (PENDING); G2 | The only off switch for enforcement | Draft done in local evidence folder (DRAFT, NOT APPROVED) | Owner decisions on D-I32, including D-I32-b: a missing or invalid row is treated as off, which sits in tension with a fail-safe reading | Owner | 7F build; activation; implementation |
| RB-12 | Item 33: lock order. Placement decided 2026-11-09; code and tests not approved. G3 and D-R18-T2 | Lock order across approve, claim and mark. Concurrency correctness | No. Code not approved. Two-session tests are staging-only | Owner approval for code; separate approvals to set up and run staging; re-approval of the changed test 2 expectation (D-R18-T2) | Owner | I; S; P |
| RB-13 | C-1: lawyer review of the held-file release rule and related questions (L1–L8 in STAGE7F_C1_GATES.md; none answered) | Held-file release and retention. Enforcement cannot be enabled without it | No | Written lawyer answers, recorded as dated records | Lawyer; owner records them | 7F build; enabling |

## B. Pending decisions (none approved)

| ID | Decision | Status now | Local resolution? | Missing evidence | Approver | Blocks |
|---|---|---|---|---|---|---|
| D-MIG | Migration numbers (owner decision 2). The proposal to move the licence files to 0015–0017 and 7F to 0018 is NOT approved. Files are at 0011–0013. Combining is G16, not given | Analysis only (`03`) | No | Owner approval; RB-03. A renumber also needs path edits in the admin tests (0011–0013 are read by path), `admin/README.md`, the 7E comments and `docs/STAGE7E_LICENCE_STATUS.md` | Owner | Any renumbering; combining; S; P |
| D-Q4 | Refusal mechanism. Option A is the §13E working default; the brief lists D-Q4 as pending | Working default, not an approval | Draft only | Owner approval; CF-2 | Owner | I; S |
| D-Q5 | Held-job wording: owner text, staff text and approve refusal text | Working default text (§13E) | Drafting only | Owner approval of placement and texts | Owner | UI change |
| D-Q5b | Customer tracking label for held orders (currently "Printing") | OPEN; no recommendation | No | Owner decision; lawyer review through C-1 (L5) | Owner; lawyer | Customer-facing change |
| D-HS | Hold start for shops that were never ACTIVE (G4). The clamp is not adopted | OPEN | No | Owner decision | Owner | Hold-start code for those shops; enabling |
| D-I32 | Kill-switch design (see RB-11) | PENDING | Draft done | Owner decision | Owner | 7F build; activation |
| D-R18-T2 | Two-session test 2 expectation changes under Q4 (G3) | PENDING | No | Owner re-approval after D-Q4 | Owner | S (item 33 tests) |
| E12 | `too_many_claims` text after five unresolved refusals (G1) | Open | Draft only | Owner text decision | Owner | Q4 implementation |
| G15 | Recovery rule 10 for printing approval (G15) | Needed before the T33-4 and T33-5 tests can run | No | Owner decision | Owner | Item 33 tests |
| C-3 | Held-file policy. §13C records DECIDED (hold back); §13B and the brief question it | Recorded; confirmation open (CF-1) | No | Owner's written confirmation | Owner | Enabling; 7F sign-off |

## C. Owner confirmations of recorded decisions (register §13F)

| ID | Item | Why it needs confirmation | Approver |
|---|---|---|---|
| CF-1 | C-3 branch | §13C says DECIDED (hold back); §13B says the owner's C-3 instruction is not recorded and needs confirming; the brief lists C-3 as pending | Owner |
| CF-2 | Q4 "without incrementing `claim_count`" | §13C asks the owner to confirm that reversing the increment meets that wording. Option A makes the reversal a separate release call, so a failed release leaves the increment in place | Owner |
| CF-3 | Part 1L and §12A.17 items B (custom-grant boundaries), C (extend lengths) and E (provisional 1,000 denial-detail ceiling) | Recorded as "Owner decision record (2026-11-06)". That instruction is not in the files reviewed; the committed text lists these items as OPEN | Owner |
| CF-4 | Item number 19 | Used for two items. §14.2 item 19 is "Advisers (decision 11)". The shop-facing licence view row cites "owner decision 1, 2026-11-09" for Android DEFERRED. The numbered "Owner decision 1" record is dated 2026-10-31 and concerns the licence unit | Owner |
| CF-5 | Committing §13A–§13F and decision-sheet Parts 1K–1N | Local-only text; the committed register and sheet do not have them | Owner |

## D. External and local gates

| ID | Gate | Local resolution? | Approver | Blocks |
|---|---|---|---|---|
| EX-01 | Local PostgreSQL for behavioural tests of 0011–0013 (G10). Logs exist only for earlier file versions (2026-11-07 and 2026-11-08); the current files have not been run | No; needs setup approval | Owner | S (evidence) |
| EX-02 | Staging database (O12; G9) | No | Owner | S |
| EX-03 | Combine Chain A with the licence line; commit; PR; merge (G16) | No | Owner | 7F build; S |
| EX-04 | Build approval for 7F (G12) and enabling approval (G13). Enabling needs C-1 answered and C-3 confirmed | No | Owner, after C-1 | 7F build; P |
| EX-05 | Emergency-disable and recovery procedure required by O6 and O7 (2026-11-02) before 7C implementation | Not evidenced in this review | Owner | 7C sign-off; activation |
| EX-06 | Print-agent mapping for `order_not_printable`, which returns HTTP 500 `server_error` (§13F known-issue 1). Recorded in §13F only, not in the earlier register rows or the decision sheet. The SQL tests on `main` expect the code | Yes, on an isolated branch from `37e4623`; the mapping is part of D-Q4 | Owner | Chain A correctness; 7F |
| EX-07 | `CLAUDE.md` migration section (G17). The draft is untracked and awaits owner review | Draft exists | Owner | Documentation |
| EX-08 | Privacy policy, terms, refund text, takedown and consent (item 29; L8) | No | Owner; lawyer | P |
| EX-09 | Notice to existing shops and free period (item 11; L6). L6 also cites item 8, which §14.2 defines as revocation and future coverage | No | Owner; lawyer | P |
| EX-10 | Refund rules for affected paid orders and licences (§14.2 item 10; §9 item 6; L7). L7 cites "items 6 and 10"; §14.2 item 6 is admin UI hosting | No | Owner; lawyer | P |
| EX-11 | Legal review of identity-derived request hashes (L4) | No | Lawyer | 7C sign-off |
| EX-12 | Retention: denial logs (M8, proposed 90 days; L3) and user IDs in ledgers (S-6) | No | Lawyer; owner | P; retention jobs |
| EX-13 | Stage 7 planning approval and closure criteria (a)–(e) (§16) | No | Owner | Stage 7 approval; Stage 8 |
| EX-14 | Stage 6 merge order: `stage6-simulated-printer` (885d28b) is not an ancestor of `origin/main` and has no PR (CLAUDE.md) | No | Owner | Stage 6 integration |
| EX-15 | Publication order for 7E. 7E calls `shop_licence_status`, which is defined only in `0012` (unpublished). Options: publish 7B/7C first and stack 7E on it (recommended; see 09), or accept that the owner screen returns an error until 0012 is applied | No | Owner | 7E pull request; any 7E release |

## E. Not confirmed in this pass

- G15 names the tests T33-4 and T33-5. They were not located in `STAGE7F_ITEM33_PLAN.md` in this pass.
- The `28P01` hosted-login note comes from `STAGE7F_C1_GATES.md` (G5). It was not re-tested, and no hosted access was attempted.
- The "31 of 34" owner-smoke count is supported by `baseline-owner-smoke.out` (2026-11-08): 31 PASS lines, 3 FAIL lines, then a TimeoutError. It was not re-run on 2026-11-10.
- L6 and L7 cite register item numbers that do not match §14.2 (see EX-09 and EX-10). The owner should confirm the intended items.
- Item 35 is an umbrella for R1–R19, S-1–S-8 and M1–M8. S-4 and S-5 are the rows under it that this register tracks.
- The AR-04 failure in `read_run1.log` (2026-11-08 09:52) has no recorded detail. The same check passed in `read_run2.log` one minute later. The cause is not established.
- The three FAILs in `rpc_tests.log` (2026-11-07 04:34) are not explained in the logs. `rpc_tests2.log` (04:35) records 0 FAIL. What changed between the two runs is not recorded.
- The capture of `web/tests/fixtures/licence-status-rpc.json` (stated as 2026-11-08, local PostgreSQL 16.15) is described in the fixture and in `docs/STAGE7E_LICENCE_STATUS.md`. No capture script or log was located.
