# Browser checks (headless Chromium, mocked backend)

These scripts check the web app at phone width (390 px). They are not part of `npm test`.
Each one replaces Supabase with an in-memory mock using Playwright's `page.route`, so they check
the screens and requests, not the live backend.

They run in GitHub Actions, in `.github/workflows/stage7-tests.yml`:

- job `browser-smokes`: `owner-smoke.cjs`, `qr-smoke.cjs`, `stats-smoke.cjs`, `licence-smoke.cjs` (must pass).
- job `browser-features-open-check`: `features-smoke.cjs`. It has one known open check, below, so this
  job shows as failed until the owner decides the wording. It is marked `continue-on-error`, so the
  workflow run is not failed by it, and the red job row stays visible.

`run_smokes.sh` starts both servers, runs the scripts you name, and exits non-zero if any script fails.
It is the same command CI uses.

Where each script expects the app:

- `owner-smoke.cjs`, `qr-smoke.cjs`, `features-smoke.cjs`, `stats-smoke.cjs`: `http://127.0.0.1:5173/` (`npm start`).
- `licence-smoke.cjs`: `http://127.0.0.1:5174/`.

## Dependency on the browser-smoke fix

The owner, QR, features and statistics scripts in this folder are the corrected versions. They
need the browser-smoke fix and its two layout rules in `web/styles.css`. Without that fix, these
four scripts fail on this branch: their expected values are out of date and they still contain
sandbox paths. Apply the fix before running them.

## Last results

Run on 2026-11-12 with the corrected scripts, headless Chromium through Playwright, mocked backend.
Re-run on 2026-11-14 through `run_smokes.sh` with Playwright 1.63.0 and opencv-python-headless 5.0.0.93:
the same counts. GitHub Actions results are listed in `docs/STAGE7_HANDOVER.md`.

| Script | What it checks | Last result |
|---|---|---|
| `owner-smoke.cjs` | Owner sign-in, shop details, services, orders, customer address | 39 of 39, exit 0 |
| `licence-smoke.cjs` | Owner licence screen (Stage 7E): each state, refresh, offline, shop switch, sign-out, staff view, and the Android owner bundle (licence view off) | 33 of 33, exit 0 |
| `features-smoke.cjs` | Yes/no features, payment QR upload and removal, customer page features and gating | 23 of 24, exit 1 (one open check, below) |
| `qr-smoke.cjs` | Shop QR code on screen and as a PNG download, decoded with OpenCV | 12 of 12, exit 0 |
| `stats-smoke.cjs` | Statistics page: periods, weekly report, actions, CSV export | All checks passed, exit 0 |
| `decode-qr.py` | Helper used by `qr-smoke.cjs`: decodes a QR image with OpenCV | n/a |

**Open check.** `features-smoke.cjs` checks that the greyed-out Colour and Double-sided cards say
why they are unavailable. The product shows no reason text on those cards yet, and the wording is
an owner decision. The check is kept, not weakened, so the script exits 1 until that decision is made.

On commit `a94cba2` the same script showed 22 of 24 in GitHub Actions (run 43605116936). A second check
also failed there: the customer page had 3px of horizontal scroll at 390 px, from the upload input in
the dropzone. That is fixed in `d3889e5`, where the input is capped to its box. On `d3889e5` (run
43609029853) the script shows 23 of 24, and the only failure is the wording check above. See
`docs/STAGE7_HANDOVER.md`, section 5.

## Environment variables

| Variable | Used by | Meaning | Default |
|---|---|---|---|
| `PLAYWRIGHT_MODULE` | all five scripts | Module name or path to load Playwright from | `playwright` |
| `CHROMIUM_PATH` | all five scripts | Chromium executable to launch | Playwright's own Chromium |
| `QRQUICK_SMOKE_OUT` | owner, QR, features, stats | Folder for screenshots and PNG files | `qrquick-smoke` in the system temp folder |
| `QRQUICK_WEB_DIR` | QR | Folder that holds `config.js` | the `web` folder above `tests/` |
| `QR_SCREEN_DPR` | QR | Device pixel ratio for the on-screen QR capture | `2` |

## Before running

1. **Playwright.** Install it with `npm install playwright` in any folder. If
   `require('playwright')` does not resolve from `web/tests/browser`, set `PLAYWRIGHT_MODULE` to the
   module's path.
2. **Chromium.** Run `npx playwright install chromium` once, or set `CHROMIUM_PATH` to a Chromium
   you already have.
3. **QR helper.** `qr-smoke.cjs` runs `decode-qr.py` with Python 3 and needs OpenCV:
   `pip install opencv-python`.
4. **Output folder.** Set `QRQUICK_SMOKE_OUT` to a folder on your computer if you want to keep the
   screenshots and PNG files.
5. **Port 5174.** If you run the admin panel (`admin/`), its `start` script also uses port 5174.
   Stop it before you run `licence-smoke.cjs`.

The payment QR upload in `features-smoke.cjs` uses a small image built into the script, so the
scripts can run in any order.

## Running with one command (same as CI)

```bash
cd web
tests/browser/run_smokes.sh owner-smoke.cjs qr-smoke.cjs stats-smoke.cjs licence-smoke.cjs
tests/browser/run_smokes.sh features-smoke.cjs     # expected to exit 1 until the open check is decided
```

The script starts the servers on ports 5173 and 5174, runs each script, and stops the servers.
Set `PLAYWRIGHT_MODULE` if Playwright is not on the default module path.

## Running by hand

```bash
cd web
npm start                                   # serves http://127.0.0.1:5173 (keep it running)
# in a second terminal:
node tests/browser/owner-smoke.cjs
node tests/browser/qr-smoke.cjs
node tests/browser/features-smoke.cjs
node tests/browser/stats-smoke.cjs
```

The licence screen uses its own server on port 5174:

```bash
cd web
python3 -m http.server 5174 --bind 127.0.0.1   # keep it running
# in a second terminal:
node tests/browser/licence-smoke.cjs
```

Each script prints PASS or FAIL for every check and a summary at the end.
