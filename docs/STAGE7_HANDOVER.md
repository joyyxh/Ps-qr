# Stage 7 handover (branch `stage7-implementation-2026-11-13`, 2026-11-14)

Status: **Stage 7 is NOT complete.** This branch contains the Stage 7B/7C licence database, the 7D admin panel, the 7E owner licence status, the fail-closed print agent (P5), the approved D-MIG Option B numbering, unit-test CI, and the cleanup schedule removed. Stage 7F (refusal, kill switch, held-file release, lock and signature tests) is **not built**. Chain A is **not integrated**. Enforcement is **OFF**, and nothing on this branch turns it on.

Nothing here has been applied to a hosted database, deployed, merged into `main`, or run against staging or a physical printer.

## What is on this branch

| Area | What it contains | Where |
|---|---|---|
| D-MIG Option B | Licence migrations `0015_licence_foundation.sql`, `0016_licence_admin_rpcs.sql`, `0017_licence_admin_read_rpcs.sql`. Chain A numbers 0011 to 0014 are reserved for Chain A. 0018 is reserved for 7F. | `supabase/migrations/`, `docs/STAGE7_MIGRATION_MAP.md` |
| 7B/7C database | Licence tables, guards, admin RPCs, read RPCs. Local harness. | `supabase/migrations/0015` to `0017`, `supabase/tests/licence_7c/` |
| 7D admin | Static admin panel with its tests | `admin/` |
| 7E owner status | Owner licence-status screen, contract checks, tests | `web/src/owner-licence.js`, `web/src/licence-status.js`, `web/tests/licence-status.test.js`, `docs/STAGE7E_LICENCE_STATUS.md` |
| Browser checks | Five Playwright scripts, with the greyed-out check kept open | `web/tests/browser/` |
| P5 fail-closed agent | Prints only after an explicit server confirmation. Commit `a1a91f1` is kept unchanged and merged. | `agent/src/worker.mjs`, `agent/test/worker.test.mjs` |
| Decision records | Replaced with the newer copies from the audit package (2026-11-09 wording and Stage 7F decisions §13C). Each has a dated renumbering note. Historical text is unchanged. | `OWNER_DECISION_SHEET.md`, `STAGE7_DECISIONS.md` |
| CI | Runs the agent, web and admin unit tests on push and pull request | `.github/workflows/unit-tests.yml` |
| Cleanup workflow | Schedule removed (reversible Option B). Manual run kept. | `.github/workflows/cleanup-files.yml` |

## Tests run (local, 2026-11-14, exact results)

| Suite | Result |
|---|---|
| agent `node --test` (includes P5 fail-closed test) | 62 pass, 0 fail |
| web `npm test` | 212 pass, 0 fail |
| admin `npm test` | 72 pass, 0 fail |
| Combined chain on a throwaway PostgreSQL 16.15 cluster (platform stand-ins, origin 0001 to 0010, licence 0015 to 0017, test defaults, staging row) | Applied with no error |
| licence `rpc_tests.py` on that chain | 282 pass, 0 fail |
| licence `read_api_tests.py` on that chain | 125 pass, 0 fail |
| licence `hash_vectors.py` | 0 failures |
| Browser `owner-smoke.cjs` (Playwright Chromium) | 39 of 39 |
| Browser `qr-smoke.cjs` | 12 of 12 |
| Browser `features-smoke.cjs` | **23 of 24.** The open check is "the greyed-out boxes say why". No approved wording exists (owner decision). The check is kept, not weakened. |
| Browser `stats-smoke.cjs` | All checks passed |
| Browser `licence-smoke.cjs` | 33 of 33 |

Not run: staging (EX-02 not granted), hosted database checks, physical printer checks, the 7F lock tests (item 33), and the live signature tests (item 25). GitHub Actions unit-test CI subsequently passed on 2026-11-14 (run 43603382278; agent, web and admin jobs all successful).

## Test harness changes (for owner review)

