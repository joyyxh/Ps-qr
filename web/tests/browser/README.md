# Browser checks (headless Chromium, mocked backend)

These scripts were run by hand against the web app at phone width (390 px).
They are not part of `npm test`. Each one replaces Supabase with an in-memory
mock using Playwright's `page.route`, so they check the screens and requests,
not the live backend.

| Script | What it checks | Last result |
|---|---|---|
| `owner-smoke.cjs` | Owner sign-in, shop details, services, orders, customer address | 39 of 39 |
| `features-smoke.cjs` | Yes/no features, payment QR upload and removal, customer page features and gating | 24 of 24 |
| `qr-smoke.cjs` | Shop QR code on screen and as a PNG download, decoded with OpenCV | 16 of 16 |
| `stats-smoke.cjs` | Statistics page: periods, weekly report, actions, CSV export | 26 of 26 |
| `decode-qr.py` | Helper used by `qr-smoke.cjs`: decodes a QR image with OpenCV | n/a |

## Before running on your computer

The scripts were written in a sandbox, so three things must change:

1. **Playwright path.** Each script does
   `require('/home/claude/.npm-global/lib/node_modules/playwright')`.
   Replace it with `require('playwright')` after `npm install -D playwright`.
2. **Chromium path.** Each script launches `executablePath: '/opt/pw-browsers/chromium'`.
   Remove that line to use Playwright's own browser (`npx playwright install chromium`),
   or point it at your Chromium.
3. **Output folder.** `features-smoke.cjs` and `qr-smoke.cjs` save screenshots and PNGs to
   a `DIR` constant under `/tmp/...`. Change it to a folder on your computer.
4. **Project folder.** `qr-smoke.cjs` reads `config.js` from a `WEB` constant set to
   `/home/claude/printnest/web`. Change it to your `web` folder.

`features-smoke.cjs` uses a PNG that `qr-smoke.cjs` writes to `DIR`, so run
`qr-smoke.cjs` first.

`decode-qr.py` needs OpenCV: `pip install opencv-python`.

## Running

```bash
cd web
npm start                                # serves http://127.0.0.1:5173 (keep it running)
# in a second terminal:
node tests/browser/owner-smoke.cjs
node tests/browser/qr-smoke.cjs          # needs decode-qr.py and OpenCV; writes the PNG used next
node tests/browser/features-smoke.cjs
node tests/browser/stats-smoke.cjs
```

