> Numbering note (2026-11-10 reconciliation): D-MIG is NOT approved, and the licence files are back at 0011 to 0013. Any 0015 to 0018 mention below is the unapproved proposal only. See scratchpad/reconciliation_2026-11-10/03_migration_conflict_report.md.

# Item 33: lock-order implementation plan (Stage 7F). Design only. Nothing built, migrated or run.

Revised 2026-11-09 against the Chain A bodies. The earlier version used origin/main 0010 bodies for approve, claim
and mark, and those bodies are superseded on local main (commit 37e4623). Placement itself is unchanged.

Status: placement DECIDED 2026-11-09 (register §13C) for `approve_order_for_print`, `agent_claim_next_job` and
`agent_mark_printing`. Retry is excluded until item 23. Recovery keeps its current statements until its printing
approval (rule 10). Code, migration, two-session tests and the rollback file each need their own approval.
Nothing here authorises them.

## 0. Verified base (read 2026-11-09, `git show 37e4623:<path>`)

| Function | Defined in (latest) | Lines | Lock today |
|---|---|---|---|
| `approve_order_for_print` | Chain A 0011 (supersedes 0010:439) | 647–706 | order `for update` at 659 |
| `agent_claim_next_job` | Chain A 0012 (supersedes 0010:630) | 98–~140 | agent row (update at 111); jobs `for update skip locked` at 124 |
| `agent_mark_printing` | Chain A 0012 (supersedes 0010:688) | 156–~188 | order `for update` at 173; job `for update` at 174 |
| `recover_expired_print_jobs` | 0010 (unchanged on Chain A) | 189–~214 | unlocked updates (202, 208, 211 area) |
| `retry_print_job` | 0010 (unchanged) | 502–552 | job `for update` (515) |
| `agent_heartbeat` / `agent_finish_job` | 0010 (unchanged) | 592 / 714 | heartbeat calls recovery; finish locks job |
| `order_is_printable`, `cancel_unprintable_jobs` trigger | Chain A 0012 (new) | 43–67, 58–95 | trigger updates job rows under the order lock |
| `set_order_payment` (refunds) | Chain A 0013 | ~175–280 | order read unlocked (~194), order UPDATE, then trigger |

Also verified: `agent/` and `supabase/functions/` are byte-identical between 5c82d37 and 37e4623. 0001 and 0010 are
byte-identical between the two lines. Chain A changes only the web app and the three migrations above.

Consequence for the earlier plan: base 0010 `agent_mark_printing` locks only the job. Chain A locks the order
first, then the job. The meta lock must go before the order lock in mark. The plan's rollback must restore the Chain A
bodies, not the 0010 bodies (§7).

## 1. Global rule

    shop meta row (shared or exclusive) → order → agent → print job (ascending id)

- Print gates take the meta row SHARED (`licence_lock_shop(shop, 'shared')`, which is `FOR SHARE`).
- Admin licence writes take it EXCLUSIVE (`FOR UPDATE`) and take no order, agent or job lock (register R18 rule 2).
- No path takes the meta row after an order, agent or job lock.
- Each RPC is one transaction. Locks are held until commit or rollback.
- The `cancel_unprintable_jobs` trigger takes order → jobs, which fits this rule. It takes no meta lock and must not get one.

## 2. Target bodies (Chain A base; changes only)

### 2.1 `approve_order_for_print` (0011:647–706)
1. Non-locking read: `select shop_id into v_shop from orders where id = p_order_id`. Not found → `P0002`,
   'order not found' (verbatim, 0011:661).
2. Owner check moves here (today at 664, after the lock): `auth.uid()` and `is_shop_owner(v_shop)`. Failure →
   `42501`, 'you do not have permission to change this order' (verbatim). No lock is held yet, so the check's position
   changes nothing except lock order.
3. `perform licence_lock_shop(v_shop, 'shared')`. NEW. Meta lock before the order lock.
4. `select * into v_order ... for update` (line 659, now after step 3). Assert `v_order.shop_id = v_shop`. The
   assertion is redundant because `guard_order_changes` makes shop_id immutable (0001:144–148), but it costs nothing.
