# Main checkout uncommitted paper-size refusal: origin (2026-11-13, read-only)

Location: `/home/claude/joyyxh/ps-qr` (branch `main`, HEAD `37e4623`). 3 files: `agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs`. Stat: 62 insertions, 4 deletions. Full diff: `MAIN_CHECKOUT_UNCOMMITTED_agent_paper_refusal.diff` (126 lines, sha256 in MANIFEST). Left unchanged. Not committed, stashed, copied into any unit or discarded.

## What the change does
In `checkSettings`, when the adapter reports no paper list, a non-A4 paper choice is refused with `unsupported_setting` and the message "QRquick cannot choose ... paper ... Ask the shop to print this order on A4 paper." The previous code allowed any paper when no list was known. Prior behaviour is kept for A4.

## Origin search results
- `git log --all -S 'cannot choose'` on `agent/`: no commit.
- `git log --all -S 'knownPapers'` on `agent/`: no commit.
- `git grep 'cannot choose' 37e4623 -- agent/src/worker.mjs`: no match. The committed worker has blob `b6899ed`, the same base as stage7.
- Stash `b559dce` (the only stash entry): no `cannot choose` or `knownPapers` text.
- `origin/*` and every local branch: the text does not appear in any commit.
- The `unsupported_setting` matches are the pre-existing double-sided refusal (introduced in `322dc24`). They are not this change.
- Reflog: `main_reflog.txt` in this folder. It shows no commit that introduced the text.

Conclusion: the change exists only as uncommitted work in the main checkout. Git history does not identify its author, session or date. Owner or the session that wrote it must confirm the origin. Nothing here approves it, and it is not part of any unit.

## Compatibility with P5
P5 applies to a copy of this checkout's working files (hunk offset 20, exit 0), so the two do not conflict at the patch level. They were not tested together, and no record says the paper refusal is approved.
