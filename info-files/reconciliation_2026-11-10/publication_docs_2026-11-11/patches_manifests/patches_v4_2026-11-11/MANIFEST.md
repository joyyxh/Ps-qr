# Patch set v4 (2026-11-11): corrected governance patch. Local only. Nothing is published.

**Status.** P1s replaces the first sanitized draft `5abc5130…` (never published). P2, P3 and P4 are unchanged from v3; see `../patches_v3_2026-11-11/MANIFEST.md`. Not committed, not pushed. Blocked by CF-5 (owner approval to commit the decision text).

**Base.** `5c82d37` on `stage7-payments`. Base export `base_5c82d37.tar`, sha256 `0e79bc8f6d23e1b668aef5becf01d40a9b2a4b1c9334ab6c899ecbeb0035f6f9` (the same export as v3).

## 1. Patch

| Unit | Patch file | Files | Lines | SHA-256 | Change |
|---|---|---|---|---|---|
| U1 governance (P1s) | `P1s_governance_sanitized.patch` | 2: `OWNER_DECISION_SHEET.md`, `STAGE7_DECISIONS.md` | 1198 | `1601d85e8fbdf336f2efb452c62ffbf74cf3639cc7c9e7a8df850f238d9f64d8` | 11 text replacements in `STAGE7_DECISIONS.md`; `OWNER_DECISION_SHEET.md` unchanged from the working copy |

Generated with `git diff` in a scratch git repository whose base commit holds the 5c82d37 files, so index lines are present, as in v3 P1.

**Superseded (not for publication).** `5abc5130126045322cec113d015a3a77481af8d539a3833982b736e6d2b5d14e` (first sanitized P1, 1196 lines): its added lines still held one worktree directory name (`<WORKTREE_7E>`) and one branch reference; both are replaced in v4. v3 P1 `4cbe5136…` is unsanitized (8 added lines with local paths).

## 2. Sanitizer and outputs

- `p1_sanitize_preview.py` reads the stage7 worktree files (read only), applies 11 replacements, each asserted to match exactly once, and writes `p1_sanitized_preview/`.
- `p1_sanitized_preview/STAGE7_DECISIONS.md`: sha256 `5283071f511e222598d9f45e3a83551214c3c00d945d46dc2bc491628b9574ca`
- `p1_sanitized_preview/OWNER_DECISION_SHEET.md`: sha256 `1f16a25a400303b7f9a9f36950a91ff9038fc4a7ceaeb32bdf5dc6fea63da49c` (same as the working copy)

## 3. Verification (2026-11-11, local)

- `git apply --check` and apply on a clean export of 5c82d37: pass. Result byte-equal to the preview.
- Combined order P1s, P2 (v3), P3 (v3), P4 (v3) on the same export: each check and apply passes. `STAGE7_DECISIONS.md` byte-equal to the preview.
- Index-only apply (`git apply --cached`) in a scratch repository: pass. The index receives the sanitized files; the working copies are left as they were.
- Leftover scan of added lines: no local path, scratchpad, sandbox, worktree directory name or e-mail-like string. The only `/home/` text is in a removed line (the old worktree path in the base file).
- No test covers these documents. No test was run on the project repository for this unit.

## 4. Commit (after CF-5 approval)

Parent: C2 (recommended) or `5c82d37`. Commands are in `12_publication_units.md`, section 2.1. The patch is not part of the documentation unit (it carries the owner's governance text). Held locally, not in the documentation unit: the sanitizer script, the preview files and the patch.
