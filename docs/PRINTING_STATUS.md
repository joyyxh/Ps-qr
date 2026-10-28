# QRquick printing: status and deployment

This file says what is built, what was tested, and what was not. Read it before you tell a
shop that printing works.

**Short answer:** the database rules, the print-agent API, the desktop agent and the owner
screens are written and pass their local tests. **Automatic printing has not been tested on a
real printer, with the live Supabase project, or in the Android app.** Those steps are yours
(see "Before going live").

## Requirements, one by one

| Area | Status | Notes |
|---|---|---|
| Owner approval and payment rules | Built, tested locally | Approve, pay, then send. The database blocks printing unless the order is approved and paid. |
| Pairing a printer computer | Built, tested locally | One-time 8-character code, 10 minutes. Only a hash of the code and of the token is stored. |
| Printer status and choice | Built, tested locally | Computers report printers; the owner picks one per computer. |
| Windows agent | Written, **not run on Windows** | SumatraPDF plus PowerShell. Setting names are unverified on a real install. |
| Linux agent (CUPS) | Written, **not run on CUPS** | Uses `lpstat`, `lpoptions`, `lp`. |
| Sending jobs without duplicates | Built, tested locally | Claim lease, "printing" recorded before the printer gets the file, `needs_check` for uncertain jobs, no automatic reprint. |
| Simulated printing (testing only) | Built, tested locally | `qrquick-print-agent simulate` runs the order steps offline, from a local file. It makes no network request, never calls CUPS, PowerShell, SumatraPDF or a printer, and never says paper came out. It does not test the live server or database, or real printers. |
| Failure handling | Built, tested locally | Offline printer, unsupported option, spooler error, lost connection, revoked computer, repeated claims. |
| Owner retry | Built, tested locally | Failed jobs can be printed again. Jobs that may have printed need confirmation. |
| Print options | Partial | Copies, colour, double-sided and A4 are applied and refused when the printer cannot do them. Orientation, page range, fit-to-page, cropping and the customer's paper choice are **not** built. |
| Retention cleanup | Built, not deployed | Files of finished orders are removed after 30 days; files used by open jobs are never removed. Runs from GitHub Actions at 02:00 IST. |
| Rate limits | Built, tested locally in SQL | Anonymous uploads, order tracking, pairing, and per-address and per-token agent limits. Depends on the real client address reaching the functions (see below). |
| RLS and server authorisation review | Done by reading, partial | Print tables have RLS enabled and no browser policies; owner RPCs check membership; agent RPCs check the token. Not a formal audit. |
| Statistics and pricing controls | Reviewed by reading only | Not changed in this round. |
| Test suites | See below | |

## What was tested, and how

- **Migration `0010_print_agents.sql`** applied on a local PostgreSQL 16 stub after migrations
  0001–0009. `supabase/tests/stage8_print_tests.sql`: **48 of 48 pass.**
- Earlier suites, on the same stub: stage1 30/30, stage3 30/30, stage4 23/23, stage5 23/23,
  stage7 54/54, stage6 42/43. The stage6 failure (S41) also fails on the baseline migrations
  because of how the local storage stub behaves.
- **Four existing test files had fixtures that did not match the repo's own rules** (file paths
  must be `shop_id/file_id.pdf`; unpaid orders cannot move to printing). Those fixtures were
  corrected in `stage1`, `stage4`, `stage5` and `stage6`. This is a fix to the tests, not the app.
- `supabase/tests/print_agent_api_checks.test.js`: 7 of 7 static checks on the print-agent function
  (code normalisation, hashing, token handling, no database text in responses, rate limits).
  These read the source; the function itself was **not executed**.
- **Desktop agent (`agent/`)**: 102 of 102 unit tests, using fake printers and a fake server. That is
  61 from before, plus 14 for the simulated printer, 25 for the offline simulation, and 2 for the
  real `run` command (its wiring through a local stub that answers 401, and the early refusal of
  `run --simulated-printer`).
- **Simulation guard check**: five safety guards were each disabled on purpose, one at a time. Each
  one made specific tests fail within seconds, and none hung. The file was restored and compared
  byte for byte after each run.
- **Web app (`web/`)**: `npm test`, 124 of 124 pass, including 10 new tests for the printing helpers
  and API calls.

Not run in this round: the Deno edge functions (no Deno runtime here), the live Supabase project,
any real printer, the Windows and CUPS adapters against real software, the owner screens in a
browser, and the Android APK build (the build runs only in GitHub Actions).

## Before going live (in this order)

