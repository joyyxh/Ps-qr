# Windows installer: investigation, options and recommendation

Status: **Windows is NOT release-ready.** It becomes release-ready only after the Windows 11 acceptance test
(`PHYSICAL_ACCEPTANCE.md`, section F) passes on a physical PC with the signed release build.

## The fault
The NSIS installer built by electron-builder 25.1.8 (NSIS 3.0.4.1, built 2018) exits with `-1073741819` (access violation,
0xC0000005) on its first run on some fresh Windows Server 2025 runners. The Application Error event names `System.dll`
(the NSIS `System` plug-in) at offset `0x1581`. Defender was off and logged nothing. A later run of the same file
succeeds. I could not find the trigger inside NSIS or the runner image. I have not tried to read NSIS source or
debug the crash dump, so there is no code-level root cause yet; the tests below locate the fault in the old NSIS stub,
not in QRquick.

## Measured (workflow `windows-installer-options.yml`, one fresh runner per sample, first silent install)
| Variant | Runs on commit 77f5430 and later | First install crashed |
|---|---|---|
| NSIS 3.0.4.1 (what electron-builder ships) | 48 | **20 (42%)** |
| NSIS 3.11 swapped in | 24 | 0 |
| MSI (electron-builder, WiX) | 48 | 0 |

Runs: 46001816330, 46002549823, 46119376435, 46119942558, 46120492202, 46120498559 (the NSIS 3.11 variant failed to build in
the first three for reasons of my own test script, so it only has the last three). Statistical note: 0 of 24 against a 42%
rate is very unlikely by chance, but it is CI evidence on one Windows image, not proof on customer PCs.

## Options
| Option | For | Against |
|---|---|---|
| **A. Keep NSIS 3.0.4.1 + signature-specific retry** | Already works in CI | Retries hide a real crash. A customer installing by double-click gets the crash and no retry. **Mitigation only, not for release.** |
| **B. NSIS 3.11 (`nsis.customNsisBinary`, pinned URL + checksum)** | Same wizard as today (choose folder). 0 of 24 crashes | electron-builder 25.1.8 does not officially support it. Needs `warningsAsErrors=false` because 3.11 reports missing translations for languages we do not ship. We would carry a third-party binary and its supply chain. Still a custom installer stub. Needs the full lifecycle (install, launch, upgrade, uninstall) test |
| **C. MSI (Windows Installer)** | Runs on the operating system's own installer engine, no custom stub. 0 of 48. Standard for IT and Group Policy. Installed, launched (smoke test) and uninstalled in the repeated runs | One-click, per-user install only (no folder choice). Not supported by `electron-updater` (we do not use auto-update today). Needs the WiX download in CI |
| **D. Code signing** | Needed regardless: removes the "unknown publisher" warning and builds SmartScreen reputation | Does **not** fix the crash. It is an access violation, not a trust block |

## Recommendation
**Ship a signed MSI as the primary Windows installer (C + D).** It removes the third-party installer code from the
failure path, it has the best measured record, and its trade-offs (no folder choice, no auto-update) do not matter for
this product today. Treat NSIS 3.11 (B) as an optional second download only after it passes the same lifecycle tests.
Retire NSIS 3.0.4.1 for releases. Keep the retry in CI only so the NSIS test build stays green while it exists.

The desktop workflow now builds the MSI beside the NSIS setup and, for every build, installs it silently, runs the
packaged-app smoke test against the installed copy and uninstalls it.

## What still needs a person
1. A Windows code-signing certificate (owner buys it; see `RELEASE.md`). Prefer one that works with `signtool` for MSI.
2. The Windows 11 physical acceptance test with the **signed** MSI.
3. Decide whether the NSIS setup is shipped at all (recommended: no).
