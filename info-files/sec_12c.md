### 12C. Agent token lifecycle: proposal (2026-11-04)

*Proposal only (2026-11-04 no. 8). Not approved for implementation. Rotation implementation is deferred until separately approved. No migration, function, agent or secret change is approved.*

**Current behaviour (read from 0010, not run)**
- Only the SHA-256 hash of an agent token is stored (`print_agents.token_hash`, line 28).
- `agent_for_token` (lines 166–186) checks the hash format and that the agent is not revoked. It checks no expiry and no idle time.
- `last_seen_at` is set by heartbeat (line 620) and by each claim (line 643). The "online" flag is true within 2 minutes (line 343).
- `revoke_print_agent` (lines 378–409) sets `revoked_at`.
- `agent_mark_printing` (line 688) and `agent_finish_job` (line 714) resolve the token through `agent_for_token`.
- Pairing codes expire after 10 minutes and are single-use (`consume_print_pairing`).

**Proposed policy**
1. **Idle expiry:** a token expires 30 days after its agent last checked in (`last_seen_at`).
2. **Maximum lifetime:** a token expires 180 days after it was issued, whatever the activity.
3. **Rotation overlap:** after a rotation, the old token stays valid for 10 minutes after the new one is issued.
4. **In-flight exemption:** a finish call (`agent_finish_job`) for a job claimed before expiry is accepted after expiry, so claimed work can still be closed.

Consequences that follow from expiry, to confirm: after expiry, new claims and heartbeats are refused, and the agent is re-paired with a new 10-minute pairing code.

**Not decided**
- Whether `agent_mark_printing` is also exempt after expiry. The owner's decision names only finish calls.
- Whether rotation is started by the owner or by the agent.
- What "in flight" means exactly. This proposal reads it as a job whose lease is still open (`claimed` or `printing`).

**Before any implementation (separate approval).** Change `agent_for_token` and the claim path; add a rotation function; change the agent to store and use the new token; add staging tests for idle expiry, the lifetime cap, the overlap window, a finish call after expiry for a claimed job, and a claim refused after expiry.
