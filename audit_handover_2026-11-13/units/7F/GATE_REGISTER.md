# Stage 7F gate register (2026-11-12)

Sources: STAGE7_DECISIONS.md (§12B, §13C, §13D, §13E, §13F, §15.3) and OWNER_DECISION_SHEET.md. Status is the latest recorded status. "Working default" means the owner's 2026-11-10 authorisation to apply a default. It is not design approval, build approval or enabling approval (§13E).

Enforcement is OFF. Nothing in this register turns it on.

## Gates

| # | Gate | Recorded status | What is needed | Recorded recommendation | Consequence if unresolved |
|---|---|---|---|---|---|
| 1 | C-1, lawyer answer on the release rule for held files | OPEN | Lawyer answer. Option (i): a new terminal order status (changes 0001 transitions). Option (ii): a licence-specific release rule. | Lawyer answers first | Blocks M1, the C-3 prerequisite and the 7F build |
| 2 | C-3, enforcement held back | DECIDED 2026-11-09 (§13C): held back | None now. M1 must exist before enabling. | n/a | Enforcement cannot be enabled |
| 3 | D-Q4, refusal mechanism at mark time | Working default: Option A (§13E). Not approved (2026-11-10 brief). | Owner approves an option. Then build the refusal, the release and tests for both outcomes. | §13D recommends Option B; the owner default is Option A | No refusal exists. R18 and T33 tests cannot be final. |
| 4 | D-Q5, owner wording for held jobs and the approve refusal text | Working default text: "Printing is paused. This shop has no active QRquick licence, so this file will not print until the licence is active." | Owner approves wording and placement | Working default applied | Staff text not final |
| 5 | D-Q5b, customer tracking label for held orders | PENDING. No recommendation. Needs lawyer review through C-1. | Owner decision after C-1 | None recorded | Customer label stays "Printing" (F7) |
| 6 | D-HS, hold start for a shop never ACTIVE | OPEN for never-ACTIVE shops. The prior-ACTIVE rule is approved (Q2). | Owner answer for never-ACTIVE shops | The §13D clamp is not adopted | Not testable |
| 7 | D-I32, kill-switch design (a) to (e) | PENDING | Owner approves the design | Approve as drafted | Enforcement cannot be enabled safely. No switch exists. |
| 8 | D-R18-T2, R18 test 2 expectation | PENDING. Depends on gate 3. | Re-approve after the D-Q4 option is chosen | Follows gate 3 | R18 expectation not final |
| 9 | M1, held-file release and auto-fail | Not implemented. Depends on C-1. | C-1, then owner decision | None recorded | Held files keep customer files indefinitely (C-3 note) |
| 10 | RB-11 | Definition not located in the records read | Confirm the definition before relying on it | None | Unknown |
| 11 | RB-12, two-session tests | Needs a staging project | EX-02 staging approval | n/a | Lock tests unverified |
| 12 | EX-02, staging project | NOT GRANTED | Owner approval, staging only | n/a | No S1 to S9 run |
| 13 | S-4, 180-second signed file link window | RECOMMENDED: accept or reduce. NOT accepted. | Owner accepts or reduces it before 7F (§15.3) | Accept or reduce | 7F build condition unmet |
| 14 | S-5, agent behaviour when mark fails | Static check 2026-10-30. P5 adds a local test (fake harness, 62 of 62 agent tests). Real printer runtime NOT tested. | Printer test under the physical printing gate | Local test required before 7F (met locally) | Runtime on a real printer unverified |
| 15 | Item 25, live signature tests of both signatures | NOT DONE | Tests on staging or local DB, as approved | n/a | 7F build blocked |
| 16 | Item 32, kill-switch design approved | PENDING (= gate 7) | Owner approval | Approve as drafted | 7F build blocked |
| 17 | Item 33, lock tests on approve, claim and mark | NOT DONE | Tests after G16 combination | n/a | Locks unverified |
| 18 | Order of items 23 and 24 | Not decided | Owner decision | n/a | Sequencing undecided |
| 19 | G16, combine Chain A (0011 to 0014) and the licence lines | Scratch apply passes. Combination needs D-MIG and EX-15. | D-MIG and EX-15 approvals | n/a | 7F cannot sit on Chain A |
| 20 | D-MIG, renumbering 0011 to 0013 to 0015 to 0017, 0018 for 7F | NOT APPROVED. Working default applied and reverted 2026-11-10 (§13F). Files are at 0011 to 0013 again. | Owner approves or rejects | Not recorded beyond the proposal | Chain A and the licence files share 0011 to 0013 on unpushed local `main` |
| 21 | C-6 and RB-01, admin accounts, UUID and MFA | Unanswered | Owner decision | n/a | Blocks 7A, the bootstrap row and 7C to 7D |
| 22 | Greyed-out card wording (features smoke, "the greyed-out boxes say why") | No approved wording in the records (searched 2026-11-12). The smoke expects "Double-sided (not offered at this shop)", which no record approves. Existing app strings: `app.js:385` "colour printing is not offered at this shop, so this service cannot be ordered" and `app.js:451` "Colour printing is switched off at this shop, so this service cannot be ordered." Neither is approved for these cards. | Owner decides the wording, or accepts the check as a known open item. Nothing is invented or changed here. | None recorded | The features smoke stays at 23 of 24, exit 1 |

## Also open, not 7F

- R-D, cleanup workflow. The records say cleanup stays disabled, but the scheduled workflow is in `main`. Read-only check on 2026-11-12: 22 scheduled runs failed (2026-10-21 to 2026-11-11). Owner chooses A, B or C in `ci_cleanup_2026-11-12/CLEANUP_OPTIONS.md`. Option B (`gh workflow disable`, reversible) is recommended. No change has been made.
- Node 18 CI leg: not run here (only Node 22 is installed). The v2 workflow is not applied.
- CF-4: item 19 is used for two different items in the records. The owner must confirm.
