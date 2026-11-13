# D-MIG Option B: renumbering map (proposal, NOT APPLIED)

## Why

- origin/main ends at `0010_print_agents.sql`.
- Local `main` (commit `37e4623`, unpushed) adds `0011_service_options.sql`, `0012_print_eligibility.sql`, `0013_order_workflow.sql` and `0014_create_shop_confirmed_email.sql`.
- The stage7 licence files are also numbered 0011 to 0013 (provisional). The two lines cannot be combined under the same numbers.
- Owner decision 2 requires owner-approved renumbering before the two lines are combined.

## Map

| Current name (stage7 worktree, untracked) | Option B name | Content hash, current | Content hash, after rename |
|---|---|---|---|
| `supabase/migrations/0011_licence_foundation.sql` | `0015_licence_foundation.sql` | `f8162e2316750cba0b820f95c942ef726680c887a02e32eabd6e66355920055f` | same bytes (name only) before header edits |
| `supabase/migrations/0012_licence_admin_rpcs.sql` | `0016_licence_admin_rpcs.sql` | `d9618233522ca52dbd3d25fd3bb9c577f17675d395e27d89643ed0f48862027a` | changes: header names 0011 file (dry run `c0fc38e9...`) |
| `supabase/migrations/0013_licence_admin_read_rpcs.sql` | `0017_licence_admin_read_rpcs.sql` | `08e39d50f8e7e3649bc6641c7c0d4268c815211abfb97d72e88bf6800272bc10` | same bytes in the dry run (no file name inside) |
| (7F, not written) | `0018_*` reserved | none | none |

Hash values after the header edits (section 4 of the change set) will differ from the dry-run values, because the dry run only rewrites exact file names. Bare number labels in comments are a separate manual step.

## Resulting order (after approval)

`0001` to `0010` (origin/main), `0011` to `0014` (Chain A on local main), `0015` to `0017` (licence), `0018` reserved (7F).

## Not changed by this map

- Chain A files keep their names and bytes.
- No migration SQL is executed by this package.
- Nothing is applied to any Supabase project.
