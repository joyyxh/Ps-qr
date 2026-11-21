# Owner sign-in fix and UPI order fix: database deployment package (migrations 0010, 0018, 0019, 0020)

**Status: ready for review. Nothing has been applied to the hosted project (`qvnwqrevgyootaaunrto`).**
Live writes stay blocked until every gate in section 2 is closed and the owner approves. No merge, no
deploy, no ledger edits, no cleanup run.

Branch: `stage7-implementation-2026-11-13`. Migrations are byte-identical to that branch (see `SHA256SUMS`).

## 1. What will change on the hosted project

Four existing migrations, applied in this order. None contains DML outside function bodies, and none
contains transaction control or `create extension`.

| Order | File | Adds or changes | Existing rows |
|---|---|---|---|
| 1 | `0010_print_agents.sql` | Four print tables, closed to browsers. `customer_files.storage_deleted_at` (nullable). `track_order` replaced: same fields, plus 30 lookups a minute per client key. `expired_customer_file_paths` replaced: the 30-day rule (section 2, G3). About 21 print and rate-limit functions. | Not changed |
| 2 | `0018_auto_print.sql` | `shops.auto_print_enabled boolean not null default false`. `set_auto_print`, queue function, `auto_print_on_approval` trigger on `orders`. `approve_order_for_print` replaced. | Not changed; switch off for every shop |
| 3 | `0019_advisor_fixes.sql` | `memberships_read` policy replaced with the same rule. Seven indexes. | Not changed |
| 4 | `0020_upi_order_and_print_hardening.sql` | UPI orders: both `place_order` overloads replaced. The payment method is written in the same insert that creates the order (before 0020 the order was inserted as cash and then changed, which the payment guard refuses). New internal function `_place_order_core` with no EXECUTE for browser roles. `auto_print_on_approval` loses EXECUTE for `anon`, `authenticated` and `PUBLIC`; the trigger still fires. | Not changed |

Not included, on purpose:

- **0011 to 0014.** No file with those names exists in this repository or in any branch's git history. A
  static scan and the owner-schema contract test show that 0010, 0018, 0019 and 0020 need nothing from them. The
  licence chain in CI (0001 to 0010 plus 0015 to 0017) also runs without them.
- **0015 to 0017 (licence).** Separate decision. The licence screen will show an error until they are
  applied. The sign-in fix does not depend on them.
- Any down migration, cleanup deployment, edge function deployment, or hand edit of the ledger.

Rehearsal evidence (section 10) covers the four files.

## 2. Gates: every gate must be closed before the first live write

| Gate | What it is | Status |
|---|---|---|
| G1 | **Owner approval** to change the hosted database, to accept the behaviour changes in `docs/OWNER_CATCH_UP.md`, and to accept the UPI order fix and the removed browser EXECUTE grant in 0020. | OPEN |
| G2 | **Verified backup.** The organisation is on the **free** plan. No platform backup or point-in-time recovery is assumed. The operator runs `backup_and_verify.sh` with `pg_dump` 17 from their own machine, and restores the dump into an empty PostgreSQL 17 database they control. The restored row counts must match section 3, check 5. This package cannot take the backup: it has no database credentials. | OPEN |
| G3 | **Retention decision.** 0010 implements the rule written in `supabase/functions/cleanup-files/index.ts`: a customer file linked to an order becomes removable 30 days after that order ends. The live `expired_customer_file_paths` (0007) removes only unclaimed expired files, so 0010 adds a new deletion candidate set. The cleanup function is **not deployed**, so applying these migrations deletes nothing. The owner must accept the rule before cleanup is ever deployed. The rule is not changed in this package. | OPEN |
| G4 | **Atomicity of `apply_migration`.** Supabase's knowledge base says the migration runner wraps each migration file in its own transaction, and that explicit `BEGIN`/`COMMIT` break that wrapper. The article does not confirm this for the MCP `apply_migration` tool. This package therefore assumes nothing: section 6 is the recovery path if a file stops part-way. | ACCEPTED only with section 6 in place |
| G5 | **Major version.** The hosted server is PostgreSQL **17.11**. The local rehearsals ran on PostgreSQL **16.15** only. Run `rehearse.sh` and `run_catch_up.sh` against a PostgreSQL 17 server: the CI job `owner-catch-up-rehearsal` (`.github/workflows/owner-catch-up-rehearsal.yml`) uses a `postgres:17` service. Then replace the expected values in section 7 with the values from that run. | OPEN |
| G6 | **Customer tracking limit.** `request_client_key()` uses the first address in `x-forwarded-for`, then `x-real-ip` or `cf-connecting-ip`. If none of these reaches the database, every customer shares one bucket of 30 lookups a minute. A client that sets its own `x-forwarded-for` can also choose its bucket. Neither is verified on the hosted gateway. The owner must accept this, or ask for a change to the key derivation first (a reviewed code change, not part of this package). | OPEN |

