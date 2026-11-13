# 12. Publication units: exact files, hashes, parents, tests and readiness (2026-11-11)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Status.** Nothing is committed, pushed, branched or opened as a pull request. Every unit below is approval-gated. The commands in each unit run only after the owner approves that exact unit.

**Evidence labels.** *Local* = run on this machine on the exact unit or on an exact export of its base. *Remote* = read from GitHub. *Historical SQL* = logs from 2026-11-07 or 2026-11-08 that ran on earlier file versions; they are not evidence for the current files. *Mocked* = browser or unit checks against fake backends or fake printers. *Hosted, staging, physical printer* = none run.

## 0. Base, graph and why it is shaped this way

- Remote `stage7-payments` head: `5c82d37` (checked 2026-11-11). Remote `main`: `717717b`.
- Recommended order on `stage7-payments`: `5c82d37` → **C2** (P2) → **C3** (P3, after RB-02). **C1s** (P1s, after CF-5) touches different files from P2, so it can go in before or after C2. Placing C2 first keeps the database unit from waiting on CF-5.
- P4 on its own branch `stage7e-owner-licence-status`, based on C2 (EX-15).
- Documentation unit on a dedicated branch `stage7-reconciliation-2026-11-10` from `717717b`, with no pull request.
- P3 and P4 each need P2. They do not need each other: M4 (P2+P4) gives web 212/212, and M3 (P2+P3) gives admin 72/72. Keeping P4 off the admin stack lets its review proceed without waiting for the admin work.
- Chain A (local `main` `37e4623`, unpushed) is excluded from every unit. Its migrations 0011 to 0014 conflict with the licence migrations 0011 to 0013 (EX-03).

## 1. Summary

| Unit | Patch (folder) | SHA-256 (first 16) | Parent | Depends on | Tests on the exact unit | Missing evidence | Draft PR ready? |
|---|---|---|---|---|---|---|---|
| U1 Governance and sanitization (P1s) | `P1s_governance_sanitized.patch` (`patches_v4_proposed_2026-11-11`) | `1601d85e8fbdf336` | `5c82d37` | CF-5 | Apply and content checks only (documents). See §2.1 | Owner review of 11 replacements; CF-5 | Technically yes. **Not approved** (CF-5). Do not open |
| U2 7B/7C migrations, tests, operations doc (P2) | `P2_7B_7C_database.patch` (v3) | `8be19fa7a2e1c4c7` | `5c82d37` | D-MIG; approval of header-comment text | Apply check; admin 72/72 with P3 (M3); web 212/212 with P4 (M4). **No SQL run on current files** | EX-01 local PostgreSQL run; header comments are stale | After D-MIG and the header text are approved |
| U3 7D admin dashboard (P3) | `P3_7D_admin.patch` (v3) | `cc56fd707ad09a7b` | U2 commit | U2; D-MIG; RB-02 | Admin 72/72 with P2 (M3, M6). Admin 23/27 without P2 (M1, expected) | Admin browser smoke log; SQL runs under U2 (EX-01) | After U2 is on the branch and RB-02 is answered |
| U4 7E owner licence screen (P4) | `P4_7E_web.patch` (v3, rev 2) | `e0762d45f011a259` | U2 commit | U2 (0012 RPC); EX-15 | Web 212/212 (M2, M4). Licence browser smoke 33/33 on the M6 tree (web tree identical to M2) | Staging integration (EX-02); 7E fixture-capture log; features, stats, QR and owner smokes not run for this set | After U2 is on the branch and EX-15 is approved |
| U5 Reconciliation evidence and documentation | `publication_docs_2026-11-11/` (no patch) | not a patch | `717717b` | Explicit approval of the branch and push | Leftover scan, checksums and reference check (§2.5). No code tests | None for code; reports are labelled | No PR needed; push to the dedicated branch once approved |

Proposals outside the publication set (need their own approval): CI test workflow (§3.1), README correction (§3.2), cleanup configuration (§3.3, see `13_cleanup_workflow_diagnosis.md`).

## 2. Units

### 2.1 U1: Governance corrections and sanitization (P1s)

