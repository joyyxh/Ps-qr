# Staging approval package (nothing here has been run)

Target: staging Supabase project `nbzojqlqkrydcjtogwrb`. Staging holds test data only. Every step needs the owner's
explicit approval; **none has been taken**.

## Where staging is today (read-only, 2026-11-27)

Applied: stage1 foundation through payment_intents, cash policy, security hardening (0001 to 0009), 0010 print agents,
0018 auto print, 0019 advisor fixes, 0020 UPI fix, 0021 owner username auth, a guard EXECUTE revoke, 0022 guard at commit.
**Missing:** 0015, 0016, 0017 (licence), 0023, 0024, 0025. The deployed `owner-auth` function is the version without `/claim`.

## Proposed steps (in this order, one approval each)

| # | Step | Pass condition | Rollback |
|---|---|---|---|
| S1 | Apply 0015, 0016, 0017 | Rehearsal-matching table list; `stage7-tests` pass; no existing row changed | Restore staging backup (test data) |
| S2 | Apply 0023 | Policies split, `owner-auth-staging` workflow still 21/21 | `rollback_0023_0025.sql` |
| S3 | Apply 0024 | Claim functions exist, only `service_role` can execute | `rollback_0023_0025.sql` |
| S4 | Apply 0025 | `place_order` 61st call in an hour returns 54000; the cash and UPI order test still passes | `rollback_0023_0025.sql` |
| S5 | Deploy the current `owner-auth` (with `/claim`), `verify_jwt=false` | Live workflow 21/21 plus a claim of a seeded legacy test owner | Redeploy the previous function version |
| S6 | Seed one legacy test owner with a shop and an order, issue a code, claim it, compare ids and counts | Same user id, same shop, same order count | Delete the seeded rows |

Before S1: take a backup and note its id. After S4, run the advisor again and record the warning count against
`SECURITY_ADVISOR_REVIEW.md`.

## Not included

No dashboard setting changes. No production work. Leaked-password protection is a paid-plan feature and cannot be tested
on this free staging project.
