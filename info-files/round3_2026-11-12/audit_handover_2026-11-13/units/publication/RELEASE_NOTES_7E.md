# Stage 7E release notes: shop licence status view (DRAFT, NOT RELEASED)

Status: draft for owner review. Not released, not deployed, not merged. Stage 7E depends on the hosted RPC (`shop_licence_status`), which has not been run against a hosted project.

## What the view does

The owner of a print shop sees the shop's licence state on the web app. It is read-only. It shows the state, the access end date, the next start date when one is scheduled, a "Check again" button, and the time of the last check. Staff see the staff-only message (P7).

It does not block printing or orders. No enforcement exists in this release. Enforcement is Stage 7F, which is not built.

## Labels and wording (approved 2026-11-09, STAGE7_DECISIONS §13B)

- P1: The "Printing permitted (backend status)" line is removed. It appears only after 7F enforcement exists.
- P2: Scheduled and ordinary inactive states share one "Not active" badge. The next start is on its own line.
- P3: "Check again" is kept.
- P4: "Lifetime access. No expiry." is kept.
- P5: "Status unavailable" and its eight reason texts are kept.
- P6: "Checking…", "Refresh", "Last checked …" and "Last attempt …" are kept.
- P7: The staff-only message is kept.
- P8: Admin-grant details stay hidden. No "Admin grant" label is shown.
- P9: The label reference is item 13 / decision 19.

Expiry wording (OD2, approved 2026-11-09): "Access until 1 Jan 2028, 00:00 IST." The end is exclusive.

## What changed in the web code

- `web/` licence view and its tests (7E, P4 v5, uncommitted).
- `web/styles.css`: two layout rules from U6 (phone width, no horizontal scroll on the customer order page).
- Browser smoke scripts in `web/tests/browser/` corrected to match the product code (U6), and `README.md` rewritten (P4 v5).

## Tests (local)

- web `npm test`: 212 pass, 0 fail (chain and combined tree).
- Owner smoke: 39 of 39 pass with U6.
- QR smoke: 12 of 12 pass with U6.
- Stats smoke: all checks pass with U6.
- Features smoke: 23 of 24. One check is open: "the greyed-out boxes say why". The product shows no reason text on a greyed-out Colour or Double-sided card, and no approved wording exists. The check is kept, not weakened. The records approve no wording for these cards (searched 2026-11-12), and the existing app strings are not approved for them.
- Licence smoke (7E) with U6 applied: 33 of 33 checks pass, exit 0, Supabase mocked (`logs/licence_smoke_u6_2026-11-12.log`).
- The fixture `web/tests/fixtures/licence-status-rpc.json` was re-captured on 2026-11-12 from the local database. All 10 cases match, so the file is unchanged. The fixture is a local capture, not a hosted run.

## Not verified

- The hosted RPC `shop_licence_status` and its behaviour against a real project.
- Real phones and tablets.
- Staging (EX-02) and checks S1 to S9.
- Stage 7F enforcement (not built).
- Android: deferred by owner decision 1 (2026-11-09).

## Known open items

- The greyed-out wording (owner decision).
- The fixed bottom navigation can cover the lower edge of the QR box on a phone when scrolled to the end (U6 open item 2, observation; owner decision if spacing should change).
- D-MIG: if renumbering is approved, the licence migration names change and P2, P3 and P4 are regenerated.
- CF-4: item 19 is used for two different items in the records. Owner to confirm.

## Blocked by

- RB-02 (hosting), RB-01 (admin identity and MFA, for the admin side), EX-02 (staging), EX-15 (merge order and PR to `main`), D-MIG, C-1 (legal review of licence checkout).