- **Purpose.** Replaces 11 local-path, worktree-name or scratchpad references in the decision text with neutral wording. The earlier P1 (`4cbe5136…`) is superseded and must not be published alongside P1s.
- **Patch.** `patches_v4_proposed_2026-11-11/P1s_governance_sanitized.patch`, SHA-256 `1601d85e8fbdf336f2efb452c62ffbf74cf3639cc7c9e7a8df850f238d9f64d8`, 1198 lines, 2 files, with index lines. The patch stays in the local evidence folder and is not in the documentation unit, because it carries the owner's governance text (CF-5). Its manifest is in the unit. It replaces the first draft `5abc5130…` (1196 lines), which was never published.
- **Files.** Both are working-copy text (owner decision records, §13A to §13F and decision-sheet Parts 1K to 1N). Eleven replacements in `STAGE7_DECISIONS.md` remove local paths and worktree names (`p1_sanitize_preview.py`). `OWNER_DECISION_SHEET.md` is unchanged from the working copy, and its added lines contain no local path. The remote `stage7-payments` branch already contains one of the paths (`STAGE7_DECISIONS.md` line 5 at `5c82d37`), so this patch also corrects the remote file.
- **Parent.** `5c82d37`.
- **Tests.** No test covers documents. Checks run: (a) `git apply --check` and apply on a clean export of `5c82d37`: pass; (b) P1s, then P2, P3 and P4 in order on the same export: pass; (c) the applied files equal the sanitized preview byte for byte: pass; (d) leftover scan of the added lines for local paths, scratchpad, sandbox, worktree directory names and e-mail-like strings: 0 hits. The first sanitized draft had one worktree name (`<WORKTREE_7E>`) and one branch reference; both were replaced and the patch was regenerated before this check passed. (e) The only `/home/` text is in a removed line (the old worktree path in the base file): pass. (f) The sanitized files match the preview byte for byte, alone and in combined order: pass.
- **Missing.** The owner's review of the 9 replacements. CF-5 approval to commit decision text.
- **Commit (after approval).** Index-only, so the owner's working copies are not overwritten. Parent: C2 (recommended) or `5c82d37`. Tested in a scratch repository: the index receives the sanitized files and the working copies stay at their current text.

```
cd <WORKTREE_7>
git apply --cached --check <EVIDENCE>/patches_v4_proposed_2026-11-11/P1s_governance_sanitized.patch
git apply --cached <EVIDENCE>/patches_v4_proposed_2026-11-11/P1s_governance_sanitized.patch
git diff --cached --stat        # must list exactly OWNER_DECISION_SHEET.md and STAGE7_DECISIONS.md
git commit -F <message file below>
git push origin HEAD:stage7-payments   # fast-forward only, after approval of this exact push
```

After the commit, the working copies still hold the local text, so `git status` shows them modified. Restoring them to the sanitized text is a separate owner decision.

