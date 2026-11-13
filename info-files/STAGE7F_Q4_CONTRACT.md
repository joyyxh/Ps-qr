# Stage 7F Q4: refusal and release contract (design only)

Revised 2026-11-09 against the Chain A bodies (local main commit 37e4623) and the current agent and edge source.

Status:
- APPROVED (register §13C, Q4): a licence refusal returns the job to `queued` without incrementing `claim_count`.
  The implementation may reverse the claim increment when the claim is released.
- OWNER-AUTHORISED WORKING DEFAULT (2026-11-10, register §13E): Option A as drafted (§5). The refusal writes nothing at
  mark time. The release reverses the claim increment; a failed release leaves it until lease expiry. The residual R-Q4-1
  is accepted by this default. Option B (§6) is recorded but NOT adopted. Open: the `too_many_claims` text after five
  unresolved refusals (§11, E12).
- Nothing here is implemented, migrated, deployed, tested or run. No hosted or staging operation.

Precondition: nothing in this contract may reach production while enforcement is disabled (C-3). The switch that would
hold it off is the item 32 design (STAGE7F_ITEM32_KILL_SWITCH.md, not approved). See §9.

## 1. Normal behaviour (verified)

The refusal can happen in only two places, and the claim check removes most of them.

1. **Claim time (Chain A 0012 claim, plus the planned state check).** When the shop is not ACTIVE, the planned claim
   returns no job. No row is touched and `claim_count` is not incremented. This is the common case: a shop that
   is inactive when the agent asks is never given a job.
2. **Mark time (Chain A 0012 mark, planned check after `order_is_printable` at 180–181).** A refusal here can only
   happen when the licence stops being ACTIVE between a successful claim and the mark. That window is one agent round
   trip, normally under 2 seconds. The job is then `claimed` with `claim_count` already incremented by the claim
   (0010 claim step 664 in base; Chain A claim update about 130–137), and `lease_until` = claim time + 2 minutes.

So `claim_count` only needs restoring in the mark-time window. Repeated refusals of one job need repeated windows.

## 2. Verified: what the cap does to an unresolved refusal

Recovery (0010:189–214, unchanged on Chain A) runs at every claim and heartbeat for the shop:

- Expired `claimed` row with `claim_count < 5` → `queued`, `agent_id` and `lease_until` cleared. The count is NOT changed.
- Expired `claimed` row with `claim_count >= 5` → `failed` with `error_code = 'too_many_claims'` (0010:208–211).

The owner app then shows, for that failed job, the text in `FAILURE_TEXT.too_many_claims`:
"The printing computer could not finish this job after several tries." (Chain A `web/src/logic.js` line 440). That text
is wrong for a licence hold. A job failed this way needs the owner to print it again by hand.

## 3. Release failure (R-Q4-1)

**Option A (adopted as the working default, 2026-11-10).** The mark refusal raises `licence_inactive` and rolls back. The
agent then calls a separate release action, which requeues the job and reverses the claim increment.

- Normal: refusal commits nothing; release commits the requeue and the −1 in one transaction.
- The refusal and the release are two transactions. Between them the job is `claimed` with the +1, and the lease runs.
- Release fails (network, edge 5xx, DB error, or the agent crashes): the job stays `claimed` with the +1 until
  `lease_until` (2 minutes after the claim). Recovery then requeues it (count < 5, no decrement) or fails it
  (count ≥ 5, `too_many_claims`).
- Each unresolved refusal costs +1 until it expires. Five unresolved refusals on one job fail it with the misleading text.
- Restoration is therefore **not atomic**.

**Option B (not adopted).** The refusal and the requeue happen in the same mark transaction.

- The mark function, after the lease, agent, attempt and order checks, checks the licence. If not ACTIVE it sets the job to
  `queued`, clears `agent_id` and `lease_until`, sets `claim_count = greatest(claim_count - 1, 0)`, and returns a refusal
  result. It does not raise, so the writes commit.
- Restoration is atomic with the refusal. The only remaining residual is a failure of the whole mark transaction, which
  leaves the job `claimed` until expiry, the same as any failed mark today.
- There is no separate release call, so a lost release response cannot leave the count wrong.
- Cost: the mark response contract changes (a result, not an exception), so the edge and agent must be deployed first (§6).

