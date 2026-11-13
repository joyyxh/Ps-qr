# Migration conflict report (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Status.** Analysis only. No migration was renumbered, created, applied or run. D-MIG is NOT approved. The local licence files are at 0011–0013 (reverted today from the working default in register §13E).

## 1. Migration map

| Number | Local `main` (Chain A; committed locally, unpushed) | Stage 7 licence line (untracked, `<WORKTREE_7>`) | Collision |
|---|---|---|---|
| 0001–0010 | Committed. 0010 is on `origin/main` | Same base | None |
| 0011 | `0011_service_options`: tables `order_charges`, `shop_extra_charges`, `shop_paper_sizes`; functions incl. `place_order`, `quote_order`, `approve_order_for_print`, `shop_paper_capability` | `0011_licence_foundation`: tables `platform_admins`, `shop_licence_meta`, `licence_config`, `licence_coverages`, `licence_audit_log`, `licence_requests`, `licence_denials`, `licence_denial_windows`; functions `shop_licence_state`, `licence_lock_shop`, `is_platform_admin` and guards | **Yes** |
| 0012 | `0012_print_eligibility`: redefines `agent_claim_next_job`, `agent_mark_printing`; adds `cancel_unprintable_jobs`, `order_is_printable` | `0012_licence_admin_rpcs`: `licence_admin_*` functions | **Yes** |
| 0013 | `0013_order_workflow`: redefines `place_order`, `shop_paper_capability`, `set_order_payment`; adds `shop_paper_offer`, `guard_paid_order_stop` | `0013_licence_admin_read_rpcs`: `admin_search_shops`, `admin_shop_audit`, `admin_shop_licence`, `licence_admin_read_gate` | **Yes** |
| 0014 | `0014_create_shop_confirmed_email`: redefines `create_shop` | None | No |
| 0015–0017 | Free | Not used (proposal only) | No |
| 0018 | Free | Not used (7F proposal only) | No |

**Duplicate numbers:** 0011, 0012 and 0013 (three pairs).

## 2. Name checks

- **Functions.** Licence files: 39 names. Chain A `0011`–`0014`: 17 names. Base `0001`–`0010`: 43 names. No name is shared between the licence files and either other set. Chain A redefines 8 functions that already exist in `0001`–`0010`: `_price_order_items`, `approve_order_for_print`, `place_order` and `quote_order` (0011); `agent_claim_next_job` and `agent_mark_printing` (0012); `place_order` and `set_order_payment` (0013); `create_shop` (0014). The licence line redefines none of them.
- **Tables.** Licence tables above; Chain A tables `order_charges`, `shop_extra_charges`, `shop_paper_sizes`; base tables include `print_agent_pairings`, `print_agents`, `print_jobs`, `rate_limits`. No overlap. `platform_admins` and `shop_licence_meta` are not created anywhere in `0001`–`0010`.
- **Cross-references.** No licence file mentions a Chain A object, and no Chain A file mentions a licence object (grep). The only shared dependency is `public.shops` (from 0001).
- **Redefinitions inside Chain A.** `place_order` is defined in 0011 and redefined in 0013, so the later file wins. `agent_claim_next_job` and `agent_mark_printing` are redefined in 0012. Order matters within Chain A.

## 3. Dependencies

- Chain A must apply in numeric order `0011 → 0014`.
- Licence files must apply in order `0011 → 0012 → 0013`. 0012 and 0013 use the tables and types created in 0011.
- The licence files depend on `public.shops` and `public.is_shop_owner` (both defined in 0001). A grep finds no reference to Chain A objects in either direction, so their number can change without changing their SQL, provided every reference to the number is updated.
- **7F depends on Chain A.** Item 33 places locks in `approve_order_for_print`, `agent_claim_next_job` and `agent_mark_printing`. Their current versions are in Chain A (0011, 0012). The licence line has only the 0010 versions. 7F gates therefore cannot be built on the licence line alone. Combining the lines is a precondition (EX-03).

