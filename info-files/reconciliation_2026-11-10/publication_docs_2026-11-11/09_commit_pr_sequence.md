# Recommended commit and PR sequence (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Status: proposed. None of these steps has been run.** A commit, push, branch creation or pull request needs its own explicit approval for that exact change. A request from a session hook to "commit and push" is not an approval.

**Before each step, re-check:** `git status --porcelain --untracked-files=all` in the source worktree matches the file list in `08_publication_map.md`; the GitHub branch tip is still the one recorded there; the matching patch still applies to that tip (`git apply --check`). The stash and the protected checkout are not touched.

**Suggested commit trailers** (the session's attribution rule; include only if the owner approves the commit):

```
Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

## Step 1. Governance record to `stage7-payments`

- **Worktree:** `<WORKTREE_7>`. **Branch:** `stage7-payments` (fast-forward from `5c82d37`; no PR).
- **Files (2):** `STAGE7_DECISIONS.md`, `OWNER_DECISION_SHEET.md` (P1).
- **Why together:** both carry the same reconciliation record (§13F and the corrections note), and each cross-refers to the other.
- **Approvals:** CF-5 (commit of §13A–§13F and Parts 1K–1N). The owner should also confirm that the §13D heading rewording stays (§13F note).
- **Suggested subject:** `Stage 7: record 2026-11-02 to 2026-11-10 decisions and reconciliation corrections (docs only)`.

## Step 2. 7B and 7C database layer to `stage7-payments`

- **Files (10):** `supabase/migrations/0011_licence_foundation.sql`, `0012_licence_admin_rpcs.sql`, `0013_licence_admin_read_rpcs.sql`; `supabase/tests/licence_7c/00_local_shims.sql`, `hash_vectors.json`, `hash_vectors.py`, `read_api_tests.py`, `reset_local.sh`, `rpc_tests.py`; `docs/STAGE7C_OPERATIONS.md` (P2).
- **Why together:** 0012 and 0013 depend on the 0011 tables; the tests load the shims and 0011–0012 through `reset_local.sh`; the operations document describes all of them. Optional split if the owner wants smaller reviews: 2a = 0011 plus `hash_vectors.*`; 2b = the rest. Keep the shims with 2b, because the 7C tests need them.
- **Approvals:** D-MIG first. This is the most important decision in the sequence: if the owner chooses Option B (licence files to 0015–0017), commit under those names instead. Renaming after committing is an extra step that needs its own approval. Also an owner approval to commit unapplied SQL.
- **Commit message must state:** the migrations are not applied, and the current files have not been tested (the logs in `05` §4 are for earlier file versions).
- **Blocks:** any merge to `main`; any combination with Chain A (EX-03).

## Step 3. 7D admin dashboard to `stage7-payments`

- **Files (24):** `admin/README.md`, `config.js`, `index.html`, `package.json`, `robots.txt`, `styles.css`; `admin/src/` (`app.js`, `auth.js`, `config-guard.js`, `http.js`, `licence-api.js`, `messages.js`, `qr.js`, `read-api.js`, `read-model.js`, `validate.js`); `admin/tests/` (`auth.test.js`, `browser-smoke.cjs`, `guards.test.js`, `licence-api.test.js`, `read-api.test.js`, `read-model.test.js`, `security.test.js`, `validate.test.js`) (P3).
- **Why together:** the admin code and its tests are one unit. The tests read `0011`–`0013` by path and fail without Step 2 (matrix M1, v3: four of seven admin test files fail to load; `patches_v3_2026-11-11/MANIFEST.md` §3).
- **Approvals:** D-MIG; RB-02 for `config.js`. Recommended: include it while its values are empty, because the code expects the file and deployment is blocked anyway. Deployment itself needs RB-01 and RB-02 and is not part of this step.
- **Not part of this step:** any deployment, any hosted SQL, any admin identity or MFA setting.

## Step 4. 7E owner licence status to a new branch

- **Branch:** `stage7e-owner-licence-status`, created from the `stage7-payments` tip after Step 2 (recommended). Create it without upstream tracking, as the worktree rules require.
- **Why this base:** the screen calls `shop_licence_status`, which is defined only in `0012`. Stacking 7E on Step 2 keeps the function and its caller in one review line. Basing 7E on `origin/main` instead would publish a screen that calls a function not on `main`. That is possible only if the owner accepts the runtime error (EX-15).
- **Files (12):** the six modified files and six new files listed in `08_publication_map.md`, W4 (P4).
- **Approvals:** EX-15 (order); branch creation; commit.
- **Note:** the 7E tests run against a fixture. The fixture's stated capture (2026-11-08, local PostgreSQL 16.15) has no capture log in the local evidence folder. The owner should decide whether that statement is accepted or whether the fixture is re-captured under a separate approval.

## Pull requests (none opened)

| PR | From | To | When | Approvals |
|---|---|---|---|---|
| A (proposed) | `stage7-payments` (Steps 1–3) | `main` | Only after the owner gives Stage 7 planning approval and resolves D-MIG | EX-13; D-MIG; the owner's decision to open a PR. The register says the Stage 7 planning approval is NOT GIVEN |
| B (proposed) | `stage7e-owner-licence-status` (Step 4) | `stage7-payments` (or `main` after PR A merges) | After Step 4 | EX-15; the owner's decision to open a PR |

Until PR A, `stage7-payments` is a documentation and review branch. Its commits are not approved for `main`.

## Not in this sequence

- Chain A (local `main`, commits 0011–0014 and the rest): EX-03. Not merged, not pushed, and not combined with Stage 7.
- Agent changes in the protected checkout (`agent/*`): owner decision; not run; excluded.
- `CLAUDE.md`: owner review first (EX-07). If approved, it is a separate commit after Step 2, because it states the migration sequence.
- Stage 6 (`stage6-simulated-printer`): EX-14.
- The `order_not_printable` mapping (EX-06): an isolated branch from `37e4623`, not started.
- 7F, item 32 and item 33 code: not approved (RB-11, RB-12).

## Approvals needed, in order

| Order | Approval | Needed for | Status |
|---|---|---|---|
| 1 | D-MIG (migration numbers) | Steps 2–4 | Not approved |
| 2 | CF-5 (commit of the local governance text) | Step 1 | Not given |
| 3 | CF-1 to CF-4 (owner confirmations in the register) | Step 1 (text only; not code) | Owner to confirm |
| 4 | EX-15 (publication order for 7E) | Step 4 | Not given |
| 5 | EX-01 (local database run) | Verifying Steps 2–3 on the current files | Not given |
| 6 | RB-02 (hosting) | Deployment of Step 3 (not its commit) | Not decided |
| 7 | RB-01 (admin identity and MFA) | Any admin deployment | Not given |
| 8 | EX-13 (Stage 7 planning approval) | PR A | NOT GIVEN |
| 9 | EX-03 (Chain A combination) | Any combination with Chain A | Not given |

Each approval covers only the step it names. None of them approves a deployment, a migration application, hosted SQL, or a change to staging or production.