5. Existing checks, unchanged: status 'approved' or 'printing' (667), payment 'paid' (670).
6. NEW licence check: if `shop_licence_state(v_shop)` is not 'ACTIVE', raise. The message is plain English because
   the owner app shows the raw database message (`messageFor` default branch). Exact wording is decision D-Q5-1.
7. Existing job-insert loop and status update. Unchanged.

### 2.2 `agent_claim_next_job` (0012:98–~140)
1. `v_agent := agent_for_token(p_token_hash)` (read). Unchanged.
2. `perform licence_lock_shop(v_agent.shop_id, 'shared')`. NEW. Must come before the agent write at 111.
3. `update print_agents set last_seen_at = now()` (111). Unchanged.
4. `perform recover_expired_print_jobs(v_agent.shop_id)` (112). Unchanged in this approval (rule 10).
5. NEW: `if shop_licence_state(v_agent.shop_id) <> 'ACTIVE' then return null`. `claim_count` is not touched. The response
   is the same as an empty queue.
6. Existing select (114–124), including the `order_is_printable` predicate (118). Unchanged. It reads orders without
   a lock, so it never waits on an order lock.
7. Existing update (about 130–137): status 'claimed', `claim_count + 1`, `lease_until = now() + 2 minutes`. Unchanged.
8. Return the job. Unchanged.

### 2.3 `agent_mark_printing` (0012:156–~188)
1. `v_agent := agent_for_token(...)`. Unchanged.
2. Non-locking read: `select order_id from print_jobs where id = p_job_id`. Null → `lease_lost` (171). Unchanged.
3. `perform licence_lock_shop(v_agent.shop_id, 'shared')`. NEW. Before the order lock. Uses the agent's shop; the
   job's agent check later confirms the job is this agent's.
4. `perform 1 from orders where id = v_order_id for update` (173). Unchanged.
5. `select * into v_job from print_jobs where id = p_job_id for update` (174). Unchanged.
6. Lease, agent and attempt checks (177), raising `lease_lost`. Unchanged.
7. `order_is_printable` check (180–181), raising `order_not_printable`. Unchanged.
8. NEW licence check: `shop_licence_state(v_agent.shop_id) <> 'ACTIVE'`. The contract for this step is in the Q4
   contract. Under Option A it raises `licence_inactive` and rolls back. Under Option B it requeues the job and returns
   a refusal result in the same transaction. The choice is decision D-Q4. Placed after 7 so existing order refusals keep
   their current behaviour.
9. Existing update to 'printing' with lease 3 minutes, and return. Unchanged.

Lock sequence in mark: meta S → order X → job X. The order lock already existed. Only the meta lock is new.

### 2.4 `agent_release_licence_hold` (Option A only; not needed under Option B)
1. `v_agent := agent_for_token(...)`.
2. `select * ... from print_jobs where id = p_job_id for update`. No meta lock. The release makes no licence decision
   and must succeed whatever the licence state.
3. Match on all of: status 'claimed', `agent_id = v_agent.id`, `lease_until = p_claim_token` (the lease value the claim
   returned), and `attempt = p_attempt`. Any mismatch → `{released: false}`, no change.
   Why `lease_until` and not only `attempt`: claim never changes `attempt` (retry creates a new row), so
   (agent, attempt, status) does not identify a claim. A stale release could match a later claim by the same agent.
4. Else: `status = 'queued'`, `agent_id = null`, `lease_until = null`,
   `claim_count = greatest(claim_count - 1, 0)`, `updated_at = now()`. Return `{released: true}`.