```
Stage 7 governance: decision records, with worktree paths removed

Commits the decision records (STAGE7_DECISIONS.md, OWNER_DECISION_SHEET.md) with local worktree paths and scratchpad references replaced by neutral wording.
The committed text differs from the local working copy only in those replacements.
No decision is changed or approved by this commit.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

### 2.2 U2: 7B/7C migrations, tests and operations documentation (P2)

- **Purpose.** Licence tables and functions (0011), the admin write RPCs (0012) and the read RPCs (0013), with the local test harness and the operations document. No migration SQL was changed in this pass; only the test harness's socket paths and the operations text changed.
- **Patch.** `P2_7B_7C_database.patch` (v3), SHA-256 `8be19fa7a2e1c4c73ecab0a77a2d8fbe7b781b892fc62c6b56b05adb314a5627`, 5296 lines, 10 files. Supersedes v2 (`767ccd38…`).
- **Files (10), with working-copy hashes:**

| File | SHA-256 (working copy) |
|---|---|
| `supabase/migrations/0011_licence_foundation.sql` | `f8162e2316750cba` |
| `supabase/migrations/0012_licence_admin_rpcs.sql` | `d9618233522ca52d` |
| `supabase/migrations/0013_licence_admin_read_rpcs.sql` | `08e39d50f8e7e364` |
| `docs/STAGE7C_OPERATIONS.md` | `e29ccb65daa35f59` |
| `supabase/tests/licence_7c/00_local_shims.sql` | `a37aceef752fe2e7` |
| `supabase/tests/licence_7c/hash_vectors.json` | `256e110f81f0e52d` |
| `supabase/tests/licence_7c/hash_vectors.py` | `c07664771dd0597a` |
| `supabase/tests/licence_7c/read_api_tests.py` | `97111dece0fbafac` |
| `supabase/tests/licence_7c/reset_local.sh` | `37fb9ea0119c5a34` |
| `supabase/tests/licence_7c/rpc_tests.py` | `b254650d7b652866` |

- **Parent.** `5c82d37`. Migration numbers follow 0010 on `main`, so no renumbering is needed on this branch. The numbers 0011 to 0013 are still under D-MIG, and Chain A also uses them.
- **Tests on the exact unit.** Apply check: pass (M7). Admin 72/72 with U3 (M3). Web 212/212 with U4 (M4). **No SQL test has been run on the current 0011 to 0013 files.** The SQL logs are historical (2026-11-07 and 2026-11-08) and ran on earlier file versions. Do not cite them as current.
- **Missing.** (a) A local PostgreSQL 16 run of the current files, with fresh logs: EX-01. (b) Owner approval of the corrected header comments: 0011 still says "NOT TESTED", and 0012 says "Tested only on a throwaway local PostgreSQL 16 cluster". The proposed text is in the checklist, section 5. (c) D-MIG.
- **Commit (after approval).** Stage the ten files by name. Do not use `git add -A`, because the worktree also holds P1, admin and CLAUDE.md changes.

```
cd <WORKTREE_7>
sha256sum -- supabase/migrations/0011_licence_foundation.sql supabase/migrations/0012_licence_admin_rpcs.sql supabase/migrations/0013_licence_admin_read_rpcs.sql docs/STAGE7C_OPERATIONS.md supabase/tests/licence_7c/00_local_shims.sql supabase/tests/licence_7c/hash_vectors.json supabase/tests/licence_7c/hash_vectors.py supabase/tests/licence_7c/read_api_tests.py supabase/tests/licence_7c/reset_local.sh supabase/tests/licence_7c/rpc_tests.py   # each hash must match its row in the P2 table
git add -- <the 10 files above>
git diff --cached --stat        # must list exactly those 10 files
git commit -F <message file below>
git push origin HEAD:stage7-payments     # only after the owner approves this push (fast-forward)
```

```
Stage 7B/7C: licence foundation and admin RPCs (migrations 0011 to 0013)

Adds migrations 0011_licence_foundation, 0012_licence_admin_rpcs and 0013_licence_admin_read_rpcs,
the operations document, and the local test harness under supabase/tests/licence_7c.
Migration numbers are provisional until the owner decides D-MIG. Nothing is applied to any
database. SQL tests have not been run on these files; the harness requires a local throwaway
PostgreSQL and STAGE7C_SOCK.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

### 2.3 U3: 7D admin dashboard (P3)

- **Purpose.** The static admin panel (24 files under `admin/`), with the config guard that refuses service keys and empty configuration.
- **Patch.** `P3_7D_admin.patch` (v3, unchanged from v2), SHA-256 `cc56fd707ad09a7bbb09c44bd9bae8695b8c5ab21be74ce2ea6ee25d00942a43`, 3582 lines, 24 files.
- **Files (24), with working-copy hashes:**

| File | SHA-256 (working copy) |
|---|---|
| `admin/README.md` | `0cd2365784c9f039` |
| `admin/config.js` | `6f283bb106dbea7f` |
| `admin/index.html` | `6cf65136678302bf` |
| `admin/package.json` | `62e528360bbb85fd` |
| `admin/robots.txt` | `331ea9090db0c9f6` |
| `admin/src/app.js` | `c6e479137b3cc248` |
| `admin/src/auth.js` | `f81e279cf7f8e390` |
| `admin/src/config-guard.js` | `581cd339493f280f` |
| `admin/src/http.js` | `5ca89b2c3c58873f` |
| `admin/src/licence-api.js` | `873db56c13c4c775` |
| `admin/src/messages.js` | `7d03096c4ea7128d` |
| `admin/src/qr.js` | `4574b138e3580a41` |
| `admin/src/read-api.js` | `fd37788b3bef62c6` |
| `admin/src/read-model.js` | `20f992e2ed193430` |
| `admin/src/validate.js` | `d88c14096f164db5` |
| `admin/styles.css` | `bb1cca128b65a4e0` |
| `admin/tests/auth.test.js` | `7490538b2d65f6d4` |
| `admin/tests/browser-smoke.cjs` | `01dfe66f6f54fab0` |
| `admin/tests/guards.test.js` | `6871355c80514165` |
| `admin/tests/licence-api.test.js` | `57c4c05e508299b4` |
| `admin/tests/read-api.test.js` | `c7868c88325f8c90` |
| `admin/tests/read-model.test.js` | `e9e42ab3b6d61155` |
| `admin/tests/security.test.js` | `5291d6a31eaf6168` |
| `admin/tests/validate.test.js` | `9887f18094de2dc0` |

