# P4 v5: 7E web (README synced with the corrected browser scripts)

**Status.** LOCAL ONLY. Not committed, not pushed, no branch, no PR. Not to be published before EX-15 (publication order) is approved.

**Base.** `5c82d37` (`stage7-payments`). Generated from the 7E worktree (`/home/claude/joyyxh/ps-qr-stage7e`) with the same method as `make_patches.sh` (tracked files via `git diff`, new files via `git diff --no-index`).

**Replaces** P4 v3 (`patches_v3_2026-11-11/P4_7E_web.patch`, sha256 `e0762d45f011a2590be949d93474838f4a24a863816b1a323db866073e615857`) for publication. The only difference between v3 and v5 is `web/tests/browser/README.md`. The 11 other sections are byte-identical.

**Dependency.** The new README describes the corrected owner, QR, features and statistics scripts from U6 (`U6_browser_smoke_and_layout.patch`). Apply U6 before or with P4 v5.

| Unit file | Lines | sha256 |
|---|---|---|
| `P4_7E_web_v5.patch` | 1850 | `7119a05ca701d536cf073324cd4c13aa87ac375104430a10e0071d4298ab5c10` |

## 1. What changed in the README

- Current results per script (2026-11-12, combined tree; see section 3).
- The corrected scripts need U6. The stale "31 of 34", "No saved log" and "run qr-smoke first" statements are removed.
- The `features-smoke` check "the greyed-out boxes say why" is stated as open, with the wording as an owner decision.
- The sandbox paths in "Before running" are removed: the Playwright module, Chromium, output folder and web folder are now environment variables (`PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `QRQUICK_SMOKE_OUT`, `QRQUICK_WEB_DIR`, `QR_SCREEN_DPR`).
- The port split is stated: 5173 for `npm start` (four scripts) and 5174 for `licence-smoke.cjs`. The admin panel's `start` also uses 5174, so it must be stopped first.

## 2. Source file hashes (after this change, 7E worktree)

| `web/package.json` | `97741c0136a702affdeb09cdfe00b558bb86412df666fcc8b1de1c796dec4033` |
| `web/src/owner-api.js` | `f776697a8e00001342c77fad062fc2f034f9233da3c8f17fc2f231ca5de721e5` |
| `web/src/owner.js` | `3c6d79ae254469a7e0558aa912cf154644732dd2ca00bdd5c9bbd7fdc02ebaff` |
| `web/styles.css` | `61c4961fa884d14c4abbfccc8068c9fa0e2041203b93af832da8aefa13e07a4d` |
| `web/tests/browser/README.md` | `83a5a6fac7f1fba0af60b7bcdf911fef645bc75a61feab59c00c6bbe8f6c03a1` |
| `web/tests/owner-api.test.js` | `5cac2327c32aa2c95c2fb084757397f37c7bb405f0825d010d1bdc42687e1ee2` |
| `web/src/licence-status.js` | `b4078f628ba3ee5327fd1dd6cd830c0c95314c03bb3b07fa2940460131b3f8e2` |
| `web/src/owner-licence.js` | `11820f230c8eaf9b7948a0fdfef71383b1b0373621692079bf079a9825e56244` |
| `web/tests/browser/licence-smoke.cjs` | `2566e8e32e04be67d7181232580f5c5e201e073e2700c487abfd5bd463f2a649` |
| `web/tests/fixtures/licence-status-rpc.json` | `c6e59c7b73d918575e885ba35c794e8bf94af17409fbda5e62615141e223753a` |
| `web/tests/licence-status.test.js` | `6a6a9b8ce89b1faa8c73f924aa8a1e54e65d31d76a99d4bb65bb2987ef0e20af` |
| `docs/STAGE7E_LICENCE_STATUS.md` | `e03053bff7bb156fc984e69355fd5581c5204375bd46472d02992a06d3065ae4` |

## 3. Validation (local only)

Order check on a fresh extraction of `patch_check/matrix/base_5c82d37.tar`:

- P2, P3, U6, P4 v5 in this order: `git apply --check` and `git apply` pass for each.
- P2, P3, P4 (v3 code, same code files), U6 in the other order: pass. The two resulting trees are identical (`diff -r`), so the order does not matter.
- `styles.css` after the combined apply differs from the 7E worktree only by the U6 hunks, and from the stage7 worktree only by the four P4 appended rules.
- The P4 v5 file hashes after apply match the 7E worktree for all 11 files other than `styles.css`.

Tests on the combined tree (`logs_2026-11-12/combined_v5/`):

| Check | Result |
|---|---|
| `web` `npm test` | 212 pass, 0 fail (v5 final order: 212 pass, 0 fail) |
| `admin` `npm test` | 72 pass, 0 fail |

Browser checks on the combined tree (Chromium through Playwright, mocked backend, `web/` served on 5173 and 5174):

| Script | Result |
|---|---|
| `licence-smoke.cjs` | 33 of 33, exit 0 (first run with U6 applied; 2026-11-10 run was without U6) |
| `owner-smoke.cjs` | 39 of 39, exit 0 |
| `qr-smoke.cjs` | 12 of 12, exit 0 |
| `features-smoke.cjs` | 23 of 24, exit 1. The one failing check is the open greyed-out wording check |
| `stats-smoke.cjs` | All checks passed, exit 0 |

The browser runs used the v3 P4 code, which is identical to v5 apart from the README. The README is not executed by any script.

Added-line scan: no line in the patch contains `/home/claude`, `/tmp/claude`, `printnest/web`, `npm-global` or the session id.

## 4. Not validated

- A real phone or tablet. Mocked Supabase only.
- The hosted or staging site, and any Supabase project.
- A physical printer (not part of this unit).
- Publication order (EX-15).

## 5. Open items

1. `features-smoke` check "the greyed-out boxes say why": owner decision on the reason text. The check is kept, not weakened.
2. P4 v5 requires U6. Publish them together or U6 first.
3. Admin panel and `licence-smoke.cjs` both use port 5174. Stop one before running the other.
