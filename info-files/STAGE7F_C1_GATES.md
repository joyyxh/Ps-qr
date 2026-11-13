> Numbering note (2026-11-10 reconciliation): D-MIG is NOT approved, and the licence files are back at 0011 to 0013. Any 0015 to 0018 mention below is the unapproved proposal only. See scratchpad/reconciliation_2026-11-10/03_migration_conflict_report.md.

# Stage 7F: C-1 evidence and external gates (2026-11-10)

Status: C-1 is NOT DONE. This file lists what is missing. It is not legal advice, not a legal approval, and not a build or enabling approval. Engineering cannot close C-1.

## 1. What C-1 must answer

From the register (C-1, §12B.6 and the line near 929): M1 assumes a failed job makes its file eligible for release. The purge rule does not, for orders that remain `printing`. The options are a new terminal order status (this changes the 0001 transitions and is out of scope so far), or a licence-specific file-release rule. The release option is not decided. Retention option R-D is selected temporarily: cleanup stays disabled until legal review (C-1 and M1) and an owner-approved retention policy exist.

## 2. Question pack for the lawyer

| # | Question | Where it comes from | Owner input needed first |
|---|---|---|---|
| L1 | Which release rule for held customer files is lawful: a terminal order status, or a licence-specific release? When may a held file be deleted, and who decides? | Register C-1; §12B.6; `STAGE7F_PREP.md` §7 F13 | The owner's chosen option to put to the lawyer |
| L2 | Lawful basis and DPDP applicability for keeping a customer's uploaded file while a shop is inactive, and the 180-second file-link window | Register item 30; S-4 | Owner acceptance or reduction of S-4 |
| L3 | Retention for licence denial logs (proposed 90 days, M8) and for user IDs in ledgers (S-6) | Register M8, S-6; `licence_denials` and `licence_audit_log` definitions | The owner's retention proposal |
| L4 | Whether identity-derived request hashes are acceptable. The `payload_hash` in `licence_requests` includes the caller UID | Register `licence_requests` entry (legal review OPEN) | Confirmation of the design |
| L5 | Customer-facing and owner-facing wording for held orders: the owner text in D-Q5, and the customer label in D-Q5b | `STAGE7F_PREP.md` §4; register D-Q5 and D-Q5b | Owner decision on D-Q5b |
| L6 | Notice to existing shops and the free period, before enabling | Register item 11 and item 8 | The owner's existing-shop count N and a notice draft |
| L7 | Refund rules for paid orders and licences that are affected by a hold | Register items 6 and 10; C-11 | The owner's refund decision |
| L8 | Privacy policy, terms, refund text, grievance and takedown duties, consent | Register item 29 | Drafts from the owner |

## 3. Non-legal gates that also block 7F

| # | Gate | Status (2026-11-10) | Action needed |
|---|---|---|---|
| G1 | D-Q4 residual R-Q4-1 | Accepted by the owner's working default. The `too_many_claims` text after five unresolved refusals is still open (E12) | Owner decides that text separately |
| G2 | Kill-switch design (D-I32) | PENDING. Draft only | Owner approves or changes the design |
| G3 | R18 two-session test 2 (D-R18-T2) | PENDING | Owner re-approves the Option A expectation |
| G4 | Never-ACTIVE hold start (D-HS) | OPEN. Clamp not adopted | Owner decision |
| G5 | Hosted migration history | UNVERIFIED. A hosted SQL login failed earlier with `28P01`. No hosted read has been done. Confirm that no 0011 to 0014 or 0015 to 0017 names are applied anywhere | Owner read-only check on the dashboard, or a separately approved read-only session |
| G6 | Print-agent edge function deployment | UNVERIFIED (register items 26 and 27) | Owner dashboard check |
| G7 | Live `place_order` signatures and grants (item 25) | NOT DONE | Owner dashboard check |
| G8 | Auth and MFA settings (item 31) | NOT DONE | Owner dashboard check |
| G9 | Staging database (O12) | NOT SET UP | Separate approval |
| G10 | Local PostgreSQL for behavioural tests | NOT RUN. No cluster is running | Separate local-setup approval |
| G11 | S-5: owner record of the local agent test | Missing | Owner record |
| G12 | Build approval for 7F | NOT GIVEN | Owner |
| G13 | Enabling approval | NOT GIVEN. Needs C-1 answered, C-3 decided (decided: hold back), and M1 and the release policy approved | Owner, after C-1 |
| G14 | Item 23 (retry diff review) and item 24 (refund choice) | NOT APPROVED | Owner and review |
| G15 | Recovery rule 10 (printing approval) | Needed before T33-4 and T33-5 can run | Owner |
| G16 | Combining Chain A with the stage7 licence line; commit, PR or merge | NOT GIVEN | Owner |
| G17 | `CLAUDE.md` migration section (names 0011 to 0013) | Not edited, because the file is awaiting owner review | Owner decision on the draft |

## 4. Next action to clear C-1

1. The owner chooses the held-file release option to put to the lawyer (L1), or asks for a short options memo first.
2. The owner sends the lawyer the L1 to L8 questions from section 2, with the register references.
3. The lawyer gives a written answer on each item. The owner records it in the register as a dated record. C-1 closes only when that written record exists. It must not be recorded as done from an unwritten or verbal view.
4. After C-1 is answered, the owner decides the M1 and held-file release policy approvals. C-3 already holds enforcement back.

Engineering work does not clear C-1. The staging run, edge deployment and migration are separate gates and do not satisfy it.