- **Parent.** The U2 commit (C2). The admin tests read 0011 to 0013 by path.
- **Tests on the exact unit.** Admin 72/72 with P2 (M3; M6 with P1 to P4). Without P2 the admin tests give 23 of 27, with 4 of 7 files failing on ENOENT. That is the expected dependency, not a defect. Admin `config.js` is empty, so the panel refuses to send requests (`isUsableConfig`).
- **Missing.** An admin browser smoke log (none in this set). Database-backed admin runs (EX-01).
- **Blockers.** D-MIG. RB-02 for hosting. Deployment is not part of this unit.
- **Commit (after approval).** Parent: C2. Use a new local branch and worktree, so the stage7 worktree is not switched. P3 creates only new files, so it applies to C2 without conflict.

```
git -C <WORKTREE_7> worktree add -b stage7d-admin-dashboard <WORKTREE_7D> <C2-sha>   # local branch and worktree only
cd <WORKTREE_7D>
git apply --check <EVIDENCE>/patches_v3_2026-11-11/P3_7D_admin.patch
git apply <EVIDENCE>/patches_v3_2026-11-11/P3_7D_admin.patch
git add -- admin
git diff --cached --stat        # must list exactly the 24 admin/ files
git commit -F <message file>
git push origin HEAD:stage7d-admin-dashboard   # creates the branch; only after approval
```

Then open a draft pull request into `stage7-payments` (not `main`).

```
Stage 7D: admin panel (static, fail-closed configuration)

Adds the private platform admin panel under admin/: licence actions and read views
through the RPCs of 0012 and 0013. config.js ships empty; the panel refuses to send
requests until a non-service publishable key is set. Service keys are refused in code.
Tests: npm test in admin/ (72 tests) with migrations 0011 to 0013 present.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

### 2.4 U4: 7E owner licence-status screen (P4)

- **Purpose.** The read-only licence screen in the owner web app, with the Android switch off. It calls only `shop_licence_status` (migration 0012).
- **Patch.** `P4_7E_web.patch` (v3, rev 2, after the sandbox-path fix), SHA-256 `e0762d45f011a2590be949d93474838f4a24a863816b1a323db866073e615857`, 1787 lines, 12 files. Supersedes v2 (`6ba3d0f0…`).
- **Files (12), with working-copy hashes:**

| File | SHA-256 (working copy) |
|---|---|
| `web/package.json` | `97741c0136a702af` |
| `web/src/owner-api.js` | `f776697a8e000013` |
| `web/src/owner.js` | `3c6d79ae254469a7` |
| `web/styles.css` | `61c4961fa884d14c` |
| `web/tests/browser/README.md` | `dc1b3a835456609c` |
| `web/tests/owner-api.test.js` | `5cac2327c32aa2c9` |
| `web/src/licence-status.js` | `b4078f628ba3ee53` |
| `web/src/owner-licence.js` | `11820f230c8eaf9b` |
| `web/tests/browser/licence-smoke.cjs` | `2566e8e32e04be67` |
| `web/tests/fixtures/licence-status-rpc.json` | `c6e59c7b73d91857` |
| `web/tests/licence-status.test.js` | `6a6a9b8ce89b1faa` |
| `docs/STAGE7E_LICENCE_STATUS.md` | `e03053bff7bb156f` |

- **Modified tracked files (6):** `web/package.json`, `web/src/owner-api.js`, `web/src/owner.js`, `web/styles.css`, `web/tests/browser/README.md`, `web/tests/owner-api.test.js`. **New files (6):** `web/src/licence-status.js`, `web/src/owner-licence.js`, `web/tests/browser/licence-smoke.cjs`, `web/tests/fixtures/licence-status-rpc.json`, `web/tests/licence-status.test.js`, `docs/STAGE7E_LICENCE_STATUS.md`.
- **Parent.** The U2 commit (C2). EX-15 recommends publishing P2 first. Do not publish P4 ahead of the RPC it calls.
- **Tests on the exact unit.** Web 212/212 with P4 alone (M2; the M2 web tree is identical to the M6 web tree). Licence browser smoke 33/33 on the M6 tree (web identical). Targeted licence and owner-API tests 60/60 on 2026-11-10; the test sources were last modified on 2026-11-09, before that run. The browser run uses fake backend replies (mocked).
- **Missing.** A real Supabase integration run (staging, EX-02). The saved log for the 7E fixture capture (none; the doc marks this). Features, stats, QR and owner smokes were not run for this set; their earlier counts have no logs and are marked unverified in the doc.
- **Blockers.** EX-15. EX-02 for any integration evidence. The screen returns "Status unavailable" until 0012 is applied, which is the expected behaviour before publication.
- **Commit (after approval).** Create the parent first, then commit by name on the 7E branch.

```
cd <WORKTREE_7E>
git merge --ff-only stage7-payments        # 7E has no commits of its own, so this equals rebasing it onto C2. Git stops if it would overwrite a local change; P2 and P4 share no file.
git add -- <the 12 files above>
git diff --cached --stat                   # must list exactly those 12 files
git commit -F <message file below>
git push origin HEAD:stage7e-owner-licence-status      # only after the owner approves; creates the branch
```

```
Stage 7E: owner licence-status screen (read only, Android view off)

