# QRquick printing: status and deployment

This file says what is built, what was tested, and what was not. Read it before you tell a
shop that printing works.

**Short answer:** the database rules, print-agent API, desktop agent and owner screens exist in source and have automated local/CI coverage. The agent tests use fake printers. **Automatic printing has not been verified on a real printer, on a live Supabase project, or from an installed Android app.**

> **Current release-gate correction (2026-11-15):** The setup instructions below are historical, not deployment approval. The cleanup cron schedule has been removed from `.github/workflows/cleanup-files.yml`; only manual dispatch remains. Do not manually run cleanup: when both GitHub secrets are configured it deletes expired customer files, and legal C-1 plus an owner-approved retention policy are still required. Stage 7F enforcement is not built and remains OFF. No hosted Stage 7 migration or deployment is authorized by this document. See `docs/STAGE7_HANDOVER.md` and `STAGE7_DECISIONS.md` for current gates.

## Requirements, one by one

| Area | Status | Notes |
|---|---|---|
| Owner approval and payment rules | Built, tested locally | Approve, pay, then send. The database blocks printing unless the order is approved and paid. |
| Pairing a printer computer | Built, tested locally | One-time 8-character code, 10 minutes. Only a hash of the code and of the token is stored. |
| Printer status and choice | Built, tested locally | Computers report printers; the owner picks one per computer. |
| Windows agent | Written, **not run on Windows** | SumatraPDF plus PowerShell. Setting names are unverified on a real install. |
| Linux agent (CUPS) | Written, **not run on CUPS** | Uses `lpstat`, `lpoptions`, `lp`. |
| Sending jobs without duplicates | Built, tested locally | Claim lease, "printing" recorded before the printer gets the file, `needs_check` for uncertain jobs, no automatic reprint. |
| Failure handling | Built, tested locally | Offline printer, unsupported option, spooler error, lost connection, revoked computer, repeated claims. |
| Owner retry | Built, tested locally | Failed jobs can be printed again. Jobs that may have printed need confirmation. |
| Print options | Partial | Copies, colour, double-sided and A4 are applied and refused when the printer cannot do them. Customers can crop and adjust JPEG and PNG pictures before upload (passport, square, 4 × 6 shapes; turn; brightness and contrast). Orientation, page range, fit-to-page, the passport sheet layout and the customer's paper choice are **not** built. |
| Retention cleanup | Function exists; scheduled workflow disabled in the repository | The cron schedule was removed on 2026-11-14. Manual dispatch remains and can delete expired files if both secrets are set; do not run until legal C-1 and owner retention approval are complete. |
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
- **Desktop agent (`agent/`)**: 61 of 61 unit tests, using fake printers and a fake server.
- **Web app (`web/`)**: `npm test`, 124 of 124 pass, including 10 new tests for the printing helpers
  and API calls.

Not run in this round: the Deno edge functions (no Deno runtime here), the live Supabase project,
any real printer, the Windows and CUPS adapters against real software, the owner screens in a
browser, and the Android APK build (the build runs only in GitHub Actions).

## Release gates (current, 2026-11-15)

1. Do not apply hosted migrations or deploy functions without the separate owner approval recorded in `STAGE7_DECISIONS.md`.
2. Do not run the cleanup workflow until legal C-1 and an owner-approved retention policy are complete. Manual dispatch is destructive when its two secrets are configured.
3. The current Stage 7 branch keeps PR #3 open and draft. Chain A, staging approval, hosted verification and the 7F owner/legal decisions remain blockers; enforcement is OFF.
4. The Android APK workflow now includes package/signature/alignment checks and an Android emulator install/launch attempt. Treat the result as unverified until that workflow completes successfully; emulator success is not a substitute for the owner's device check.
5. The final real-world printer test remains an owner task. Until a real Windows/CUPS environment and physical printer are verified, do not claim automatic printing is production-ready.

## Things still to do (not part of this round)

- Customer-side print options: orientation, page range, fit-to-page, passport sheet layout, paper size.
  The order does not yet record them.
- A real paper-size check on Windows.
- Repeat the review of the file-link and retention code with a timestamp simulation.
- Browser test of the owner screens (the Playwright smoke suite needs its own install).

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