1. **Confirm with the team that migration 0010 may be applied to the live database.** Then apply it
   after 0009. It is not applied anywhere yet.
2. Deploy the functions:
   - `supabase functions deploy print-agent --no-verify-jwt`
   - `supabase functions deploy cleanup-files --no-verify-jwt`
   - `supabase functions deploy upload-file` and `owner-file-link` (both changed in this round).
3. Set the cleanup secret on Supabase: `supabase secrets set CLEANUP_SECRET=<long random value>`.
4. In the GitHub repository, add two secrets:
   - `QRQUICK_CLEANUP_URL` = `https://<project-ref>.supabase.co/functions/v1/cleanup-files`
   - `CLEANUP_SECRET` = the same value as step 3.
   Then run the **cleanup-files** workflow once by hand and check its output.
5. **Check that the client address reaches the functions.** The rate limits key on `x-forwarded-for`
   (or `cf-connecting-ip`). If the gateway does not pass a client address, every visitor shares
   one limit, and a busy shop can block everyone else. Look at a function log line or a test
   response after deploying.
6. Run `supabase/tests/stage8_print_tests.sql` on a **staging** copy of the database, not the live one.
7. Rebuild the Android APK with the **android-apk** workflow. The owner screens changed, and the
   app loads them from the web build.
8. Run the desktop agent on one real shop computer and tick every item in `agent/README.md`'s
   hardware checklist. Only then describe automatic printing as working.

## Things still to do (not part of this round)

- Customer-side print options: orientation, page range, fit-to-page, cropping, paper size.
  The order does not yet record them.
- A real paper-size check on Windows.
- Repeat the review of the file-link and retention code with a timestamp simulation.
- Browser test of the owner screens (the Playwright smoke suite needs its own install).
- Simulation never contacts a server, so it cannot write to the database. A server-side simulated
  flag was considered and not built. It would not stop a localhost server connected to production
  from writing rows, so it does not address this risk. It would need a migration and an explicit
  decision in any case.
- The live server and database rules (migration 0010) have not been run here. The offline
  simulation follows four of the same rules, and a test checks that the migration still states
  those four. Lease expiry, revocation, job recovery and the deleted-file filter are not copied.

## Files added or changed in this round

- `supabase/migrations/0010_print_agents.sql` (new)
- `supabase/functions/print-agent/index.ts` (new), `supabase/functions/cleanup-files/index.ts` (new)
- `supabase/functions/upload-file/index.ts` (rate limit added), `supabase/functions/owner-file-link/index.ts`
  (removed files give "no longer stored")
- `.github/workflows/cleanup-files.yml` (new)
- `supabase/tests/stage8_print_tests.sql`, `supabase/tests/print_agent_api_checks.test.js` (new)
- Stale fixtures corrected in `supabase/tests/stage1_isolation_tests.sql`, `stage4_files_tests.sql`,
  `stage5_orders_tests.sql`, `stage6_features_tests.sql`
- `agent/` (new): desktop agent, CLI, tests, `README.md`
- `web/src/owner.js`, `web/src/owner-api.js`, `web/src/logic.js`, `web/styles.css`: printing controls
- `web/tests/print-logic.test.js` (new); `web/tests/orders.test.js` (select string updated);
  `web/package.json` (test list)
- `docs/PRINTING_STATUS.md` (this file)

## Stage 6 round: simulated printer (branch `stage6-simulated-printer`)

- `agent/src/simulation.mjs` (new): the offline `simulate` steps, fixture checks and the in-memory
  server that follows four of migration 0010's job rules
- `agent/src/printers/simulated.mjs` (new): the simulated adapter (the localhost check was removed)
- `agent/src/cli.mjs`: the `simulate` command; `run --simulated-printer` is now refused before any
  setting is read; `makeAdapter` is back to its original form
- `agent/src/worker.mjs`: one log line says SIMULATED when the adapter is simulated; a comment
  explains a lost "printing" reply (comment only, no runtime change)
- `agent/test/simulated.test.mjs` (new, 14 tests): the simulated printer and worker steps
- `agent/test/simulation.test.mjs` (new, 25 tests): offline simulation, fixture checks, links inside
  the fixture folder, safety limit, CLI
- `agent/test/run-wiring.test.mjs` (new, 2 tests): the real `run` command against a local stub that
  answers 401, with no printer and no QRquick, and the early refusal of `run --simulated-printer`
  before the config is read
- `agent/README.md`, `docs/PRINTING_STATUS.md`, `README.md`: simulation notes
- No database migration, no Supabase change, no change to the live server, the APK or GitHub Pages
