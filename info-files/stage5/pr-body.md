## What this changes

While the owner's Orders tab is open, the orders and printer status refresh every 25 seconds.

- Refresh pauses while the page is hidden and runs at once when the page becomes visible again.
- One request runs at a time, with one timer. Failed requests back off to a 5-minute cap, and the page says when updates are paused.
- A failed printer-status read is not repeated on every automatic refresh. It waits 5 minutes. Opening the page, actions and the Refresh button always ask.
- Refresh waits for an automatic request that is already in flight, then sends its own, so it cannot show older data.
- Automatic redraws keep the last action message (for example "Payment updated…") for 60 seconds.

Uses the existing shop-scoped reads. No Supabase, schema, migration, auth or printing-agent changes.

## Files (4)

- `web/package.json`: adds the new test file to `npm test`
- `web/src/owner.js`: wires automatic refresh into the Orders page
- `web/src/order-refresh.js` (new): timing logic, no DOM access
- `web/tests/order-refresh.test.js` (new): 16 unit tests

## Local checks

These were run locally. No workflow in this repository runs the test suite.

- `npm test`: 163/163
- `tests/order-refresh.test.js`: 16/16
- Mocked-browser check (Playwright, mocked Supabase, simulated clock): 50/50

Not tested: live Supabase, a real phone, and real background-tab behaviour.

## Before merging

Merging into `main` triggers two workflows:

- `pages.yml` publishes `web/` to GitHub Pages, which is the live site. No test step runs first.
- `android-apk.yml` builds a debug APK and uploads it as a 30-day artifact. It does not publish a release.

Printer status depends on migration 0010 (`owner_print_status`). It is not verified on the hosted project. If it is missing, the printer panel shows "not available" and the orders still load.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DxRqmb5mEMWYPJvm5FH5tt
