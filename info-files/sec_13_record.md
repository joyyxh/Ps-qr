### Owner decision record (2026-11-04)

Source: owner instruction in this session on 2026-11-04, ten items, numbered 1 to 10 here. These are decisions only. They approve no implementation, SQL, migration change or application, staging setup or run, project creation, test execution, deployment, secret change, commit or push. Each gate named below needs its own explicit approval.

| No. | Decision (2026-11-04) | Label | Recorded in |
|---|---|---|---|
| 1 | O4 scope: option A. Overlapping grants of the same kind are rejected. A lifetime grant over an admin grant stays allowed. Lifetime-revocation exposure documented. | New. Closes the O4 scope point. | §12A.6; sheet Part 1H; O4 rows in §13 |
| 2 | O9: corrected wording approved. Denials are counted; no automatic refusal; alerting is not approved, implemented or claimed; the threshold and mechanism remain OPEN. | New. Approves the corrected CHANGED wording. | §12B.7; §13 O9 rows; §15.3 7C row |
| 3 | O10: the visible omitted-detail marker is approved. Permission-rejected calls are counted within the approved staging cap; no automatic refusal; the overflow-count behaviour is preserved. | Marker: new. Overflow count: previously approved 2026-11-02. Permission-rejected counting: new; supersedes "not counted" for staging. | §12B.7; §12B.11; §13 O10 rows |
| 4 | Retention: option R-D selected TEMPORARILY. Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy. Not final policy. | New. Temporary. | §12A.10; §12B.8; §12B.9 C-1; §14.2 items 1 and 27; §14.3 C-1; §15.3 M1 |
| 5 | Legal review is required for customer-file retention and related obligations. | New confirmation. Lawyer rows already listed. | §14.2 items 1, 15 and 30; §14.3 C-1; §15.3 M1 |
| 6 | Migration 0012 (local main, unmerged): read-only review only. No implementation, SQL, staging application or deployment. | New. | §12B.4; §12B.2 M7; §14.2 items 23 and 24 |
| 7 | Completion behaviour: not decided. Comparison prepared for owner approval. | New. Deferred. | §12B.13 |
| 8 | Agent token: proposed 30-day idle expiry, 180-day maximum lifetime, 10-minute rotation overlap, in-flight exemption for finish calls after expiry. Rotation implementation deferred until separately approved. | New proposal, not decided. | §12C |
| 9 | Staging: NOT approved. O12 cost and setup report provided first. | New. The O12 approach was previously approved; no setup is approved. | §12D; §13 O12 rows |
| 10 | Live database queries: NOT approved. The owner checks migration state and live jobs through the dashboard. | New. | §14.2 items 25 and 26 |

**Counts and approvals.** No item changed status, and the §14.2 counts are unchanged. Earlier approvals are not withdrawn. Where this record supersedes earlier wording for staging (O9 "count and alert"; O10 "not counted"), the earlier text is kept and annotated.

**Correction.** The §15.3 7C row read "O9: counted and alerted". It now reads the decided wording (no. 2).
