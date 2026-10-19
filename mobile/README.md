# QRquick Android app

The shop-owner app for Android. It is the QRquick web app in an Android
wrapper (Capacitor), so the same screens, database and rules are used. A
shopkeeper signs in, sees their shop, shows the shop's QR code, uploads the
payment QR, sets the yes/no features and manages orders.

## Get the APK (no Android tools needed)

1. Push this repository to GitHub.
2. Set the repository variable `PRINTNEST_PUBLIC_URL` to the https address
   where the web app is published (for example `https://printnest.example/`).
   Settings > Secrets and variables > Actions > Variables.
   Without it, the app still builds, but the QR codes it makes point at the
   app, and the owner sees a warning until the address is set.
3. Run the **Android APK** workflow (Actions tab, or push a change to `web/` or `mobile/`).
4. Open the finished run and download **qrquick-debug-apk** (`app-debug.apk`).

## Install on a phone

1. Copy `app-debug.apk` to the phone (or open the download link there).
2. Allow installs from this source when Android asks.
3. Open the APK and tap Install.

This is a debug build, signed with a debug key. It is fine for testing and for
a small number of shops. A release build for the Play Store needs a signing
key, which is not set up here.

## Build on a computer (optional)

Needs Node 22, JDK 21 and Android Studio (with the Android SDK).

```
cd mobile
npm install
PRINTNEST_PUBLIC_URL=https://printnest.example/ npm run copy-web
npx cap add android      # first time only
npx cap sync android
npx cap open android     # build from Android Studio, or run ./gradlew assembleDebug inside android/
```

`npm run copy-web` copies only the app files from `../web` into `www/`. The
`android/` folder is generated and is not committed.

## Known limits (read before handing this to shops)

- **Downloads inside the app.** The "Download QR as PNG" button and the CSV
  exports use a browser download link. The Android WebView does not save
  those files by itself, so these buttons may do nothing in the APK. Use the
  installable web app (below) for downloads, or ask for a native save plugin.
- **Not tested on a phone yet.** The build runs in GitHub's cloud. The
  screens were checked in a desktop browser at phone width, not on a device.
- **Versions are not pinned to a lock file yet.** `package.json` uses the
  Capacitor 8 line. Commit the generated `package-lock.json` once a build
  works, so later builds use the same versions.
- **App icon.** The APK uses the default Capacitor icon until the icons are
  copied into the Android resources.
- **Sign-in e-mails.** Confirmation links open in the browser, not in the app.

## Alternative: install the web app (no APK)

Android Chrome can install the web app from the published https address:
open the site, then the menu (three dots) > **Install app** (or **Add to Home
screen**). It opens full screen, and downloads work there. This needs no
APK at all and is the easiest route while the APK is being tested.