- `supabase/tests/licence_7c/combined/`: a platform stand-in file, a combined reset script that loads every migration in `supabase/migrations/`, and a test-only defaults file. The defaults give the licence tests' bare `insert into public.shops (id)` a valid slug and name. They are not product migrations.
- `reset_local.sh` and `reset_combined_local.sh` now create the test database with `encoding 'UTF8' template template0`. A server default of `SQL_ASCII` makes `normalize()` fail, and Supabase is UTF8.

## Not done, and why

### 1. Chain A integration is blocked by a missing commit (external)

- Chain A is local `main` commit `37e4623` ("Add owner email-code registration and password setup"). It was never pushed. The commit object is **not** in any repository, reflog, bundle or audit artifact searched (see `docs/STAGE7_CHAIN_A_RECOVERY.md` for the full list).
- Partial recovery only. The four migrations `0011` to `0014` are recovered as read-only copies, and `0011` and `0012` match the hashes in the audit manifest. The commit message and one owner file (`web/src/owner.js`, 1826 lines) are also recovered. Their provenance is not verified against the missing object. They are **not** on this branch.
- Not recovered: `web/src/owner-api.js`, `styles.css`, the Chain A `package.json`, the customer screens, the Chain A browser tests, `logic.js`, `auth.js`, and the rollbacks for `0013` and `0014`. The `mut-claim/` copies of `0011` and `0012` are mutants and must not be used.
- Integration is not performed. Applying `0013` alone would revoke `update (cash_payment_timing)` on `shops`, while the current owner code still saves that column (`owner-api.js` line 10, `owner.js` line 840).
- Consequences: P4 and U6 cannot be reconciled with Chain A's versions of those files. 7F's refusal sits on Chain A's functions, so it cannot be built on a correct base yet.
- **Owner action:** push local `main` commit `37e4623` to a branch, or send a git bundle or a patch of `4d97e40..37e4623`. That is the only source that unblocks integration.

### 2. Stage 7F: not built

| Item | Status | Blocker |
|---|---|---|
| Refusal at mark time (D-Q4, Option A working default) | Not built | Chain A (above). Also: the owner's confirmation that a refusal does not increment `claim_count` is recorded as not given (STAGE7_DECISIONS §13F, CF-2). |
| Release of a held job (`agent_release_licence_hold`) | Not built | Same as refusal |
| Kill switch (D-I32) | Not built | Design is a draft, approval pending |
| Held-file release and auto-fail (M1) | Not built | **C-1: lawyer review, not done. External, mandatory.** |
| Hold start (Q2, prior-ACTIVE rule) | Decided, not used | Used only once M1 is approved |
| Hold start for shops never ACTIVE (D-HS) | Open | Owner decision |
| Staff held text, approve-refusal text (D-Q5) | Working default text, not built | No refusal path to display it yet |
| Customer label for held orders (D-Q5b) | Open | Needs C-1 first |
| Lock tests (item 33) | Not built | Placement decided 2026-11-09. Code and two-session tests not approved. Staging-only per the plan. |
| Live signature tests (item 25) | Not done | Hosted owner-dashboard check |
| Migration `0018` | Not created (reserved) | Depends on the items above |

Enforcement stays OFF. The C-3 decision (enforcement held back) is recorded in §13C, but STAGE7_DECISIONS §13F (CF-1) says written owner confirmation is still needed.

### 3. Owner decisions and external gates still open

- **C-1**: lawyer answer on the held-file release rule (external, mandatory).
- **EX-02**: staging project approval (not granted). Staging checks and the two-session tests (RB-12) are not run.
- **S-4**: the 180-second signed file link window. Recommended to accept or reduce. Not accepted.
- **S-5**: physical printer runtime. The agent is tested with fake adapters only.
- **RB-01 / C-6**: admin identity and MFA. **RB-02**: hosting. Deployment is blocked until these are decided.
- **EX-15**: owner approval of the merge order and the PR to `main`. This PR is not merged.
- **Greyed-out wording**: the features smoke check stays open (23 of 24).
- **D-R18-T2**: R18 test 2 expectation, pending.
- **RB-11**: definition not located in the records.

