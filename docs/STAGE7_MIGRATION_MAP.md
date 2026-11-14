# Stage 7 migration numbering (D-MIG Option B)

Status: approved by the owner on 2026-11-14 (D-MIG Option B). This file is the mapping that the decision records refer to.

## Mapping

| Migration | Name | Source | Status on this branch |
|---|---|---|---|
| 0001 to 0010 | origin/main migrations | origin/main | Unchanged |
| 0011 | `0011_service_options.sql` (Chain A) | local `main` commit `37e4623` (unpushed) | **Not on this branch.** Integration is open |
| 0012 | `0012_print_eligibility.sql` (Chain A) | `37e4623` | Not on this branch |
| 0013 | `0013_order_workflow.sql` (Chain A) | `37e4623` | Not on this branch |
| 0014 | `0014_create_shop_confirmed_email.sql` (Chain A) | `37e4623` | Not on this branch |
| 0015 | `0015_licence_foundation.sql` | was `0015_licence_foundation.sql` | Added |
| 0016 | `0016_licence_admin_rpcs.sql` | was `0016_licence_admin_rpcs.sql` | Added |
| 0017 | `0017_licence_admin_read_rpcs.sql` | was `0017_licence_admin_read_rpcs.sql` | Added |
| 0018 | reserved for Stage 7F | none | Reserved. Added by this branch only if the 7F migration is included (see `docs/STAGE7F_IMPLEMENTATION.md`) |

## Rules

- Chain A keeps 0011 to 0014. Chain A is not renumbered.
- The licence files do not reference any Chain A name, and Chain A does not reference them. The licence files depend only on 0001 (`shops`, `is_shop_owner`, `is_shop_member`).
- Expected order once Chain A is integrated: 0001 to 0010, then 0011 to 0014 (Chain A), then 0015 to 0017, then 0018 (7F).
- Historical text in `OWNER_DECISION_SHEET.md` and `STAGE7_DECISIONS.md` is kept. Each record has a dated renumbering note at the top.
- Applying any of these files to a hosted database is a separate gated action. It has not been done.

## What was changed by the renumbering

- File names: the three licence migrations, `supabase/tests/licence_7c/reset_local.sh`, the Python and SQL test files, the admin test and source paths that read the migration files, and `docs/STAGE7C_OPERATIONS.md`.
- Only file names and comments were rewritten. No SQL statement was changed in the renumbering commit.