## 4. Claim identity (applies to both options; a finding)

`claim` does not change `attempt`. Retry creates a new row with attempt + 1. So `attempt` only identifies the row, not
the claim. A release or mark that matches `agent_id`, `attempt` and `status = 'claimed'` can match a later claim by the
same agent after the first claim expired and was requeued.

The claim sets `lease_until = now() + interval '2 minutes'` (Chain A 0012 claim update) on every claim. That timestamp
is effectively unique per claim. Proposed claim token: the `lease_until` value the claim returned (no schema change).
The release (Option A) and the mark (both options) must match it. Consequence if not matched: a stale call could
requeue or decrement a claim it does not own. Two specific effects: a wrong −1 (lets the cap be avoided) and a wrong
requeue of a job another agent is printing. Mark uses the same identity check today only through `attempt`.

## 5. Option A contract (adopted as the working default, 2026-11-10)

### 5.1 `agent_mark_printing` (Chain A 0012:156–~188)
- After line 181 (`order_not_printable`), add: if `shop_licence_state(v_agent.shop_id) <> 'ACTIVE'`, raise
  `licence_inactive` (errcode `P0001`). Nothing is written first, so the transaction rolls back.
- Meta lock (shared) before the order lock at 173 (item 33 plan §2.3).

### 5.2 `agent_claim_next_job` (Chain A 0012:98–~140)
- Meta shared lock before the agent write at 111.
- After recovery (112), if not ACTIVE, return no job. `claim_count` untouched.

### 5.3 New `agent_release_licence_hold(p_token_hash, p_job_id, p_claim_token, p_attempt)`
- Security definer, search_path pinned, grants as the other agent RPCs (grant pattern to be confirmed before build).
- Job row lock only. No meta lock.
- Match status `claimed`, `agent_id`, `lease_until = p_claim_token`, `attempt = p_attempt`. Else `{released: false}`.
- Match: `status = 'queued'`, `agent_id = null`, `lease_until = null`, `claim_count = greatest(claim_count - 1, 0)`.
- Idempotent: a second call finds `queued` and returns `{released: false}`.

### 5.4 Edge function (`supabase/functions/print-agent/index.ts`)
- `ACTIONS` (line 25): add `release`.
- `release` branch: validate job id, claim token and attempt the way `printing` validates its inputs. Return
  `200 {"released": <bool>}`.
- `mapDatabaseError` (lines 77–97): before the default `500 server_error`, map a message containing `licence_inactive` to
  `409 {"error":"licence_inactive"}`. Also map `order_not_printable` to a 409 with its own code (fixes an existing gap).
  Check that no other message contains either substring.

### 5.5 Agent (`agent/src`)
- `api.mjs`: `release({jobId, claimToken, attempt})` next to `markPrinting` (line 52). Uses `call()`. Body keys to be
  matched to the `index.ts` parser (lines 185–235).
- `worker.mjs` (catch around `markPrinting`, lines 257–265): if `err.code === 'licence_inactive'`, call `release` once
  (catch and log any failure), clear the journal, log, and return. Never print. Never call finish.
- No retry loop for mark. Release may be retried a bounded number of times (idempotent), which narrows the residual
  but does not remove it.

## 6. Option B contract (not adopted; kept for reference)

### 6.1 `agent_mark_printing` (Chain A 0012:156–~188)
- Same meta lock placement as Option A.
- At the licence check (after `order_not_printable`), if not ACTIVE: requeue and decrement the job (§3, Option B), with the
  claim token and attempt matched as in §5.3, then **return** `{"refused": "licence_inactive"}`. The return commits the
  requeue.
- If the claim token does not match, raise `lease_lost` as today and write nothing.
- Signature: the claim token becomes a parameter. How the new parameter is added without breaking old callers
  (default value, overload, or a new name) is a compatibility question for the build. Not decided here.

### 6.2 Edge function
- `printing` branch: if the RPC result is `{refused: 'licence_inactive'}`, return `409 {"error":"licence_inactive"}`.
  A 200 with that body must never reach the agent.
- The same `licence_inactive` and `order_not_printable` mapping as §5.4 for the raise path.
- A success result is passed through unchanged, as today.