## 4. Options

| Option | Layout | Assessment |
|---|---|---|
| A. Current files | Chain A 0011–0014; licence 0011–0013 | **Not acceptable** as one history: duplicate numbers |
| B. 2026-11-10 proposal (working default, not approved) | Chain A 0011–0014; licence 0015–0017; 7F 0018 | **Technically consistent.** No name clash. A single chain 0010 → 0011–0014 → 0015–0017 → 0018. Requires renaming three files and every reference (done once today and reverted; reproducible from the snapshot and the moved-aside copies) |
| C. Alternative | Licence 0011–0013 kept; Chain A moved to 0014–0017; 7F 0018 | Also consistent. Renumbers the unpushed Chain A line, whose names appear in its own files and docs |
| D. Merge into one file | — | Rejected: no dependency reason, and it would hide the history |

## 5. Recommendation

Option **B**, subject to these conditions. None is met yet.

1. **Owner approves D-MIG explicitly.** The brief and the 2026-11-10 working default disagree; only the owner can settle this (register §13E and §13F).
2. **Hosted history verified read-only by the owner (RB-03).** Confirm that no `0011`–`0018` name is applied on the hosted project under another name. Do not search for credentials and do not run hosted SQL.
3. **Combining approved (EX-03).** Build the combined line on an isolated branch from `37e4623` plus the stage7 files. No automatic merge with `origin/main` history.
4. **Local SQL tests run only with approval (EX-01).** Order: 0001–0010, then 0011–0014, then 0015–0017, then 0018.

## 6. Safe sequence (only after approval; nothing executed)

1. Owner approves D-MIG (Option B or another option).
2. Owner records the hosted migration list (read-only).
3. Rename in an isolated worktree or branch. Comment-only edits, checked by SHA and by residual-token search, as done today.
4. Combine on an isolated integration branch (EX-03). Re-run `admin` and `web` tests.
5. Local SQL run on a throwaway cluster (separate approval), in numeric order.
6. Staging copy (separate approval), same order. Staging tests S1–S9 and the item 33 tests as separately approved.
7. Commit and push (separate approval).
8. Hosted apply (separate approval). Not requested now.

## 7. Corrections and checks added on 2026-11-10 (later pass)

Each count below was recomputed from git and the files in this pass (`git show 37e4623:…`, `git grep origin/main`, and the licence files on disk).

- **Counts confirmed.** Licence files: 39 functions and 8 tables. Chain A `0011`–`0014`: 17 functions and 3 tables. Base `0001`–`0010` on `origin/main`: 43 functions.
- **Overlaps confirmed.** Licence against Chain A: no shared function or table name. Licence against base: none. Chain A against base: exactly the eight functions in §2 (`_price_order_items`, `agent_claim_next_job`, `agent_mark_printing`, `approve_order_for_print`, `create_shop`, `place_order`, `quote_order`, `set_order_payment`). No Chain A name appears in the licence files. `platform_admins` and `shop_licence_meta` are not on `origin/main`.
- **Not re-checked.** The four base table names given in §2 were not checked one by one. The no-overlap result does not depend on them.
- **Numbering references beyond the SQL.** Admin tests read `0011`–`0013` by path (`admin/tests/read-model.test.js`, `guards.test.js`, `read-api.test.js`, `licence-api.test.js`). A renumber therefore needs test-path edits as well as file renames. 7E comments and `docs/STAGE7E_LICENCE_STATUS.md` also name `0012`. The register's D-MIG row now lists these.
- **7E dependency.** `shop_licence_status` is defined only in `0012`, not in `0011`. The other 16 RPC names referenced by 7E source are defined on `origin/main`. Five of them are also redefined by Chain A on `37e4623` (`approve_order_for_print`, `create_shop`, `place_order`, `quote_order`, `set_order_payment`). 7E calls the RPC by name, so a renumber changes only its comments. Publication order remains an owner decision (EX-15).
