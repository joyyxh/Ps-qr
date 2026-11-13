# D-MIG Option B: impact analysis

Counts are from `grep` over the stage7 worktree (excluding `.git` and `node_modules`), on 2026-11-12. "Exact" means the full file name (`0011_licence_foundation.sql` and similar). "Bare" means the number on its own (`0011`), with hex digests excluded. The 16 `hash_vectors.json` hits were hex digests and are not migration references. `hash_vectors.json` and `hash_vectors.py` contain no migration file name, so they need no change.

## 1. Mechanical: exact file names (rewritten in the dry run)

| File | Exact hits | Kind | Breaks if not changed |
|---|---|---|---|
| `admin/tests/guards.test.js` | 3 | `readFileSync` path to a migration | yes, ENOENT |
| `admin/tests/licence-api.test.js` | 1 | `readFileSync` path | yes |
| `admin/tests/read-api.test.js` | 1 | `readFileSync` path | yes |
| `admin/tests/read-model.test.js` | 1 | `readFileSync` path | yes |
| `supabase/tests/licence_7c/reset_local.sh` | 3 | load-order paths for `psql -f` | yes, reset fails |
| `supabase/migrations/0012_licence_admin_rpcs.sql` | 1 | header comment, "depends on" | no |
| `admin/src/licence-api.js` | 1 | comment | no |
| `admin/src/read-api.js` | 1 | comment | no |
| `admin/README.md` | 2 | documentation | no |
| `docs/STAGE7C_OPERATIONS.md` | 1 | documentation | no |
| `CLAUDE.md` (untracked draft) | 1 | working rule | no; owner approval needed for the memory file |

Dry run result: the patch lists 15 paths, made of 3 renamed pairs (0011 to 0015, 0012 to 0016, 0013 to 0017) and 9 text files rewritten (admin README, two admin source comment files, four admin test files, `STAGE7C_OPERATIONS.md`, `reset_local.sh`). 0 old names remain, and the admin suite gives 72 of 72 on both trees.

## 2. Not mechanical: bare numbers inside the migrations (manual, per line)

- `0011_licence_foundation.sql` (becomes `0015`): line 1 (`-- 0011:`), line 625 (`End of 0011`). Line 5 ("Number 0011 confirmed free") and line 7 (`0011_service_options.sql`) describe Chain A and must be rewritten to explain the rename. They must not be changed to point at the licence file.
- `0012_licence_admin_rpcs.sql` (becomes `0016`): lines 1, 10, 766 ("The 0011 guard"), 1084. Line 13 is covered by the mechanical rewrite.
- `0013_licence_admin_read_rpcs.sql` (becomes `0017`): lines 1, 4, 5 ("0011", "0012" dependencies), 30, 286 ("The 0011 index"), 307.

## 3. Decision records (owner decision, not in the mechanical change set)

| File | Exact | Bare | Note |
|---|---|---|---|
| `STAGE7_DECISIONS.md` | 18 | 155 | Historical record. Recommendation: keep the text and add a mapping table. |
| `OWNER_DECISION_SHEET.md` | 4 | 48 | Same recommendation. |

Rewriting these would change what past decisions said. The owner should choose between a mapping note (recommended) and a rewrite.

## 4. Other bare-number references (manual)

| File | Bare hits | Notes |
|---|---|---|
| `docs/STAGE7C_OPERATIONS.md` | 26 | Mostly labels and the file list. |
| `CLAUDE.md` | 11 | Draft under review. Its working rules name 0011 to 0013 and must be updated only after approval. |
| `supabase/tests/licence_7c/reset_local.sh` | 9 | Echo text and comments, beside the exact-name lines. |
| `supabase/tests/licence_7c/rpc_tests.py` | 2 | Comments. |
| `supabase/tests/licence_7c/read_api_tests.py` | 1 | Comment. |
| `supabase/tests/licence_7c/00_local_shims.sql` | 2 | Comments. |
| `admin/README.md` | 8 | Labels. |
| `admin/tests/*.js`, `admin/src/*.js` | 8, 4, 3, 2, 1, 1, 1 | Test titles and comments. `admin/src/messages.js` line 1 is a comment, not user-facing text. |

No user-facing product text was found that contains a migration number. The admin source is code comments only.

## 5. Patch units and evidence affected

| Unit | Finding | Action after approval |
|---|---|---|
| P2 v5 (`P2_7B_7C_database_v5.patch`, sha `0b51ad5e...`) | Contains the three migration files, `docs/STAGE7C_OPERATIONS.md` and the licence test files. | Regenerate as P2 v6 with new names and hashes. P2 v5 is superseded. |
| P3 v3 (`P3_7D_admin.patch`) | 24 files, 10 migration path hits. | Regenerate as P3 v4. |
| P4 v5 (`P4_7E_web_v5.patch`, sha `7119a05c...`) | 8 hits: prose labels ("migration 0012"), one path in the README, and the `_source` label in the fixture. No migration path in code. | Regenerate if the README path changes. Fixture `_source` text is an owner or documentation call. |
| U6 (`U6_browser_smoke_and_layout.patch`) | 0 hits. | Unaffected. |
| P1 governance | Not checked in this pass. Blocked by CF-5. | Check before any publication. |
| EX-01 runbook | Step 1 file list, step 5 log names, the hashes and the EX-01 run 2 evidence all use the old names. | Keep run 2 as historical evidence. A new run on renamed files needs the approval in `README.md`, item 3. |
| Checklist (`10_remaining_work_checklist.md`) | Rows and section 12 mention the old names. | Update after approval. |

## 6. Limits of this analysis

- Searched text files only. The migrations' SQL objects were not renamed. Object names do not include the file number, so they are unaffected.
- The hosted Supabase migration history is not checked. Only the local scratch apply was run.