## 3. Pre-checks (read-only; run in this order; save every output with a timestamp)

1. **`ledger.sql`.** Expect exactly 11 rows. The names are `stage1_foundation`, `fix_tracking_code_alphabet`,
   `shared_pricing_and_quote_order`, `services_public_policy_fix`, `stage4_customer_files`,
   `stage6_shop_features_payment_qr`, `stage6_fix_shop_assets_policy`, `stage7_payments_and_statistics`,
   `qrquick_security_hardening`, `qrquick_payment_intents`, `cash_policy_and_payment_hardening`. No row named
   `print_agents`, `auto_print`, `advisor_fixes` or `upi_order_and_print_hardening`. **Stop** on any other result.
2. **`supabase/tests/owner_catch_up/preflight_hosted.sql`.** Expect every row `false`. **Stop** otherwise.
3. **`fingerprint.sql`.** The six kinds `column`, `constraint`, `index`, `policy`, `table`, `trigger` must
   equal the values in section 7. The `function` kind is expected to differ on the hosted project; check 4
   covers it. **Stop** on any other difference.
4. **`functions.sql`.** `track_order`, `expired_customer_file_paths` and both `place_order` overloads are the
   only existing functions this package replaces. Their digests must equal the expected values in section 7.
   **Stop** if any differs: the apply would silently overwrite a live change that is not in the repository.
   (The live check so far was normalised for comments and whitespace; these exact digests have not yet been
   compared. The `place_order` rows are new to this check: 0020 replaces them.)
5. **`digests.sql`.** Record the row count and digest of each of the eight existing tables. These are the proof
   that the apply changed no data. Check 4 is the only exception: a digest that does not change is the expected
   result, and any change means stop.

## 4. Apply sequence (only after every gate in section 2 is closed)

1. Run `backup_and_verify.sh`. Confirm the restore check.
2. Re-run the pre-checks in section 3. Every stop condition must pass.
3. Apply `supabase/migrations/0010_print_agents.sql` with `apply_migration`, name `print_agents`, using the file
   content exactly. Confirm success. Stop on any error (section 6).
4. Apply `supabase/migrations/0018_auto_print.sql`, name `auto_print`. Same rules.
5. Apply `supabase/migrations/0019_advisor_fixes.sql`, name `advisor_fixes`. Same rules.
6. Apply `supabase/migrations/0020_upi_order_and_print_hardening.sql`, name `upi_order_and_print_hardening`. Same
   rules. It must come after 0018: it removes EXECUTE from `auto_print_on_approval`, which 0018 creates.
7. Run the post-checks in section 5.
8. Schema cache: send a read-only request with the **publishable** key from the dashboard (never commit it):
   `curl -s "https://<project-ref>.supabase.co/rest/v1/shops?select=auto_print_enabled&limit=1" -H "apikey: <publishable-key>"`.
   The expected answer is `[]` or rows, not an error. Only if the answer says the column does not exist, run
   `NOTIFY pgrst, 'reload schema';` once and repeat the request.