### 2.5 Unchanged in this approval
| Function | Reason |
|---|---|
| `retry_print_job` (0010:502) | Item 23 must reverse its job-first order first (rule 5). Retry is still a 7F gate (register line 592), so a licence gate must be added after item 23 |
| `recover_expired_print_jobs` (0010:189) | Rule 10 (SKIP LOCKED) needs its printing approval. See §5 for the new trigger case |
| `agent_heartbeat` (0010:592) | No meta lock (rule 9). Calls recovery, which is unchanged |
| `agent_finish_job` (0010:714) | No licence gate (decision B). Rule 9 |
| `cancel_unprintable_jobs` trigger (0012:58–95) | Not a licence gate and must never become one. Licence holds must never use the `cancelled` path |
| `set_order_payment` (0013) | Customer payments. Item 24 owns the refund and claim defect |
| Admin licence RPCs (7C) | Exclusive meta lock, no order, agent or job lock (R18 rule 2) |

## 3. Hold start (Q2)
Not part of the lock-order change. See register §13C (Q2) and decision D-HS in the PREP document. Q2 is used only
once M1 is approved. The derivation itself is unchanged: it counts only coverage ends at or before the check time,
so a future coverage end is never used as a past hold start.

## 4. Transaction boundaries (Chain A)

| Call | Transaction | Locks at commit or rollback | Notes |
|---|---|---|---|
| `approve_order_for_print` | One RPC | meta S, order X, new `print_jobs` rows | Refusal raises before inserts, so nothing is written |
| `agent_claim_next_job` | One RPC | meta S, agent row, recovery row locks, one job X | Null return writes the agent `last_seen_at` only |
| `agent_mark_printing`, success | One RPC | meta S, order X, job X | |
| `agent_mark_printing`, refusal, Option A | Rolled back | none kept. Job stays `claimed` with its claim values | Raise rolls back the transaction |
| `agent_mark_printing`, refusal, Option B | Committed | meta S, order X, job X. Writes the requeue and count restore | Refusal is a result, not an error. See Q4 contract |
| `agent_release_licence_hold` (Option A) | One RPC | job X | |
| Refund: `set_order_payment` UPDATE, then trigger | One statement chain | order X, then queued and claimed job rows | Holds order before jobs, as rule requires |
| Admin revoke (7C) | One RPC | meta X, coverage row, audit row | |

READ COMMITTED is required (0011 helper comment). The state read after the shared lock is its own statement, so it sees
a revoke committed before the lock was granted. Do not raise the isolation level.

## 5. Deadlock and concurrency cases

| Case | Sessions | Result |
|---|---|---|
| a | approve vs admin revoke, one shop | Approve holds meta S, then wants the order. Revoke waits for S and holds no order. No cycle |
| b | approve vs refund, one order | Approve holds meta S and order X. Refund waits at its order UPDATE. No meta lock in refund. No cycle |
| c | approve vs approve, same order | Second waits on the order. No cycle |
| d | claim vs revoke | As (a). Claim waits for S, then sees REVOKED or ACTIVE |
| e | claim vs claim, two agents, one shop | Both take S. Skip-locked select. Recovery's unlocked updates can still deadlock. Pre-existing. Blocked by rule 10 |
| f | mark vs release (Option A), one job | Mark holds meta S, order X, then job X. Release takes job X only. Mark waits for release, or release waits for mark. No cycle |
| g | mark vs revoke | Mark holds meta S. Revoke waits. Mark sees ACTIVE or refuses. No cycle |
| h | claim vs mark or finish, one job | Claim skips the locked job. No wait |
| i | retry vs approve, one order | Retry holds the failed job, reads the order unlocked. Approve holds meta S and the order. No cycle. Re-check after item 23 |
| j | first coverage grant vs claim, no meta row | Both `insert ... on conflict do nothing`. Second waits for the first commit, then locks. No cycle |
| k | two admin revokes, one coverage | Both take meta X. Serialised by the guard |
| l | recovery (heartbeat) vs claim recovery | Both unlocked updates. Same as (e). Blocked by rule 10 |
| m | release vs recovery, same expired row (Option A) | Recovery's update waits for release and re-checks its WHERE clause. Row is not double counted (T33-E) |
| n | release vs claim, same job (Option A) | Claim skips the locked job. Next claim sees `queued` |
| o | **refund trigger vs recovery (NEW, Chain A)** | Trigger takes order X, then updates queued and claimed job rows in scan order. Recovery updates expired claimed rows of the shop in its own scan order, without the order lock. Two statements can lock the same rows in different orders, which can raise 40P01. Pre-existing risk, introduced with the Chain A trigger. Not covered by rule 10 or the R18 list. New test T33-G. Fix options are in §8 |
| p | refund vs mark, same job | Both take order X first. Mark holds order X and the job. Refund waits at the order UPDATE. After mark commits the job is `printing`, which the trigger does not touch (matches 0012 comment: printing jobs still print) |
| q | refund vs claim, same job | Claim holds the job row and reads the order unlocked. Refund waits at the trigger's job update. Claim never waits for the order. No cycle. Outcome is a cancelled claimed job, then the agent's mark gets `order_not_printable` |

