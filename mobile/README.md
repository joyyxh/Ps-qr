# QRquick Android app

The shop-owner app for Android. It is the QRquick web app in an Android
wrapper (Capacitor), so the same screens, database and rules are used. A
shopkeeper signs in, sees their shop, shows the shop's QR code, uploads the
payment QR, sets the yes/no features, manages orders and views the read-only licence status.

## Get the APK (no Android tools needed)

1. Push this repository to GitHub.
2. Set the repository variable `PRINTNEST_PUBLIC_URL` to the https address
   where the web app is published (for example `https://printnest.example/`).
   Settings > Secrets and variables > Actions > Variables.
   Without it, the app still builds, but the QR codes it makes point at the
   app, and the owner sees a warning until the address is set.
3. Run the **Android APK** workflow (Actions tab, or push a change to `web/` or `mobile/`).
   The run installs the APK on an Android emulator and launches it. Its
   **APK emulator** check run shows the install result, the process id and the
   APK's SHA-256.
4. Open the finished run and download **qrquick-debug-apk**. GitHub always
   wraps a download in a `.zip` file. Unzip it and install the file inside,
   `app-debug.apk`. Installing the `.zip` itself does not work.

The Android app is the owner-only shell: shop owners sign in and manage their
shop. Staff use the web app. The read-only licence screen is shown only to the
shop owner.

## Install on a phone

1. Unzip the download and copy `app-debug.apk` to the phone.
2. Allow installs from this source when Android asks.
3. Open `app-debug.apk` and tap Install.
4. If Android says the app conflicts with an installed copy, uninstall the
   old QRquick app first. This removes its local data, so sign in again
   afterwards. See "Signing" below for how to avoid this.

This is a debug build. It is fine for testing and for a small number of shops.
A release build for the Play Store needs a signing key, which is not set up here.

## Signing (owner decision)

GitHub's build machines create a new debug signing key for each run, unless
the repository has the secret `ANDROID_DEBUG_KEYSTORE_BASE64`. Without it, a
newer APK cannot update an installed copy from another run, so the old app
must be uninstalled first. With it, each build is signed with the same key
and updates install over the old version.

To set it up (run once on a computer with Java installed):

```
keytool -genkeypair -v -keystore debug.keystore -storepass android -keypass android \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"
base64 -w0 debug.keystore > debug.keystore.base64
```

Copy the contents of `debug.keystore.base64` into the repository secret
`ANDROID_DEBUG_KEYSTORE_BASE64` (Settings > Secrets and variables > Actions),
then delete both local files. Anyone with this file can sign apps as QRquick,
so keep it private.

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

- **Downloads inside the app.** The "Download QR as PNG" button and CSV
  exports still use browser download links. Verify these on the target phone;
  if Android WebView does not save them, use the installable web app (below)
  until native file-save support is added.
- **Not tested on a phone yet.** Each build is installed and launched on an
  Android emulator (API 35) in GitHub's cloud. The screens were checked in a
  desktop browser at phone width. Neither check replaces a test on a real phone.
- Capacitor dependencies are pinned by `package-lock.json` and installed with `npm ci` in CI.
- **App icon.** The QRquick launcher icon (square, round and adaptive) is generated from
  `web/icons/qrquick-mark.png` by `mobile/scripts/make-launcher-icons.sh` and copied into the
  Android project by the APK workflow. Recent apps use the same icon. Not yet checked on a
  real phone's launcher.
- **Sign-in e-mails.** Verification codes come from Supabase Auth. Delivery to a real inbox has
  not been tested, and the hosted Supabase settings need an owner check. See
  `docs/OWNER_EMAIL_VERIFICATION.md`.

## What the emulator check covers

Each APK build is installed on an API 35 emulator and the screens are read with
`uiautomator` (`.github/scripts/apk-ui-check.sh`). The check verifies that:

- the app opens on the protected sign-in screen, with no owner tabs before sign-in;
- the QRquick name is on that screen;
- the "Create an account" link opens the registration screen, and Back returns to sign-in;
- the app is labelled QRquick on the launcher (best effort; a warning if the icon is not on the home screen);
- reopening the app lands on the sign-in screen, and the process is still running.

It does not sign in, because CI has no owner account. Screenshots are in the
`qrquick-ui-check` artifact of the run. The APK badging check also confirms the
`QRquick` application label and the adaptive launcher icon in the APK.

**Status: the screen checks are not passing yet.** On the GitHub-hosted x86_64 emulator the
app's WebView crashed natively, about two minutes after launch, with the default, ANGLE and
software-compositing settings. Build, signature, label and icon checks, installation and launch
do pass. The screen checks need a working emulator or a physical phone before they count as a
test result.

## Alternative: install the web app (no APK)

Android Chrome can install the web app from the published https address:
open the site, then the menu (three dots) > **Install app** (or **Add to Home
screen**). It opens full screen, and downloads work there. This needs no
APK at all and is the easiest route while the APK is being tested.