9. Owner acceptance: a real owner signs in on the Android app and on the web app. The shop list loads and the
   orders screen opens. The licence screen may still show an error (0015 to 0017 are not applied). No test order
   is placed on the live project by this package; UPI ordering was tested on the staging project (section 10).

## 5. Post-checks: what "good" looks like

| Check | Expected after the four files |
|---|---|
| Ledger | 15 rows: the 11 above plus `print_agents`, `auto_print`, `advisor_fixes`, `upi_order_and_print_hardening` |
| Preflight | Every row `true` |
| Fingerprint | Changes only in: `table` (+4), `column` (+2), `function` (+new), `policy` (`memberships_read` only), `index` (+7 from 0019 and the print indexes), `trigger` (+1, `orders_auto_print`). `constraint` gains only the print-table constraints. 0020 adds no table, column, index, policy, trigger or constraint. |
| Functions | Changed: `track_order`, `expired_customer_file_paths`, `place_order` (both overloads). Every other entry is new, including `_place_order_core`. `auto_print_on_approval` has no EXECUTE for `anon`, `authenticated` or `PUBLIC`. |
| Digests | Identical to the pre-check values for all eight tables |
| Owner query | Returns the owner's shops with `auto_print_enabled = false` |

## 6. Failure and recovery

- **Stop at the first error.** Do not run the next file. Do not re-run the file that failed unless section 6.2 says so.
- **Read the state first:** run `ledger.sql`, `fingerprint.sql` and `functions.sql`, and compare with the pre-check.
- **6.1 No partial objects** (the fingerprint still equals the pre-check): fix the cause and apply the failed
  file again. `0018`, `0019` and `0020` can be re-run safely (`create or replace` and `revoke` only). `0010`
  cannot: it refuses at its first statement (proven by the rehearsal), so only a clean state can take it.
- **6.2 Partial objects exist** (most likely in 0010): run `rollback.sql`. It is guarded: it refuses, and
  changes nothing, if any print job or print agent exists, if automatic printing is on for any shop, or if any
  customer file is marked deleted. The failure drill in the rehearsal proves that a half-applied 0010 is undone
  exactly. After the rollback, re-run the pre-checks, then apply the file again. Rolling back 0020 restores the
  UPI order bug (every UPI order fails with "customer payment method is immutable"), so prefer a forward fix
  once 0020 is in place.
- **6.3 Ledger rows:** `rollback.sql` does not remove rows that `apply_migration` wrote to
  `supabase_migrations.schema_migrations`. Removing them rewrites history, so that is an owner decision, taken
  case by case. Do not delete them as part of this package.
- **6.4 Whole-database restore** from the G2 backup replaces the database. Only with the owner's explicit decision.
- **Preference:** a forward fix over a rollback, once any real owner has signed in.

## 7. Expected values

**Status: the PostgreSQL 17 run (G5) has not yet produced these values.** The values below are from the local
PostgreSQL 16.15 rehearsal of the baseline (migrations 0001 to 0009), 2026-11-21. Replace them with the values
from the PostgreSQL 17 CI run before any live apply, because `pg_get_functiondef` output can differ between major
versions. Until then, check 3 and check 4 cannot be used as stop conditions on the hosted project.

Fingerprint of 0001 to 0009 (six kinds compared live; `function` excluded):

```
column|86|06bca23d2ee649730163c20e06bfbb8f
constraint|70|47d97e2c3e8ce003225c4a1164ef7e61
index|23|7267c8a59a25950ad5084199707327c5
policy|12|ec6625e5eabf4f835395f85c23699bb3
table|8|2a0a29ffd9e3359f9cafe1bd718fd3d0
trigger|6|76273304945002f468168b65fc9bdf98
```

Function digests to match before the apply (check 4):