Key property: no path takes the meta lock after an order, agent or job lock, and admin writes take no order, agent or
job lock. Chain A's new trigger takes order → jobs, which is consistent. The open class is case (o) (job-to-job
ordering between the trigger and recovery), plus recovery's unlocked updates (cases e and l), which need rule 10.

## 6. Two-session staging tests

Staging only, with its own approval. Target: zero `40P01`, repeated enough to be meaningful (suggest 50 runs per case).
Setup: the staging copy of origin/main 0010, then Chain A 0011–0014 (once approved), then the 7F migration (number TBD,
decision D-MIG, not performed). The recommended numbering is in register §13D: Chain A stays 0011 to 0014, the stage7
licence files move to 0015 to 0017, and the 7F migration takes 0018. The stage7 files are never applied on their own,
and no staging copy uses a different order.

| ID | Sessions | Expected result | Status |
|---|---|---|---|
| T33-1 (R18 #1) | claim vs admin revoke, one shop | Claim waits, then sees REVOKED. No deadlock | Runnable after staging approval |
| T33-2 (R18 #2) | mark vs revoke | Changed by Q4. Working default (2026-11-10): Option A. Mark refuses and rolls back after revoke commits; release requeues the job and reverses the increment. Expectation still needs re-approval (D-R18-T2, pending) | Re-approval needed |
| T33-3 (R18 #3) | two revokes, one coverage | Second rejected by the guard | Runnable |
| T33-4 (R18 #4) | recovery vs recovery, two agents, expired rows | No `40P01` | Blocked by rule 10 |
| T33-5 (R18 #5) | revoke vs recovery, both orders | No `40P01` | Blocked by rule 10 |
| T33-6 (R18 #6) | retry vs approve, one order | Retry waits, then sees `printing` | Runnable (retry unchanged) |
| T33-7 (R18 #7) | retry vs refund | No print queued for a refunded order. No `40P01` | Blocked by items 23 and 24 |
| T33-8 (R18 #8) | two retries, one job | Exactly one new attempt row | Runnable |
| T33-9 (R18 #9) | claim vs mark or finish, one job | Claim skips the locked job. No wait | Runnable |
| T33-10 (R18 #10) | first grant vs claim, no meta row | No `40P01`. Claim sees state before or after the grant, never a mix | Runnable |
| T33-11 (R18 #11) | `place_order` vs purge of one customer file | No `40P01` | Runnable (purge not gated by item 33) |
| T33-A | approve vs revoke | Revoke first: approve raises and inserts no job. Approve first: jobs inserted, then revoke waits | New |
| T33-B | approve vs refund, one order | No `40P01`. Refund sees a consistent order | New. Needs item 24 for the refund side |
| T33-C | mark vs release (Option A), one job | Release first: mark sees `queued`, raises `lease_lost`. Mark first: release sees `printing`, returns `released: false` | New |
| T33-D | claim vs release (Option A), one job | Claim skips a locked job; next claim gets it after release | New |
| T33-E | release vs recovery, one expired row (Option A) | `claim_count` decremented at most once | New |
| T33-F | revoke between claim and mark, then release (A) or refusal (B), then reactivate | Refusal returns the job to `queued` with `claim_count` as before the claim. Never `too_many_claims`. Six cycles | New (Q4 core) |
| T33-G | refund trigger vs recovery, one order with two claimed expired jobs | Target zero `40P01`. Expected to fail today on the pre-existing trigger/recovery ordering. Run before any fix | New. Needs staging approval |
| T33-H | approve vs refund, one order, with a licence revoke pending | Approve waits for meta; no `40P01`; the outcome is consistent with the order's final state | New |

## 7. Rollback implications (corrected to Chain A)

| Layer | Rollback | Effect |
|---|---|---|
| 7F migration, down file | Must restore the Chain A text of `approve_order_for_print` (0011:647–706), `agent_claim_next_job` and `agent_mark_printing` (0012:98–~188), and drop the new helpers. It must NOT restore the 0010 bodies | Restoring 0010 would drop the eligibility checks and the approve payment check, which is a regression. The down file must hold the exact Chain A text |
| Lock order | Removing the meta lock from a function is safe. No function then takes meta after an order, agent or job lock | Mixed-version sessions are safe |
| Print-agent edge function | Old version maps `licence_inactive` to `server_error` (500). The old agent treats any throw as not printed | Safe for printing. Under Option A the claim +1 is not reversed (R-Q4-1). Under Option B a 200 refusal would print on an old agent, so the edge must be rolled back only after the DB refusal shape is gone (Q4 §6) |
| Agent | Old agent ignores the code | Safe, same residual as above |
| Release rows | Jobs already requeued stay `queued`. Old code claims them normally | No data repair needed |
| Enforcement | Item 32 kill switch is designed (see the item 32 document), not approved | Blocks enabling. The down file alone is not a kill switch |

## 8. Trigger/recovery ordering (case o): options, not approved

1. Make the trigger's job update and recovery's job updates lock in one order (for example `order by id` in both,
   through a `for update` select). This touches the trigger (0012) and recovery (rule 10, printing approval).
2. Let the trigger skip jobs that recovery holds (`for update skip locked`) and retry later. This changes the
   trigger's guarantee that queued and claimed jobs are cancelled at once. It needs approval.
3. Accept the risk with T33-G evidence and a retry in the caller. Not recommended without the test result.

Recommended: run T33-G first (staging, with approval). The option is chosen from its result. No option is applied now.

## 9. Verifications before build (status)

| Check | Status |
|---|---|
| `orders.shop_id` cannot change | Verified by reading: `guard_order_changes` (0001:137–170), a before-update trigger that raises if shop_id changes (0001:144–148). Same on both lines. Hosted state unverified |
| `licence_lock_shop` and `shop_licence_state` owner and grants | Verified by reading only: security definer, execute revoked from public, anon, authenticated and service_role (0011). No explicit owner, so the owner is the role that runs the migration. The owner that the print functions run as must be the same role. Hosted and local catalog checks NOT RUN (no local cluster running; no hosted access used) |
| `call()` error shape in `agent/src/api.mjs` | Verified by reading: `AgentApiError` carries `status`, `code` (from the response body `code`), and `message` |
| Edge function deployed on hosted Supabase | UNVERIFIED. Repository source is the only evidence (items 26 and 27) |
| `licence_inactive` mapping in the edge function | Not present. Unknown messages fall through to 500 `server_error` (index.ts `mapDatabaseError`, lines 77–97). `order_not_printable` is also unmapped today |
| Chain A bodies used | Yes (§0). Base 0010 bodies used only for functions that Chain A does not redefine |

## 10. Open items before a build
1. Retry placement waits for item 23 (rule 5), and then needs its own approval.
2. Recovery SKIP LOCKED (rule 10) needs printing approval and M7 review. Cases e and l remain until then.
3. Case (o) needs staging evidence (T33-G) and an option from §8.
4. R18 two-session test 2 expectation (T33-2) needs re-approval (D-R18-T2).
5. Option choice for the mark refusal, and the claim token (D-Q4).
6. Migration number (D-MIG).
7. Hosted and local verification in §9 that are still unverified.
