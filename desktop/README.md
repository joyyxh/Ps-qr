# QRquick owner desktop app (Windows and Linux)

This folder is the desktop shell for the owner app. It is an Electron window around the **same** `web/` source
that the website and the Android app are built from. `scripts/copy-web.mjs` copies `web/` into `app-web/` with
the production configuration (the production Supabase project, the publishable key, the QR address
`https://joyyxh.github.io/Ps-qr/` and `ownerApp: true`). The app is packed with that copy. No UI is forked.

`agent/` is a different program: the **print agent**, a command-line helper for the shop computer that prints
approved, paid orders. It is not part of this app and is not changed by it.

## Build

Built by `.github/workflows/desktop-owner-app.yml` on Windows x64 and Linux x64. Local build on Linux or
Windows, with Node.js 22:

    cd desktop
    npm install
    BUILD_SHA=local npx electron-builder --linux --x64 --publish never   # or --win --x64

Outputs go to `desktop/dist/`. The packages are unsigned: no code-signing certificate is configured.
Windows may show a SmartScreen warning on first run.

## Install

- **Windows:** run `QRquick-<version>-<sha>-win-x64-setup.exe`. It installs for the current user, without
  administrator rights, into `%LOCALAPPDATA%\Programs\QRquick`.
- **Linux:** make `QRquick-<version>-<sha>-linux-x64.AppImage` executable (`chmod +x`) and run it.

Sign in with a shop owner account, as on the website.

## What is and is not in the app

- Contains: the web app's pages, the publishable key, and the production project address. Nothing else.
- Does not contain: the service-role key, any secret key, the staging project, or any printer code.
- Automatic updates are not built in. A new version is installed by running the new installer.

## Tests

`tests/smoke.cjs` starts the built app with Playwright's Electron support (`playwright@1.63.0`, installed
outside the repository in CI). It checks the sign-in screen, the production configuration, that the app is still
running after 20 seconds, and that no page errors occur. The `staging-probe` mode uses a test-only copy of the app
that points at the staging project (`test-web/`, never packed), and submits one wrong password for a made-up
address to confirm the readable message.

Not covered by these tests: the owner dashboard, QR codes, orders, printing and auto-print. Those are covered by
the website and Android checks and by the staging smoke tests, and must be checked on the desktop app separately.