### 4. Cleanup workflow

- Repository change made: the cron schedule was removed from `cleanup-files.yml` (owner-recommended Option B). Manual dispatch remains. The earlier scheduled runs failed (22 of 22) because the secrets were empty, and nothing was deleted. A manual run with both secrets set would **delete** expired customer files, so it needs the owner's retention approval first.
- Runtime state not changed: `gh workflow disable cleanup-files.yml -R joyyxh/Ps-qr` has not been run, because this session's `gh` token is invalid. Until the owner or an authenticated session runs it, GitHub still shows the workflow as active.

### 5. CI

- `unit-tests.yml` runs the agent, web and admin unit tests. GitHub Actions run [43603382278](https://github.com/joyyxh/Ps-qr/actions/runs/43603382278) completed successfully on 2026-11-14: all three jobs passed.
- Not in CI: the browser smokes, the PostgreSQL licence suites, and any hosted check.

## Record conflicts found during this work

These were taken from the decision records as they were read during this work. Only the item marked as checked was re-verified in the final pass.

- D-MIG: `GATE_REGISTER.md` row 20 and STAGE7_DECISIONS §13F say "NOT APPROVED", from before 2026-11-14. The owner's 2026-11-14 approval is recorded only in the new renumbering notes. The owner should update the register.
- P5: the 2026-11-12 README says "no commit". Commit `a1a91f1` and merge `86b4b99` are now on this branch.
- C-3: §13C and §14.3 say decided (hold back). §13F CF-1 says written confirmation is needed. OWNER_DECISION_SHEET Part 8 says "both OPEN".
- F17: PREP §6 and §7 say `v_last_end` can include future periods. The 2026-11-13 README says it cannot on the path that computes it. Not re-checked in the final pass; the `0015` coverage query (around lines 466 to 512) should be read against it.
- M1 status: §12B.2 and §12B.6 say PROPOSAL. §14.5 says IMPLEMENTATION GATE.
- Item 33 plan §7 says rollback would drop "the approve payment check". Checked: base 0010 lines 461 to 463 contain that check (`verify the payment before printing`), so the claim needs review.

## Provenance of recovered inputs (SHA-256, verified against the publication index)

| Input | SHA-256 |
|---|---|
| P2 (7B/7C database, pre-renumbering) | `0b51ad5e4065edbb8d1cd43fb1c291d7d6e0b01766e3102a715501d871da20a7` |
| P3 (7D admin) | `cc56fd707ad09a7bbb09c44bd9bae8695b8c5ab21be74ce2ea6ee25d00942a43` |
| P4 (7E web) | `7119a05ca701d536cf073324cd4c13aa87ac375104430a10e0071d4298ab5c10` |
| U6 (browser smoke and layout) | `f19cd2381a5eed65c604a62751855f7f995155da809820332f5f761f0f64be26` |
| P5 (agent, superseded by commit `a1a91f1`) | `d1bb8fe3325bf194986db85980e662351957c49dd1c139f1f5e5dd5a722f813e` |

The P2 to P5 patches were recovered from `audit_handover_2026-11-13/units/` on branch `audit-package-2026-11-13`. Their hashes match the publication index. Base commit: `5c82d37` on `stage7-payments`.

## Next steps, in order

1. Owner: push or bundle Chain A commit `37e4623`.
2. Owner: decide D-Q4 (confirm CF-2), D-I32, D-HS, S-4, C-3 written confirmation, and approve or reject item 33.
3. Owner: legal review through C-1. Nothing held-file related may be enabled before it.
4. Owner: run `gh workflow disable cleanup-files.yml -R joyyxh/Ps-qr` (or approve the repository change as it stands), and confirm the first `unit-tests.yml` run.
5. Engineering, after step 1: integrate Chain A, reconcile P4 and U6 against it, then build 7F's refusal on top of Chain A's functions and write `0018`.
6. External, separate approvals only: staging (EX-02), hosted migration checks, physical printer (S-5), and the release decision (EX-15, RB-01, RB-02).
