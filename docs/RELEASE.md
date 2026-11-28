# Release guide: Android, Windows and Linux (QRquick)

This file says which builds are for distribution, which are test-only, what secrets the release
needs, and the order to run things in. It contains no key values. Never paste a keystore, a
certificate, a password or a base64 key into chat, an issue, a commit, a log or a screenshot.

> **Current state (2026-11-25): no distributable build exists yet.** Production has no username
> sign-in (see `docs/AUTH_REDESIGN.md`, section 7), so every Android and desktop build is a
> staging TEST build, and the workflows **refuse** `release=true` and the APK prerelease. The
> `Distribute it? Yes` rows below describe the intended end state only. Do not set
> `QRQUICK_ALLOW_PRODUCTION_BUILD=1` until production has the migrations and the `owner-auth`
> function and the owner has approved the production plan (`docs/PRODUCTION_APPROVAL.md`).
> Signing credentials are supplied by the owner (the six secrets below). Acceptance on real
> phones and printers is `docs/PHYSICAL_ACCEPTANCE.md`.

## Which builds are for distribution

| Build | How to start it | Signed with | Name in the run | Distribute it? |
|---|---|---|---|---|
| Android debug APK | push to `stage7-implementation-2026-11-13` | a debug key the runner creates | `qrquick-debug-apk` | **No.** Test only. The key changes every run. |
| Android test-signed APK | `android-apk.yml`, `test_signing=true` | a throwaway key made in the run (`CN=QRquick TEST ONLY`, 7 days) | `TEST-ONLY-qrquick-signing-test-apk-<sha>` | **No.** Tests the signing steps only. |
| Android release APK | `android-apk.yml`, `release=true` | the QRquick release key from the repository secrets | `qrquick-release-apk-<version>-<sha>` | **Yes**, after the owner checks it. |
| Desktop TEST (unsigned) | push, or `desktop-owner-app.yml` with no inputs | nothing | `...-TEST` | **No.** |
| Desktop test-signed | `desktop-owner-app.yml`, `test_signing=true` | a throwaway self-signed Windows certificate (`CN=QRquick TEST ONLY`) | `...-TEST` | **No.** Windows does not trust it. |
| Desktop RELEASE | `desktop-owner-app.yml`, `release=true` | Windows: the QRquick code-signing certificate. Linux AppImage: not signed, check with `SHA256SUMS`. | `...-RELEASE` | **Yes**, after the owner checks it. |

Each desktop run also uploads `BUILD-INFO-<platform>.txt` and `SHA256SUMS-<platform>.txt`. The
build information says `Distribution: RELEASE` or `TEST`, and states how the Windows files are
signed. Check that line before a file leaves the team.

`apk-release.yml` publishes a **public prerelease** from the debug artifact when
`.github/apk-release-request.txt` changes. It publishes the debug build, which is not for
distribution. Do not use it for release files. Whether to disable it is the owner's decision.

## GitHub secrets (repository → Settings → Secrets and variables → Actions)

| Secret | Used by | What it is |
|---|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Android release | The PKCS12 keystore file, base64-encoded |
| `ANDROID_RELEASE_KEYSTORE_PASSWORD` | Android release | The keystore password |
| `ANDROID_RELEASE_KEY_ALIAS` | Android release | The key alias inside the keystore |
| `ANDROID_RELEASE_KEY_PASSWORD` | Android release | The key password |
| `WIN_CSC_BASE64` | Windows release | The Windows code-signing certificate as a `.pfx` file, base64-encoded |
| `WIN_CSC_KEY_PASSWORD` | Windows release | The password of that `.pfx` |

A release run stops with a clear error when a secret is missing. It never falls back to a debug
or test key.

## Android release keystore (the owner creates it once)

Run these on the owner's own computer, not in chat:

```
keytool -genkeypair -v -storetype PKCS12 -keystore qrquick-release.p12 -alias qrquick \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -dname "CN=QRquick, O=<organisation name>, C=<two-letter country code>"
```

`keytool` asks for the store password and the key password. Use a long random password and store it
in a password manager.

Encode the file for GitHub (pick the command for your system):

```
# macOS / Linux
base64 -w0 qrquick-release.p12 > qrquick-release.p12.b64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("qrquick-release.p12")) | Set-Content qrquick-release.p12.b64
```

Set the secrets with the GitHub CLI. The values are read from files or prompts, not typed in the chat:

```
gh secret set ANDROID_RELEASE_KEYSTORE_BASE64 < qrquick-release.p12.b64
gh secret set ANDROID_RELEASE_KEYSTORE_PASSWORD
gh secret set ANDROID_RELEASE_KEY_ALIAS --body qrquick
gh secret set ANDROID_RELEASE_KEY_PASSWORD
```

Then delete `qrquick-release.p12.b64`. Keep `qrquick-release.p12` and its passwords in a secure
backup, not in the repository.