```
track_order(p_code text)                                                                     923464bfe2739835228dfb14620969cf
expired_customer_file_paths(p_limit integer)                                                 26c8733ce0e7d7be30ccd8625c4e4ce5
place_order(p_shop_slug text, p_items jsonb, p_customer_note text)                           dec5753243f5ddf1a53121e2542e3b16
place_order(p_shop_slug text, p_items jsonb, p_customer_note text, p_payment_method text)     da1c5fda262f2a21fd4d789738b4a03d
```

Row counts in the rehearsal baseline (0001 to 0009 plus the rehearsal rows): `customer_files` 1, `feature_catalog` 8,
`order_events` 1, `order_items` 1, `orders` 1, `services` 5, `shop_memberships` 3, `shops` 3.

## 8. Risk register

| # | Risk | Effect | Handling |
|---|---|---|---|
| R1 | Shared tracking bucket if no client header reaches the database (G6) | All customers share 30 tracking lookups a minute | Owner decision before apply; verify after apply |
| R2 | `x-forwarded-for` can be set by a client | Brute-force limit on tracking codes can be bypassed | Known limit of the design, not changed here; owner to accept or fix separately |
| R3 | 30-day rule removes files linked to ended orders (G3) | Deletions possible once cleanup is deployed | Cleanup is not deployed; owner decision first |
| R4 | `apply_migration` may not be atomic per file (G4) | A failed file can leave partial objects | Section 6; drill proven locally |
| R5 | Local rehearsals ran on PostgreSQL 16.15; hosted runs 17.11 (G5) | A version-specific difference would be missed | CI job on PostgreSQL 17; section 7 replaced from that run |
| R6 | `rate_limits` grows, one row per client key | Table size grows until cleanup runs `purge_old_rate_limits` | Watch the table size; cleanup decision with G3 |
| R7 | `CREATE INDEX` without `CONCURRENTLY` (0019) | Writes to `order_items`, `customer_files`, `orders` wait during the build | Small tables; run outside peak hours |
| R8 | `track_order` is replaced; a non-atomic apply would leave a short gap | Customer tracking may error for seconds | Atomic apply avoids it; otherwise run outside peak hours |
| R9 | `memberships_read` is replaced; a non-atomic apply would leave a short gap | Membership reads fail for seconds, so owner sign-in can fail | As R8 |
| R10 | Live functions differ from the repository in comments or whitespace, or in the replaced bodies | Not overwritten, unless they are the functions in check 4 | Check 4 stops the apply if they differ |
| R11 | Ledger names differ from repository file names; the Supabase CLI was not run | `supabase db push` on this folder could misread the `0001_` style names | Do not use `db push` here; `apply_migration` only |
| R12 | Stage 8 and Stage 9 suites write data (inside a rolled-back transaction) | Must never run against the hosted project | They are run locally, in CI, and on the staging project only |
| R13 | Local shims stand in for the Supabase `auth` and `storage` schemas | Behaviour on the hosted gateway may differ | Owner acceptance test (section 4, step 9) |
| R14 | Licence screen error until 0015 to 0017 are applied | Owner sees an error on one screen | Documented in `docs/OWNER_CATCH_UP.md` |
| R15 | 0020 changes how every order is placed (cash and UPI) | An order-placement bug would stop customers ordering | Stage 5 and Stage 9 suites, rehearsal, and staging test (section 10); owner acceptance |
| R16 | 0020 removes browser EXECUTE on `auto_print_on_approval` | A future caller through the API would be refused | No caller exists in the repository; the trigger still fires (test U10 and U11) |

## 9. Final verification checklist

