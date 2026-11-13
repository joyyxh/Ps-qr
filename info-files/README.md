# Info (data) files, QRquick records and logs (2026-11-13)

Status: NOT SUBMITTED TO ANY INDEPENDENT AUDIT. No audit result exists. Nothing here is an approval or a release decision. Local evidence only; local tests do not prove hosted behaviour, staging or physical printing.

## What is here
Text records and logs from the QRquick working folders: decision records, checklists, readiness and gate notes, publication and smoke logs, test outputs, diffs and SQL. Paths mirror the working folder structure.

## What was left out
- Code trees, Python environments, node_modules, binaries, images and APK builds.
- Files that contain API keys, publishable keys or project endpoints (27 files).
- Files that contain personal contact data: non-placeholder email addresses (42 files) and phone numbers (4 files).
- Placeholder addresses (example.com, example.test, b.test) and the Claude commit identity were not treated as personal data.

## Limits
Names and free-text personal details were not scanned. The scan was pattern-based, not a full review. Treat it as a first filter.

## Verify
`sha256sum -c MANIFEST.sha256` in this folder.