**Warning:** if the keystore is lost, phones that have QRquick cannot receive updates signed with a
new key. A new keystore means the app has to be installed again from scratch.

## Windows code-signing certificate (the owner buys it)

- Buy an OV or EV code-signing certificate from a certificate authority. EV certificates usually
  build Windows SmartScreen reputation faster. The same rule applies to both: a new certificate
  can still show a warning for a while.
- Many certificate authorities now keep the private key on a hardware token or in a cloud signing
  service, and do not allow export as a `.pfx`. If the certificate cannot be exported as a `.pfx`,
  the workflow's signing step needs a different design. Ask before buying.
- Export the certificate with its private key as a `.pfx`, then encode it the same way as the
  keystore and set the two secrets:

```
gh secret set WIN_CSC_BASE64 < qrquick-codesign.pfx.b64
gh secret set WIN_CSC_KEY_PASSWORD
```

- After the first release run, open the installer's signature details and check that it has a
  **timestamp**. Without a timestamp the signature stops being valid when the certificate expires.

## Run order

Run the test builds first, then the release builds. All commands run from the repository, on the
release branch.

```
# Android: test signing (no secrets needed), then the release build
gh workflow run android-apk.yml --ref stage7-implementation-2026-11-13 -f test_signing=true
gh workflow run android-apk.yml --ref stage7-implementation-2026-11-13 -f release=true

# Desktop: unsigned TEST, test signing, then RELEASE
gh workflow run desktop-owner-app.yml --ref stage7-implementation-2026-11-13
gh workflow run desktop-owner-app.yml --ref stage7-implementation-2026-11-13 -f test_signing=true
gh workflow run desktop-owner-app.yml --ref stage7-implementation-2026-11-13 -f release=true
```

Then check each run with `gh run view <run-id> --log-failed` (or the run page). A release run must
show these results:

- Android release: the signing summary names the release key, not `CN=Android Debug`, and does not
  contain `TEST ONLY`. The bundled `config.js` points at the production Supabase project.
- Android test-signed: the summary says `TEST ONLY`, and the artifact name starts with
  `TEST-ONLY-`.
- Desktop RELEASE: the Windows check reports `Valid` for the installer and the installed app, and
  `BUILD-INFO` says `Distribution: RELEASE`.

## Website publish order

The public site is published from the `main` branch by `pages.yml`, or by a manual run of that
workflow. **Do not publish the website before the database catch-up is approved, applied and
verified.** The app code expects the newer schema, so publishing first can break sign-in and
shop functions.

1. The owner approves the catch-up migrations (0010, 0018, 0019, 0020), after the preflight and
   backup checks are repeated on the day.
2. The migrations are applied in order, and the preflight shows the expected state.
3. The owner approves merging the release commit into `main`, and the website is published.
4. The owner tests sign-in with a non-team email address (see `OWNER_EMAIL_VERIFICATION.md`).

Pull request #3 is not part of this release and is not merged by it.

## Checks before a file goes to customers

- Compare the file with `SHA256SUMS-<platform>.txt` after download.
- Confirm `BUILD-INFO` names the same commit and version as the run.
- Install the file on a clean machine or phone, sign in with a test owner account, and confirm the
  core functions. The automated tests do not sign in or test owner functions.

## Known limits (not fixed by this change)

- The Windows release is signed only when the secrets are set. Linux AppImages are not signed.
- The Android test-signed APK is not stable across runs, and it cannot be used for updates.
- Desktop packages are built on Electron 33. Check the Electron security advisories before each
  release.
- The desktop smoke test starts the app and checks the shell. It does not sign in, and it does not
  test shop, order or payment functions on a real account.
- Artifacts expire after 30 days (packages) and 14 days (smoke results). Download and store the
  release files before they expire.

## Windows installer (status: NOT release-ready)

Full investigation, measurements and recommendation: `WINDOWS_INSTALLER.md`. Summary: the NSIS 3.0.4.1 setup crashed on its first
run on 20 of 48 fresh CI runners; NSIS 3.11 on 0 of 24; the MSI on 0 of 48. **Recommended release installer: a signed MSI.**
The desktop workflow builds both the NSIS setup and the MSI. Every build installs the MSI silently, smoke-tests the installed app and
uninstalls it. The NSIS test keeps the signature-specific retry (exit `-1073741819`, `System.dll`, offset `0x1581`) as a temporary
mitigation only; it must not be used to call the NSIS setup release-ready.

Test builds and distributable builds:
| | Test build | Distributable build |
|---|---|---|
| Windows | unsigned or self-signed (`CN=QRquick TEST ONLY`), staging backend, label `TEST` | signed with the QRquick certificate, label `RELEASE`, workflow `release=true` |
| Android | debug or test-signed APK, staging backend | APK/AAB signed with the owner's upload key, `RELEASE` |

Windows is release-ready only after `PHYSICAL_ACCEPTANCE.md` section F passes on a physical Windows 11 PC with the signed MSI.