- [ ] SHA-256 of the four migrations matches `SHA256SUMS` and branch HEAD.
- [ ] Web tests pass: `npm test` in `web/` (243 of 243, including the owner-schema contract).
- [x] `rehearse.sh` and `run_catch_up.sh` pass on PostgreSQL 16.15 with 0020 included (local, 2026-11-21).
- [ ] `rehearse.sh` and `run_catch_up.sh` pass on PostgreSQL 17 (G5, CI job `owner-catch-up-rehearsal`).
- [ ] Section 7 replaced with the PostgreSQL 17 values from that job.
- [ ] Backup taken with `pg_dump` 17, and the restore check matches section 3 (G2).
- [ ] Owner decisions recorded: G1, G3, G6 (G4 accepted with section 6).
- [ ] Pre-checks saved; every stop condition passed.
- [ ] Each of the four migrations applied in order, with its success recorded.
- [ ] Post-checks match section 5; ledger shows 15 rows.
- [ ] Publishable-key schema-cache request returns no column error.
- [ ] Owner signs in on a device; shop list and orders open.
- [ ] Nothing merged to `main`; the branch is pushed for review only.

## 10. Local evidence (PostgreSQL 16.15)

2026-11-19 (0010, 0018, 0019):

- Reproduction: the owner's sign-in query fails with `column s.auto_print_enabled does not exist`.
- Existing rows: all eight tables unchanged after the catch-up (digests over the 0009 columns).
- Functions replaced: `track_order` and `expired_customer_file_paths` only. Everything else is new.
- Stage 8 suite: 48 ok, 0 not ok; it leaves no rows behind.
- Idempotency: 0018 and 0019 re-run with no change; 0010 re-run refused at its first statement, no change.
- Failure drill: a 0010 stopped part-way is undone exactly by `rollback.sql`.
- Full rollback restores the 0009 state exactly (functions, grants, fingerprint, digests); the catch-up then
  re-applies to the same state.
- Guard: rollback refuses while automatic printing is on, with the error `ROLLBACK REFUSED`, and changes nothing.

2026-11-21 (adds 0020):

- `run_catch_up.sh` passes on PostgreSQL 16.15: the reproduction, the catch-up of 0010, 0018, 0019 and 0020, the
  owner query, the auto-print checks, and browser roles with no EXECUTE on `auto_print_on_approval`.
- `rehearse.sh` passes on PostgreSQL 16.15: Stage 8 48 ok; Stage 9 (UPI) 12 ok; the functions replaced are
  exactly `expired_customer_file_paths`, `place_order` (both overloads) and `track_order`; full rollback restores
  the 0009 state exactly, and the catch-up re-applies to the same state.
- Stage 9 on the staging project (not live): 12 of 12, rolled back, no rows left behind. It covers a UPI order
  placed and stored as `upi`, `pending`, `online`; a cash order; the UPI refusal at a shop with no QR; the
  immutability guard (42501); owner payment and approval; auto-print queueing a paid UPI order; and browser
  roles refused on the trigger function.
- Base SQL suites (eight suites, 282 checks, branch migration chain) pass on PostgreSQL 16.
- Not run: PostgreSQL 17 (pending: CI job); the hosted project; `apply_migration`; the schema-cache request; a
  device sign-in.

## 11. Files

- `RUNBOOK.md` (this file)
- `gen_digests.sql`: generator for `digests.sql` (run on a 0009 database)
- `digests.sql`: read-only row counts and digests of the eight existing tables
- `functions.sql`: read-only function list with grants and definition digests
- `fingerprint.sql`: read-only structural fingerprint
- `ledger.sql`: read-only migration ledger
- `rollback.sql`: guarded emergency rollback (not part of the normal deployment)
- `backup_and_verify.sh`: operator backup and restore check (no credentials in the file)
- `rehearse.sh`: local or CI rehearsal on a throwaway database
- `rehearsal_data.sql`: rehearsal-only rows (never run on a hosted project)
- `SHA256SUMS`: hashes of the migrations, the package files and the preflight query
- `.github/workflows/owner-catch-up-rehearsal.yml`: the PostgreSQL 17 rehearsal job for the feature branch