### 6.3 Agent
- On `409 licence_inactive` (`err.code`): clear the journal, log, return. No print, no finish, no release call (the DB
  has already requeued the job).
- Any other error: unchanged.

### 6.4 Deployment and rollback order (Option B)
- Deploy order: edge function, then agent, then the DB migration. The new edge accepts an old DB (no refusal result ever
  arrives), and an old agent treats the 409 as a failure and does not print.
- Reverse the DB first when rolling back. With the refusal result gone from the DB, the edge can then be rolled back.
  Rolling the edge back while the DB still returns a refusal would let a 200 reach an old agent, which would print.

## 7. Version compatibility

| DB (7F) | Edge | Agent | Option | Behaviour |
|---|---|---|---|---|
| Chain A (no licence gate) | old | old | — | Current behaviour |
| new | old | old | A | Mark raises `licence_inactive`; old edge returns 500 `server_error`; old agent does not print; job stays `claimed` with +1 until expiry (R-Q4-1) |
| new | new | old | A | 409 from the edge; old agent throws and does not print; same residual |
| new | new | new | A | Full path (§5) |
| new | new | new | B | Full path (§6). Atomic refusal |
| new (returns refusal result) | old | old | B | **UNSAFE**: 200 with a refusal body; old agent prints. Must never be deployed |
| new (returns refusal result) | new | old | B | Old agent gets 409 and does not print |
| Chain A | new | new | any | `release` is never called (no raise), or the RPC is missing and the call returns `server_error`; agent logs and does not print |

## 8. Edge cases

| ID | Case | Option A result | Option B result |
|---|---|---|---|
| E1 | Revoke between claim and mark | Mark raises; release requeues, count restored | Mark requeues and returns refusal, count restored |
| E2 | Reactivation after refusal, before release | Release still requeues; next claim after reactivation prints | Already requeued; next claim after reactivation prints |
| E3 | Recovery requeued the job before the refusal reached the DB | Release: `released: false`; recovery's own rule applies | Mark: claim token mismatch → `lease_lost`; nothing written |
| E4 | Duplicate release (agent retry) | Second call `released: false`; no second decrement | n/a |
| E5 | Stale release after the same agent reclaimed the job (claim identity) | Prevented only by the claim token (§4) | Prevented by the claim token on mark |
| E6 | Crash after refusal, before release | Job `claimed` until expiry; claim +1 stays (R-Q4-1) | Not possible: refusal committed in one transaction |
| E7 | Release call fails (network or 5xx) | As E6; agent logs | n/a |
| E8 | Release and mark race on one job | T33-C | n/a |
| E9 | Mark on a job whose lease already expired | `lease_lost` (lease check runs first); licence check not reached | Same |
| E10 | Count already 0 | Stays 0 (floor) | Same |
| E11 | Release vs recovery on the same row | T33-E: decremented at most once | Not applicable |
| E12 | Five unresolved refusals on one job (Option A) | Recovery fails the job `too_many_claims`, showing the misleading text (§2) | Cannot occur from refusals alone |
| E13 | Mark refusal after order is refunded | Order check (`order_not_printable`) runs first | Same |

## 9. Precondition and rollout block

- C-3 holds enforcement disabled until M1 and the held-file release policy are approved. The claim and mark licence checks
  are enforcement. They must sit behind a switch that defaults to off.
- The switch is the item 32 design (STAGE7F_ITEM32_KILL_SWITCH.md). It is not approved. Until it is approved and built,
  this contract is staging-only.
- Each step needs its own approval: migration, edge function deployment, agent release, and staging run.

## 10. Targeted tests (none run)

### 10.1 Agent: `agent/test/worker.test.mjs`
Option A:
- Q4-AG-1: mark throws `licence_inactive` → `release` once with job id, claim token and attempt; no print; no finish; journal cleared.
- Q4-AG-2: mark throws `lease_lost` → no release; unchanged.
- Q4-AG-3: release throws → logged; no print; no finish; journal cleared; no retry loop.
- Q4-AG-4: mark throws `server_error` → no release; unchanged.
- Q4-AG-5: release returns `released: false` → no error; no print; journal cleared.

