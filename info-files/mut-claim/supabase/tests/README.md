# Database tests

These are SQL test suites that run inside Postgres and report one row per check. They check
the rules that must hold on the server: pricing, validation, shop isolation, row-level
security and the print-job payload. Nothing in this folder talks to a hosted project.

## The suites

| File | Declared requirement | What it checks |
|---|---|---|
| `stage1_isolation_tests.sql` | none declared | Pricing, tenant isolation, guards on orders |
| `stage3_owner_tests.sql` | none declared | Owner functions and their permission checks |
| `stage4_files_tests.sql` | none declared | Customer file upload rules and claims |
| `stage5_orders_tests.sql` | none declared | Order placement and order-state rules |
| `stage6_features_tests.sql` | none declared | Shop features, payment QR, storage policies |
| `stage7_stats_tests.sql` | none declared | Statistics functions and their isolation |
| `stage8_print_tests.sql` | none declared | Print jobs, retries, agent claims (needs 0010 in practice) |
| `service_pricing_tests.sql` | none declared | The pricing matrix and every server-side refusal |
| `paper_sizes_tests.sql` | `requires-migration: 0011` | Paper sizes, surcharges, extra charges, snapshots, print payload, back-compatibility |

Every suite runs in one transaction and is rolled back, so it leaves no rows behind.
A suite that declares `requires-migration: NNNN` is skipped when that migration is not
applied. Suites without the header run at every level. Only `paper_sizes_tests` declares
one so far; adding headers to the older suites is a documentation change for later.

## How to run them: the local scratch runner

```
sudo -u postgres supabase/tests/scratch/run.sh                 # rebuild and run every applicable suite
sudo -u postgres supabase/tests/scratch/run.sh --rollback 0011 # apply 0001-0011, run the 0011 rollback,
                                                               # then run the suites that apply before 0011
```

What the runner does: it drops and recreates the database `qrquick_scratch`, applies the
Supabase stand-ins in `scratch/stubs.sql`, applies migrations 0001 onwards in order, loads
`seed/demo_seed.sql` (development data only), and runs each suite. It exits non-zero if any
check fails, if a suite errors, or if a suite produces no check rows.

### Safety

The runner is built so it cannot reach production:

- The database name is fixed in `run.sh` (`qrquick_scratch`). No environment variable changes it.
- It refuses to start if `DATABASE_URL`, `SUPABASE_DB_URL`, `PGURL`, `PGSERVICE`, `PGSERVICEFILE`
  or `PGHOSTADDR` is set, because those can point at a remote server.
- It refuses to start if `PGHOST` is not a Unix socket directory that exists, or a loopback
  address, or if it is a list (commas or spaces). It refuses a `PGPORT` that is not 1-65535.
- Before it drops anything, it asks the server for its address and refuses unless the address
  is a socket or loopback. Limit: a loopback port that an SSH tunnel forwards to a remote server
  would pass this check, so only use a Unix socket or a local cluster you run yourself.

`supabase/tests/scratch/guard_test.sh` checks the refusals without a database. It puts a fake
`psql` first on the path, runs each refusal case, and fails if any case is accepted or if `psql`
is called. Run it before the suites: `bash supabase/tests/scratch/guard_test.sh`.

### Requirements

- PostgreSQL 16 running locally, with a role that can create databases (the `postgres` user).
- `psql` on the path. The repository does not need Node or any other tool for these suites.

## What these tests are, and are not

- They run against a real Postgres 16 server, so the SQL, the constraints, the triggers and
  the row-level security are real.
- Supabase's `auth` and `storage` schemas, and its roles, are **stand-ins** (`scratch/stubs.sql`).
  That file mirrors the behaviour these tests rely on: `auth.uid()` reads the JWT subject, the
  `anon`, `authenticated` and `service_role` roles, the storage delete guard (SQLSTATE 42501),
  and the grants Supabase makes. It is not the hosted service. A check that passes here
  shows the rule holds in Postgres; it does not prove the same thing on the hosted project.
- The browser tests in `web/tests/browser/` use Playwright with mocked Supabase responses. They
  check the web app's behaviour, not the database.
- The unit tests in `web/tests/` run pure functions with `node:test`. They use no network.

## Adding a suite

1. Start the file with `-- requires-migration: NNNN` (the earliest migration it needs).
2. Wrap the work in `begin;` and `rollback;`, and put every check in a results table with
   columns `name text, ok boolean, detail text`.
3. End with `select name, ok, detail from <results table> order by name;` and then `rollback;`.
4. Run the runner. The suite is picked up automatically from `supabase/tests/*_tests.sql`.

## Mutation checks

To confirm a suite can fail, break one rule in a copy of a migration, apply the copy to the
scratch database, run the suite, and check that the expected checks fail. This was done for
the pricing rules (`service_pricing_tests`) and for the paper-size rules (`paper_sizes_tests`).
The copies are not kept in the repository.