Adds the owner web screen that shows the licence status returned by shop_licence_status.
Read only: there are no grant, extend, revoke or replace controls. Stale and malformed
replies are dropped and shown as "Status unavailable". The Android bundle switches the
screen off (ownerApp). Browser checks use mocked replies; no hosted or staging database
was used.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

### 2.5 U5: Reconciliation evidence and documentation

- **Purpose.** The reports, the manifests and checksums, and the sanitized logs and scripts, so a reviewer can trace each claim to its evidence. No code.
- **Location.** `publication_docs_2026-11-11/` in the evidence folder (the file count is in `UNIT_FILES.sha256`, regenerated after the last edit). It excludes all patches, extracted trees, the owner's decision files and the P1 preview. The P1s patch is excluded because it carries the owner's governance text, whose publication is blocked by CF-5.
- **Base and branch.** `717717b`, branch `stage7-reconciliation-2026-11-10`, no pull request. Nothing on `main`, `stage7-payments` or the protected checkout changes.
- **Checks run.** Leftover scan for local, sandbox, scratchpad and personal strings: none. The only email-shaped string is `noreply@anthropic.com`, which is the commit attribution. Checksums regenerated. References checked on 2026-11-11: see section 5.
- **Commit (after approval).** The `publication_docs_2026-11-11/` folder only, one commit, with the session trailers, under `docs/reconciliation-2026-11-10/` (the Pages workflow publishes only `web/` from `main`, so `docs/` is not published). Commands:

```
git -C <WORKTREE_7> worktree add -b stage7-reconciliation-2026-11-10 <WORKTREE_DOCS> 717717be923589665f733c28d3a77a538f02b4ae   # local branch and worktree only
mkdir -p <WORKTREE_DOCS>/docs/reconciliation-2026-11-10
cp -r <UNIT>/. <WORKTREE_DOCS>/docs/reconciliation-2026-11-10/
cd <WORKTREE_DOCS> && git add -- docs/reconciliation-2026-11-10 && git diff --cached --stat   # must list only the unit's files
git commit -F <message file below>
git push origin HEAD:stage7-reconciliation-2026-11-10   # creates the branch; only after approval of this exact push
```

The push creates a branch on GitHub and needs explicit approval of the branch name and the commit. No pull request is opened by these steps.

```
Stage 7 reconciliation evidence and documentation (2026-11-10 and 2026-11-11)

Reports 01 to 13, patch manifests and source hashes, saved test and browser logs,
and the sanitized scripts. Documentation only. Labels in each report separate local,
remote, historical SQL, mocked and untested evidence. No code change.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
```

## 3. Proposals outside the publication set

### 3.1 CI test workflow