Option B:
- Q4-AG-B1: mark returns 409 `licence_inactive` → no print; no finish; no release call; journal cleared.
- Q4-AG-B2: mark returns 409 `order_not_printable` → same as today for that code.

### 10.2 Edge: `supabase/tests/print_agent_api_checks.test.js`
- Q4-EF-1: `release` with valid input calls the RPC with the same parameters and returns `{released}` (Option A).
- Q4-EF-2: RPC error with `licence_inactive` → 409 `licence_inactive`, not 500.
- Q4-EF-3: `release` or `printing` with a missing or invalid job id, claim token or attempt → 400.
- Q4-EF-4: unknown action still rejected.
- Q4-EF-B1: RPC result `{refused:'licence_inactive'}` → 409, never 200.
- Q4-EF-B2: `order_not_printable` → 409, not 500.

The commands that run these suites are to be confirmed before build.

### 10.3 SQL: staging copy only (CLAUDE.md)
Option A: Q4-SQL-1 to Q4-SQL-12 (as in the earlier version: ACTIVE mark, REVOKED/EXPIRED/SCHEDULED/NONE mark refusals with
row unchanged, claim on inactive shop, claim on active shop, release success, count floor, other agent, stale attempt,
second release, release on printing job).

Option B: Q4-SQL-B1 refusal commits requeue and −1 in one transaction; Q4-SQL-B2 refusal with a mismatched claim token
raises `lease_lost` and writes nothing; Q4-SQL-B3 repeated refusal cycles (six) leave `claim_count` at its pre-claim
value; Q4-SQL-B4 refusal on REVOKED, EXPIRED, SCHEDULED and NONE shops.

Two-session: T33-C, T33-D, T33-E (Option A only), T33-F (both), T33-G (case o, for the trigger/recovery ordering).


### 10.4 Outcome tests required by the working default (both outcomes; NOT RUN)

- Q4-OUT-1, release succeeds: the refusal writes nothing and returns no printing result. The release requeues the job, clears `agent_id` and `lease_until`, and reduces `claim_count` by one (floor 0). No print occurs. The next claim after reactivation may print. Agent: Q4-AG-1 and Q4-AG-5. Edge: Q4-EF-1. SQL (staging only): the release-success and count-floor cases in §10.3.
- Q4-OUT-2, release fails (network, 5xx, database error or crash): the refusal writes nothing. The job stays `claimed` with the +1 until `lease_until`. No print occurs. After expiry, recovery requeues the job without a decrement when `claim_count < 5`, or fails it `too_many_claims` when `claim_count >= 5`. Agent: Q4-AG-3. Edge: Q4-EF-2. SQL (staging only): the release-failure cases in §10.3, plus one lease-expiry case that is not yet numbered. Two-session: T33-E when release and recovery race.
- Q4-OUT-3 is not a test. The `too_many_claims` text after five unresolved refusals (E12) is wrong for a licence hold. A test must not assert that text as correct.
- Status: NOT RUN. Nothing is built. SQL needs the staging database and separate approval.

## 11. D-Q4: working default applied; open follow-up

Answered by the owner's working default (2026-11-10): Option A as drafted is accepted. The original question is kept for reference: "For the residual R-Q4-1 (a release that fails leaves the claim's +1 until lease expiry, which can end in
`too_many_claims` after five unresolved refusals): accept Option A as drafted, or require Option B?"

- Original recommendation (SUPERSEDED by the owner's working default, 2026-11-10; Option A adopted): Option B, with the claim token (§4). Reason: it makes the restoration atomic with the refusal, removes the
  separate release call's failure mode, and removes the path to the misleading `too_many_claims` text. Option A's residual
  is rare, but its effect is wrong text and a failed job.
- Consequences of Option B: a new mark response shape; edge and agent deployed before the DB; reverse order on rollback;
  mark signature change (compatibility to decide in the build). Needs its own approval.
- Consequences of Option A: keep the two-call design; accept the residual with the cap effect; mapping and claim token still
  needed for correctness (§4).
- OPEN, not covered by the default: whether a job failed with `too_many_claims` after licence refusals should show its own text
  (a new FAILURE_TEXT entry) or stay as is. Recommended: its own text. This is a UI text change (Q5 approval needed).
