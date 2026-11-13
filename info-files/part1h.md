## Part 1H. Owner decisions recorded 2026-11-04

These ten owner decisions, dated 2026-11-04, are recorded in `STAGE7_DECISIONS.md` (§12A.6, §12A.10, §12B.4, §12B.7, §12B.8, §12B.9, §12B.11, §12B.13, §12C, §12D and the record "Owner decision record (2026-11-04)" in §13). They are cited below as "no. 1" to "no. 10". "Previously approved" means the item was approved before 2026-11-04. "New" means it was first decided on 2026-11-04. They approve no gate, no implementation, no migration change or application, no SQL, no staging setup or run, no project creation, no test, no deployment, no secret change, no commit and no push.

| No. | Owner decision (2026-11-04) | Label | Effect and limits |
|---|---|---|---|
| 1 | O4 scope: option A. Reject overlapping grants of the same kind (admin with admin; lifetime with lifetime). A lifetime grant over an admin grant stays allowed. | New. Closes the O4 scope point. | Lifetime-revocation exposure is documented in §12A.6. Staging tests and 7C sign-off still apply. |
| 2 | O9 corrected wording: denials are counted; no automatic refusal; alerting is not approved, implemented or claimed; the threshold and mechanism remain OPEN. | New. Approves the corrected wording of the CHANGED decision of 2026-11-02. | "Count and alert" is superseded. |
| 3 | O10: the visible omitted-detail marker is approved. Permission-rejected calls are counted within the approved staging cap, with no automatic refusal. The overflow-count behaviour is preserved. | Marker: new. Overflow count: previously approved (2026-11-02). Permission-rejected counting: new; supersedes the "not counted" limitation for staging. | A function-level counter cannot see calls rejected before the function runs. The counting mechanism is OPEN and not designed. Production C-12 remains OPEN. |
| 4 | Retention: option R-D selected TEMPORARILY. Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy. | New. Temporary, not final policy. | R-D is one of the retention options R-A to R-D in the 4 November report. It is not the refund options R-a to R-c (§12B.4). |
| 5 | Legal review is required for customer-file retention and related obligations. | New confirmation. The lawyer rows were already listed in Part 6. | Approves no retention change. |
| 6 | Migration 0012 (local main, unmerged): read-only review only. | New. | No implementation, SQL, staging application or deployment. Not an approval of item 23 or item 24. |
| 7 | Completion behaviour: not decided. The comparison of completion, queued-job, cancellation and reprint consequences is prepared for owner approval. | New. Deferred. | §12B.13. No option is selected. |
| 8 | Agent token: proposed 30-day idle expiry, 180-day maximum lifetime, 10-minute rotation overlap, and an in-flight exemption for finish calls after expiry. | New proposal, not decided. | §12C. Rotation implementation deferred until separately approved. |
| 9 | Staging: NOT approved. The O12 hosted-staging cost and setup report is provided first. | New. The O12 approach was previously approved (2026-11-02); no setup is approved. | §12D. No project creation, credentials or data. |
| 10 | Live database queries: NOT approved. The owner checks migration state and live jobs through the dashboard. | New. | Claude runs no live query. Affects the Part 6 rows for items 25 and 26. |

**Counts:** unchanged. No item changed status (§14.2). Earlier approvals are not withdrawn. Where a 2026-11-04 decision supersedes earlier wording for staging (O9 "count and alert"; O10 "not counted"), the earlier text is kept and annotated.

**Correction recorded:** `STAGE7_DECISIONS.md` §15.3 (7C row) read "O9: counted and alerted". It now reads the decided wording.