- **File.** `proposals/ci_tests_workflow_proposed.yml`. Target: `.github/workflows/tests.yml`. Three jobs: `web`, `agent` and `admin`. Triggers: pull requests, pushes to `main` and `stage7-payments`, and manual dispatch.
- **Verified.** YAML parses. No secrets are referenced. On a clean export of `717717b`: web 163/163 and agent 61/61 pass. The admin job runs 72/72 on the M6 tree (P1 to P4), and skips its steps on trees without `admin/`.
- **Does not touch** `pages.yml`, `android-apk.yml` or `cleanup-files.yml`.
- **Before enabling:** pin `actions/checkout` and `actions/setup-node` to commit SHAs. The file uses version tags (not done here).
- **Approval needed:** adding the workflow file to the repository.

### 3.2 README correction

- **Files.** `proposals/README_proposal_717717b.patch` and `proposals/README_proposed_717717b.md`. The patch applies cleanly to `717717b` (checked on a clean export), and adds 26 lines and removes 16. The wording was also changed so that the proposal does not describe the agent's environment ("check environment" replaces "sandbox"), and the unlogged counts for the customer-upload and owner-download checks (17 and 8) are marked as having no log.
- **What changes, and why:** stage table rows 6 to 8 (print agent built but untested on a real printer; licences not on `main`; partial retention and rate limits); the Stripe line (no Stripe package, code or setting exists in the repository; the earlier note could not be confirmed); layout entries for migrations 0007 to 0010, the `agent/` folder, the `print-agent` and `cleanup-files` functions, and the stage 8 test file; the web test count (109 became 163, checked on `main`); next steps 8 to 10, and removal of "move the browser scripts into the repo", since they are already in `web/tests/browser/`.
- **Not changed:** the README's claims that migration 0003 is applied to the live project and the Stage 3 and Stage 5b check counts. The patch does not change those lines, and they were not re-checked in this pass.
- **Approval needed:** publishing the README.

### 3.3 Cleanup workflow configuration

See `13_cleanup_workflow_diagnosis.md`. The fix is an owner decision (RB-05): set the two secrets and confirm the hosted items, or remove the schedule. Nothing has been changed.

## 4. Order of work after approval

1. **U1 (P1s)**, when CF-5 is approved. It is independent of the others.
2. **U2 (P2)**, when D-MIG and the header-comment text are approved. Run EX-01 first if the owner approves it, so the branch has current SQL evidence.
3. **U3 (P3)**, after U2 is on the branch and RB-02 is answered.
4. **U4 (P4)**, after U2 is on the branch and EX-15 is approved. It can run in parallel with U3.
5. **U5 (documentation)**, when its branch and push are approved. It can go at any time, because it cites the units by name only.
6. **Proposals (§3)**, each on its own approval.

Stage 7 closure needs 7F as well. 7F is held back (C-1, C-3, D-I32, D-Q4, D-Q5 and the enforcement gates), so these units do not close Stage 7.

## 5. Audit results (2026-11-11, local and remote, read only)

- **Hashes.** Every 64-character hash cited in the unit appears in a manifest (58 authoritative values). Every 16-character prefix matches one of them. Patch files match their manifests: P2 `8be19fa7…`, P3 `cc56fd70…`, P4 `e0762d45…`, P1s `1601d85e…`.
- **Source hashes.** 48 of 48 match their working copies: 36 for P1 to P3 (worktree `stage7-payments`) and 12 for P4 (the 7E worktree). Checked with `sha256sum -c`; nothing was changed.
- **References.** Every unit file cited resolves inside the unit. The other names cited are repository files (for example `STAGE7_DECISIONS.md`, `admin/README.md`, `.github/workflows/cleanup-files.yml`), or files held locally on purpose: the P1s patch, the sanitizer script and the preview files (they carry the owner's governance text), and the v2 and v3 patch files.
- **Historical logs.** The SQL and test logs cited by reports 04, 05, 07, 10 and 11 (2026-11-07 and 2026-11-08) are in `logs_historical_2026-11-07_08/`, sanitized. They are historical evidence, not current results.
- **Wording.** "Current" and "fresh" refer to the current migration files and to the run still pending (EX-01). "Passed" is always stated with its scope. One claim was wrong and is corrected: report 10 said a hosted AAL2 check passed; no hosted result is in this set.
- **Environment wording.** The README proposal described the agent's sandbox. It now says "check environment". The unlogged browser counts are marked as having no log.
- **Still open.** The README proposal keeps older historical statements from the owner's README that were not re-run in this pass (for example the Stage 3 and 5b check counts). They are labelled as unverified in section 3.2.
