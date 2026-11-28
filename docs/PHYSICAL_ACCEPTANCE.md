# Physical device and printer acceptance test

Automated tests, the Android emulator and the desktop smoke tests do not prove that a real phone, a real
printer and a real UPI app work. This is the owner's checklist. Use the **staging TEST build** until
production is approved. Record the date, device, build SHA and result for each line.

| Test level | Covered by |
|---|---|
| Unit and SQL regression | CI (`npm test`, base suites) |
| Staging live | `owner-auth-live.mjs` |
| Emulator | `android-apk.yml` UI check |
| Desktop packaged smoke | `desktop-owner-app.yml` |
| **Physical (this file)** | the owner |

Before starting, check the build: SHA-256 of the file matches `SHA256SUMS`, and the app shows the TEST
BUILD ONLY marker.

## A. Android phone (one low-end and one recent device)
1. Install the APK. Open it. No crash on launch; reopening after closing works.
2. Create an account with a username and password. Accept Terms and Privacy. **Write down the ten recovery codes.**
3. Sign out, sign in. Close the app, reopen: still signed in. Sign out: signed out.
4. Reset the password with one recovery code. The old codes stop working; new codes are shown.
5. Set up a shop, add services and prices, generate the QR code, download and print it.
6. Scan the QR with a second phone: the customer page opens.
7. Rotate the phone and use a small screen: nothing is cut off.

## B. Customer order, UPI and payment
1. As a customer, upload a PDF and a photo, choose options, see the quoted price, place the order.
2. Pay by UPI with a real UPI app (test amount). Confirm the status changes and the owner sees it.
3. Cancel flow and a cash order. Track the order by its tracking code.

## C. Owner dashboard
New order appears and updates; statistics change; file download works; a second shop's data is not visible.

## D. Printer and print agent (Windows and Linux)
1. Install the desktop app and the print agent; pair the agent with the shop.
2. Send a job from a customer order. It prints with the right paper, copies, colour and duplex.
3. Unplug the printer or stop the agent: the job shows an error and can be retried. No duplicate prints.
4. Auto-print on and off.

## E. Pass rule
Every line passes on at least one real printer and two phones. A failure is filed with the device, the step
and a screenshot with no passwords or codes visible.

## F. Windows 11 installer acceptance (physical PC; required before Windows is called release-ready)

Use a physical Windows 11 PC (not a virtual machine, not a CI runner) that has never had QRquick installed. A second run on a
PC that is also joined to a company domain is a bonus. Test the **signed RELEASE MSI**. A TEST build does not count.

Record for each step: pass or fail, the PC model, the Windows build (`winver`), and a screenshot of any failure.

1. Download the MSI from the release page. Compute `Get-FileHash -Algorithm SHA256 <file>` and compare it with `SHA256SUMS`.
2. Right-click the file, Properties, Digital Signatures: the signer is the QRquick publisher and the signature is valid. In PowerShell: `Get-AuthenticodeSignature <file>` shows `Valid`.
3. Double-click the MSI (no command line). Note any SmartScreen or "unknown publisher" prompt and what it says. Install completes without an error dialog.
4. Open Event Viewer, Windows Logs, Application: no `Application Error` entry for `msiexec.exe` at the install time.
5. QRquick appears in the Start menu and in Settings, Apps. Open it. It starts within 10 seconds and shows the sign-in screen.
6. Sign in (staging account for a TEST pass, a real owner for the RELEASE pass), open Orders, create and approve a test order.
7. Reboot. Open QRquick again. Still installed, still works.
8. Reinstall the same MSI over the installed copy: no error, one entry in Apps.
9. Uninstall from Settings, Apps. The folder `%LOCALAPPDATA%\Programs\qrquick-owner-desktop` is gone and the Start menu entry is gone.
10. Repeat steps 3 to 5 on a standard (non-administrator) Windows account.
11. If automatic printing is sold: run the print agent test in section D on this PC.

Pass rule: every step passes on one PC, steps 3 to 5 pass on the standard account too, and nothing in Event Viewer names QRquick or
`msiexec.exe` as faulting. Any crash, even once, fails the test: do not retry and call it a pass. Keep the report with the commit hash and build id.
