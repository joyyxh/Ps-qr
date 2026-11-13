# QRquick release readiness, 2026-11-13

Four levels are kept apart. "Local" means tests run on this machine with mocked or throwaway databases. "Staging" means a staging project. "Production" means deployed. "Physical" means verified with a real printer. Only local evidence exists today.

Status key: DONE (local evidence only), PARTIAL, GATED (waiting on an owner decision or approval), NOT STARTED.

| Area | Local | Staging | Production | Physical | Status | Evidence / gap |
|---|---|---|---|---|---|---|
| Customer web: upload, order, status | Yes (mocked Supabase) | No | No | n/a | PARTIAL | web `npm test` 212 pass. Smokes: qr-smoke 12/12, stats-smoke all pass. features-smoke 23 of 24: the greyed-out wording check is open (gate row 22, owner decision). |
| Owner web: approve, payment record, statistics | Yes (mocked) | No | No | n/a | PARTIAL | owner-smoke 39/39 with U6. Hosted not verified. |
| Owner licence screen (7E) | Yes (mocked) | No | No | n/a | DONE locally | licence-smoke 33/33 with U6 (`publication_v6_2026-11-12/logs/licence_smoke_u6_2026-11-12.log`). Hosted RPC `shop_licence_status` not run. |
| Owner Android APK | No | No | No | n/a | GATED | Deferred by owner decision 1 (2026-11-09). APK not built or run. Rebuild needs approval. |
| Database: 0001 to 0010 (origin) | Yes (scratch) | No | Not verified | n/a | DONE locally | Scratch apply with platform shims, 18 of 18 steps for the combined order. Not applied to any hosted project. |
| Chain A 0011 to 0014 (local main) | Yes (scratch) | No | No | n/a | GATED | Unpushed on local `main` (`37e4623`). Combination needs D-MIG and EX-15. |
| Licence foundation and RPCs 0011 to 0013 | Yes (EX-01 run 2 on PG 16.15) | No | No | n/a | PARTIAL | rpc_tests 282/282, read_api_tests 125/125, hash vectors 0 FAIL. Files are untracked and unapplied. D-MIG NOT APPROVED. |
| Grants, security, search_path | Inventory only | No | No | n/a | PARTIAL | EX-01 inventory: 13 SECURITY DEFINER, 23 INVOKER, search_path set on all 36. Hosted grants (item 2.9) not verified. |
| Hosted AAL2 verification | No | No | No | n/a | GATED | Item 2.7, needs EX-02 and hosted approval. |
| Licence enforcement | No | No | No | n/a | GATED | Enforcement OFF. C-3 held back (2026-11-09). |
| Refusal at mark time (7F) | No | No | No | n/a | GATED | D-Q4 open (owner working default A; §13D recommends B). |
| Kill switch (7F) | No | No | No | n/a | GATED | D-I32 pending. |
| Held-file release (M1) | No | No | No | n/a | GATED | C-1 lawyer answer. |
| Print agent: explicit start confirmation | Yes (62/62 agent tests) | No | No | No | DONE locally | P5 (`audit_handover/units/P5_7F_agent_fail_closed.patch`). Fake-harness test; not a printer run. |
| Print agent: real printer and accurate print state | No | No | No | No | NOT VERIFIED | Simulated-printer branch is unmerged and untested on hardware. Physical printing gate not run. |
| Admin dashboard | Yes (72/72 unit, 65/65 browser smoke on localhost stub) | No | No | n/a | PARTIAL | Bundle checksums 14/14, checker negative tests pass. Hosting (RB-02), admin identity and MFA (RB-01 / C-6) undecided. |
| Admin hosting and deploy | No | No | No | n/a | GATED | RB-02. Nothing deployed. |
| Staging tests S1 to S9, two-session tests (RB-12) | No | No | No | n/a | GATED | EX-02 not granted. |
| Monitoring, alerts, backup and recovery | No | No | No | n/a | NOT STARTED | No monitoring target chosen. Hosted backup responsibility not recorded. Needs the hosting decision first. |
| Cleanup workflow | No | No | No | n/a | GATED | 22 scheduled runs failed (2026-10-21 to 2026-11-11). Owner choice A, B or C. Nothing changed on GitHub. |
| CI | Node 22 only (agent 61, web 212, admin 72, SQL parse) | No | No | n/a | PARTIAL | Node 18 leg NOT RUN. v2 workflow not applied. |
| Independent audit (ChatGPT) | n/a | n/a | n/a | n/a | NOT SUBMITTED | Units packaged in `audit_handover_2026-11-13/`. No audit result exists. None may be treated as PASS. |

## Operational documentation

Present: `admin-deploy/DEPLOY.md` (local bundle steps, rollback by re-publishing a previous folder, no hosting target). `PUBLICATION_INDEX.md`. `RELEASE_NOTES_7E.md` (draft).

Missing, and not written here because each depends on decisions or hosted facts not yet available: production monitoring and alert targets, backup and restore procedure for the hosted database, incident and recovery runbook for the print agent, on-call and ownership, data-retention operation (C-1 pending for held files).

## Inconsistencies found and their status

1. Migration numbers: Chain A and the licence files both use 0011 to 0013 on different lines. Open under D-MIG.
2. Item 19 is used for two different items in the records (CF-4). Owner to confirm.
3. `STAGE7_DECISIONS.md` §12B says "No test was run" for S-5. That text is stale because a local agent test now exists. The correction belongs in the owner's record.
4. `CLAUDE.md` known drift: the README stage table on main still says Stage 6 is "Not started". Fix only with approval.
5. Greyed-out wording: the features smoke expects text that no record approves. Owner decision.

## Not verified by anything in this document

Hosted behaviour of any function, RLS on a hosted project, deployment of the print-agent function, real printer output, print-state accuracy on hardware, mobile app behaviour on a device.
