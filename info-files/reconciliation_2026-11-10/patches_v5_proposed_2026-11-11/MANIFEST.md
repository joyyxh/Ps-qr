# U6: browser smoke scripts and two layout rules (LOCAL ONLY)

Status: local only. Not committed, not pushed, no branch, no PR. Base: `5c82d37` (`stage7-payments`).
Patch was generated from the stage7 worktree and is not applied to any other checkout.

## Contents

| File | sha256 (after change) |
|---|---|
| `U6_browser_smoke_and_layout.patch` (438 lines) | `f19cd2381a5eed65c604a62751855f7f995155da809820332f5f761f0f64be26` |
| `web/styles.css` | `e3394edf8f6eb0a41e03e22fe1b2fad90951f309b119772a9051e0038cae4108` |
| `web/tests/browser/owner-smoke.cjs` | `9f92091040b49fc98b51b58631eda636722aa3c261102cfcfdca223df2c53dd8` |
| `web/tests/browser/qr-smoke.cjs` | `740115a8de2a5153650b46539781fc73139991b7b3f6ab4c8b63aae6ad05d05a` |
| `web/tests/browser/features-smoke.cjs` | `07052a1f93c02aaf8e87f7e6737ccab407e5490bcea8eae21cd59f2acf5fd292` |
| `web/tests/browser/stats-smoke.cjs` | `69a2edfa25ab8a2d0d0eb6097ed5a5d140c1c03d6b42c6ccab9698144f682bdc` |

## What changes

Layout (product CSS, demonstrated defect):
1. `.grid` base rule gets `grid-template-columns: minmax(0, 1fr)`. On phones the single auto column was sized by the service select's longest option, 1px past the viewport.
2. `.order-shell` gets `grid-template-columns: minmax(0, 1fr)`. The order stepper and card were widened to 392px inside a 350px track, so the customer order page scrolled sideways by 22px at 390px wide.
   Evidence: `features-smoke-rerun2.log` through `rerun5.log` (offenders list and stepper geometry); final `rerun6.log` shows no overflow.

Smoke scripts (stale expectations corrected to match product code):
- owner-smoke: session key `qrquick.owner.session` (src/session.js); localStorage check looks for `owner.session`; customer page waits for `Add file to order` (src/app.js:285); approved order expects a `ready` button and no `printing` button (src/owner.js:1138 leaves "Start printing" out on purpose); mock answers `rpc/owner_print_status` (migration 0010 defines it); any 404 names its request URL.
- qr-smoke: config override matches any `publicBaseUrl` value (config.js ships a published one); the `local` scenario asserts the product rule (banner shown, no QR, no download; src/owner.js managerHtml); download name `qrquick-demo-xerox-qr.png` (src/owner.js:877); on-screen capture at 2x density and centred, because the fixed bottom nav covered the code's lower edge.
- features-smoke: footer text `QRquick does not take any payment` (src/app.js:309); upload uses a built-in 1x1 PNG instead of a file written by qr-smoke; a diagnostic prints the elements that pass the phone width.
- stats-smoke: open order offers a next step and no `printing` button.

Sandbox and session paths: the patch REMOVES `/home/claude/.npm-global/...`, `/home/claude/printnest/web` and scratchpad `/tmp/claude-0/...` paths that are already in `5c82d37`. No added line contains a private path (checked with grep).

## Validation (local: Chromium via Playwright, `python3 -m http.server 5173` serving the worktree `web/`, Supabase mocked)

| Script | Baseline (before this unit) | Final (`*-rerun6.log`) |
|---|---|---|
| qr-smoke | 7 of 16, exit 1 | 12 of 12, exit 0 |
| features-smoke | 21 of 24, exit 1 | 23 of 24, exit 1 (one open check, see below) |
| owner-smoke | crashed after 31 PASS (timeout), exit 2 | 39 of 39, exit 0 |
| stats-smoke | 25 PASS, 1 FAIL, exit 1 | ALL CHECKS PASSED, exit 0 |

Other checks:
- `node --check` passes on all four scripts.
- `npm test` in the worktree `web/`: 163 pass, 0 fail (run after the CSS change).
- Patch check: `git apply --check` passes on a fresh extraction of `patch_check/matrix/base_5c82d37.tar`; `git apply` succeeds; all five files are byte-identical to the worktree.
- Overlap with 7E (P4): 7E appends four rules after line 290 of `web/styles.css`; U6 changes the rules at lines about 100 and 285. Separate hunks, no conflict in either order. Not verified by applying both together.

Not validated: real phone or tablet, hosted or staging site, physical printer, 7E licence-smoke with U6 applied. Mocked Supabase only.

## Open items inside this unit

1. features-smoke `the greyed-out boxes say why` FAILS. The product shows no reason text on a greyed-out Colour or Double-sided card. The colour-only service message exists (src/app.js:385), but no approved document defines wording for the cards. The check is kept, not weakened.
2. Observation, not changed: on a phone, the fixed bottom navigation can cover the lower edge of the QR box when the page is scrolled to the end. Owner decision if a spacing change is wanted.
3. `web/tests/browser/README.md` on 7E described the older scripts and a sandbox path. Resolved in the P4 v5 unit (`P4_7E_web_v5.patch`, see `P4_7E_web_v5_MANIFEST.md`). Not part of U6.
