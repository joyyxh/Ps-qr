# Stage 7 migration numbering (D-MIG Option B)

Status: approved by the owner on 2026-11-14 (D-MIG Option B). This file is the mapping that the decision records refer to. The decision record is `STAGE7_DECISIONS.md` section 13G. Earlier D-MIG statements in the records are marked SUPERSEDED.

## Mapping

| Migration | Name | Source | Status on this branch |
|---|---|---|---|
| 0001 to 0010 | origin/main migrations | origin/main | Unchanged |
| 0011 | `0011_service_options.sql` (Chain A) | local `main` commit `37e4623` (unpushed) | **Not on this branch.** Integration is open |
| 0012 | `0012_print_eligibility.sql` (Chain A) | `37e4623` | Not on this branch |
| 0013 | `0013_order_workflow.sql` (Chain A) | `37e4623` | Not on this branch |
| 0014 | `0014_create_shop_confirmed_email.sql` (Chain A) | `37e4623` | Not on this branch |
| 0015 | `0015_licence_foundation.sql` | Written as `0011_licence_foundation.sql` in the decision records to 2026-11-10 | Committed on this branch (`c5e573b`) |
| 0016 | `0016_licence_admin_rpcs.sql` | Written as `0012_licence_admin_rpcs.sql` in the decision records to 2026-11-10 | Committed on this branch (`c5e573b`) |
| 0017 | `0017_licence_admin_read_rpcs.sql` | Written as `0013_licence_admin_read_rpcs.sql` in the decision records to 2026-11-10 | Committed on this branch (`c5e573b`) |
| 0018 | reserved for Stage 7F | none | Reserved. Not created. Stage 7F is not built |

## Rules

- Chain A keeps 0011 to 0014. Chain A is not renumbered.
- The licence files have no SQL dependency on Chain A. A name-clash check on 2026-11-10 found none (`STAGE7_DECISIONS.md` section 13F). Their header comments mention Chain A's `0011_service_options.sql` only to say the two files are separate. The licence files depend on 0001 (`shops`, `is_shop_owner`, `is_shop_member`); 0016 depends on 0015; 0017 depends on 0015 and 0016.
- Expected order once Chain A is integrated: 0001 to 0010, then 0011 to 0014 (Chain A), then 0015 to 0017, then 0018 (7F).
- Historical text in `OWNER_DECISION_SHEET.md` and `STAGE7_DECISIONS.md` is kept. Each record has a dated renumbering note at the top. Superseded statements carry a SUPERSEDED mark in place.
- Applying any of these files to a hosted database is a separate gated action. It has not been done.

## What was changed by the renumbering

- File names: the three licence migrations, `supabase/tests/licence_7c/reset_local.sh`, the Python and SQL test files, the admin test and source paths that read the migration files, and `docs/STAGE7C_OPERATIONS.md`.
- Only file names and comments were rewritten. No SQL statement was changed in the renumbering commit.
- On 2026-11-14 (documentation correction, `STAGE7_DECISIONS.md` section 13G): header and comment lines in 0015 to 0017 were corrected, two test identifiers in `admin/tests` were renamed, and the status documents were updated. No SQL statement changed.
