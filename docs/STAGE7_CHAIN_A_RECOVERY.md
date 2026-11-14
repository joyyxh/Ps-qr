# Chain A recovery record (2026-11-14)

Status: **PARTIAL RECOVERY. Commit `37e4623` is NOT recovered, and Chain A is NOT integrated.**

Chain A is the local `main` commit `37e4623` ("Add owner email-code registration and password setup", 2026-10-25, on top of `4d97e40`). It was never pushed. The complete commit object is absent from every source searched.

This branch does not contain any Chain A file. Nothing here was reconstructed from assumptions.

## Sources searched, and the result

| Source | Searched how | Result |
|---|---|---|
| `/home/claude/ps-qr` (main checkout, HEAD `717717b`) | `git cat-file -t 37e4623`; full reflog; `fsck --lost-found` | Not present. Reflog has no `37e4623`. Dangling commits are only this branch's earlier pushes. |
| `/home/claude/ps-qr-integration` (this worktree) | same | Not present. |
| Every `.git` found by a depth-6 search of `/` | path search | Only the two `ps-qr` repositories have a ps-qr history. The others (`/opt/rbenv`, `/opt/nvm`, `/root/.cache/uv`) are unrelated. No `.bundle` file. |
| GitHub `origin` refs | `git ls-remote` | `37e4623` is not on any branch. `main` is `717717b`; `auth-owner-otp` is `8e29762`. |
| Full history, all refs | pickaxe (`-S`) for Chain A RPC names | No commit except the audit-package commits (`5b8be1d`, `81ca6a2`), which hold copies. |
| Audit branch `origin/audit-package-2026-11-13` (`91092c6`) | tree listing and content search | Contains Chain A migration copies, one owner file and the commit message (below). No other Chain A web, CSS, package or browser-test file. |
| Audit tarball `e36edcb7-audit_submission_2026-11-13.tar.gz` | listing and extraction | 111 entries. Reflog line for `37e4623` only. No patch or bundle of it. |
| Attachments and reports | search for `37e4623` | Records mention the commit and its subject. None contains a diff, a stat or a blob ID for its app files. |
| Filesystem | search for Chain A RPC names | Only the recovered copies, reports and the analysis document. |

## What was recovered

Hashes are SHA-256. Provenance is the audit branch file that holds the copy.

| File | SHA-256 | Notes |
|---|---|---|
| `0011_service_options.sql` (774 lines) | `d5f6754465382272af7bafcb12ccd5d819b7d1c9a7226b229a360da8b242f74e` | Same bytes as `round3_2026-11-12/dmig_option_b/scratch_order_check/chainA_0011_service_options.sql` and as `info-files/0011_before_capability.sql` (a pre-change backup). |
| `0012_print_eligibility.sql` (191 lines) | `c1a9b96ad40da8f9e7468d6f1f8043cfa39344fd92b4119a87f29f087eb12e66` | Same bytes as the read-only copy. |
| `0013_order_workflow.sql` | `caacc2a0b3b8dcec4801233059a469864f7b0baf761b300c218fd24e6acd2384` | Same bytes as the read-only copy. |
| `0014_create_shop_confirmed_email.sql` | `ca6808385215533016e08f649718bc37bb71308145a5252c0d72aa1a1bf6bda0` | Same bytes as the read-only copy. |
| `chainA-owner.js.txt` (`web/src/owner.js` version, 1826 lines) | `9d7ad49f7dbda113850c4f22399de12d259db614000d5193e1a6147444693131` | Filed with the commit message in audit commit `81ca6a2`. The hash matches `info-files/MANIFEST.sha256`. It is **not** verified against blob `37e4623:web/src/owner.js`, because that object is missing. |
| `commit-message.txt` | `206d9c932ed6185bf8e08e55c23dee39c5d8344576288faad78298e245eebba4` | The message of `37e4623`. Its subject matches the reflog. |

The migration copies match the four `0011`–`0014` entries in `MANIFEST.sha256`.

The recovered `owner.js` differs from both candidate bases. Against `4d97e40` (1121 lines) it has about 1980 changed lines. Against `8e29762` on `main` (1362 lines) it has about 1680. So `8e29762` is **not** a substitute for Chain A. It covers overlapping work, as the integration analysis says.

## Found and rejected

- `info-files/mut-claim/supabase/migrations/0011_service_options.sql` and `0012_print_eligibility.sql` are **mutants**. They are part of a mutation-testing run. `shop_paper_capability` is removed, and `order_is_printable` is changed. Do not use them as Chain A. The `mut-claim/` and `mut-*` directories on the audit branch are test workspaces.
- `mut-claim/supabase/rollbacks/0011_*.down.sql`, `0012_*.down.sql` and the tests `paper_sizes_tests.sql`, `print_eligibility_tests.sql` and `service_pricing_tests.sql` sit in that same workspace. Their provenance is not verified, so they are not used.

## Not recovered

- `web/src/owner-api.js`, `web/styles.css`, `web/package.json` (the Chain A version), `web/src/logic.js`, `web/src/auth.js`, and the Chain A web tests.
- The owner and customer screens and their browser tests. The commit message says the commit includes them.
- Rollbacks for `0013` and `0014`. The commit message says `0014` has one.
- The scratch database runner.
- The commit object itself, which holds the exact content of the files above.

## Why Chain A is not integrated

Integration is not possible without the missing application files, and the migrations are not safe to apply alone.

- `0013_order_workflow.sql` line 304 runs `revoke update (cash_payment_timing) on public.shops from authenticated`.
- The current web code on this branch still writes that column. `web/src/owner-api.js` line 10 lists `cash_payment_timing` in `SHOP_FIELDS`, and `web/src/owner.js` line 840 reads it for the owner's shop settings.
- Chain A's own `owner-api.js` and `owner.js` are the missing files. The commit message says cash timing was removed. Applying `0013` without them would break the owner's shop-settings save.
- Chain A also redefines `place_order`, `set_order_payment`, `approve_order_for_print`, `agent_claim_next_job`, `agent_mark_printing` and `create_shop`. Those are the functions that the 7F refusal must sit on.

So 7F's refusal, its `0018` migration and the combined migration tests cannot be built on a correct base.

## What is needed to continue

1. **The commit object `37e4623`**, or its bundle, or a patch of `4d97e40..37e4623`. Any one of these is enough. It needs to be pushed to a branch or sent as a file. This is the only source that unblocks integration.
2. Confirmation from the owner of which `chainA-owner.js.txt` content is the post-commit version, if the object cannot be found.
3. Nothing from a legal, staging or printer gate is needed to recover the commit. Those gates remain separate.

No recovery branch was created. The recovered files are already on GitHub in `origin/audit-package-2026-11-13`, so a second copy adds no safety. The partial state is recorded here instead.
