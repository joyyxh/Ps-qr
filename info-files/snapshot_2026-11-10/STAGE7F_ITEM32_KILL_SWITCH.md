# Item 32: enforcement kill switch (Stage 7F). Design draft. Not approved. Not implemented.

Status: DRAFT 2026-11-09. Register item 32 is an IMPLEMENTATION GATE. The 7F gate (register §15.3) requires the owner to
approve this design before 7F. Nothing here authorises a migration, a table, a function, a deployment, a staging run, a
hosted operation, or any change to the switch. The decisions it needs are listed in §12 (D-I32).

## 1. What it is for
A single, global switch that decides whether licence enforcement is applied on the print path: the claim check, the mark
check, the approve check, and (after item 23) the retry check. It is off by default. It can be turned off in an emergency
without a deployment. It is not a per-shop setting and it is not reachable from any client.

Enforcement stays held back (C-3). The switch makes the held state explicit, so that a switch change is the only thing
that can start or stop enforcement, and every change is recorded.

## 2. Who can operate it
| Action | Who | Route | Notes |
|---|---|---|---|
| Turn enforcement OFF (emergency disable) | DB owner (on-call operator) | Break-glass SQL, lock-first (O7) | Single operator is enough. Recommended: fail-safe direction, so no second person |
| Turn enforcement ON (activation) | DB owner, two operators | Break-glass SQL, lock-first (O7) | Two people. Requires `approval_ref` naming a register decision that records the gates in §5 |
| Read the switch | DB owner, and the security definer print functions | none for clients | |
| Change the switch from the app | nobody in 7F | none | Platform-admin RPC with AAL2 is deferred (O6; AAL2 OPEN, register item 5) |
| Shop owner, staff, anon, authenticated, service role | none | none | No grant, no policy, no RPC |

## 3. Where its state is stored
One row, global, in a table dedicated to the switch:

    print_enforcement_switch
      id           smallint primary key check (id = 1)
      mode         text not null check (mode in ('off', 'on')) default 'off'
      enabled_at   timestamptz null          -- set when mode becomes 'on'; cleared when 'off'
      changed_at   timestamptz not null default now()
      changed_by   text not null             -- current_user and session_user
      approval_ref text null                 -- required when mode = 'on'
      reason       text not null
      -- constraint: (mode = 'off' and enabled_at is null)
      --        or (mode = 'on' and enabled_at is not null and approval_ref is not null)

Rejected alternatives:
- A GUC or session setting: decision 10 (no GUC marker). The setting would also be lost between transactions.
- A column on `shop_licence_meta`: the switch is global, not per shop, and would make switch writes take meta locks.
- An edge function secret: the gate is inside SQL functions, and CLAUDE.md forbids secret or setting changes without approval.

RLS is enabled with no policies. Execute and table privileges are revoked from public, anon, authenticated and
service_role, the same pattern as the 0011 licence tables. Triggers reject DELETE and TRUNCATE. The migration inserts the
row with `mode = 'off'`.

## 4. Default state and unknown state
- Default: `off`. With `off`, the claim, mark and approve functions apply no licence check and behave as Chain A does now.
- Row present and `mode = 'on'`: enforcement applies.
- Row present with any other value: impossible (check constraint). Treated as `off`.
- Row missing: treated as `off`, and reported by a monitoring query (not designed here).
- Row unreadable because of a database error: the statement fails, the print transaction rolls back, and nothing is
  printed or changed. This is the same as any database error today.

The choice in the row-missing case is decision D-I32-b. Recommended: treat missing as `off`. Reason: the switch exists to
hold enforcement back, and an absent switch must not hold customers' work. The cost: a deleted row would switch enforcement
off without anyone choosing it. The monitoring query and the constraints (no DELETE, §3) are what reduce that risk. The
alternative, fail closed (missing row refuses printing), makes a configuration fault stop every shop's printing.

## 5. Activation without a deployment
Yes, technically: turning the switch on is a row change, not a deployment. That is also why it must be controlled:
- Activation may happen only after the gate code is deployed and verified with the switch off (dry run, §11).
- Activation needs every gate below, recorded in the register, and the identifier of that register decision in `approval_ref`:
  - C-1 lawyer review answered, and the held-file release policy and M1 approved (C-3, register §13C).
  - Item 2 reopened with the hold start decided (Q2 approved; never-ACTIVE start decided under D-HS).
  - Item 10 answered where paid orders are affected (register §13C, C-3).
  - Staging tests S1 to S9 passed, under separate approval.
  - The dry-run function reviewed for the affected shops.
  - Edge, agent and database code deployed and verified with the switch off.
- The break-glass script for activation is a documented procedure. It is not written. Its text needs separate owner
  approval before any use (O7).

## 6. Audit record
An append-only table, written in the same transaction as the switch change:

    print_enforcement_audit
      id          bigserial primary key
      changed_at  timestamptz not null default now()
      txid        bigint not null default txid_current()
      db_user     text not null default current_user
      session_user text not null default session_user
      old_mode    text not null
      new_mode    text not null
      approval_ref text null
      reason      text not null
      second_operator text null     -- required for 'on'; checked by the procedure, not by SQL

Requirements:
- Written in the same transaction as the change. If the audit insert fails, the change rolls back.
- UPDATE, DELETE and TRUNCATE rejected by triggers (same pattern as the 0011 audit guard).
- Readable by the DB owner only. No client grants.
- A change to the same mode is rejected (old_mode = new_mode).
- Not covered by this design: an audit row for each licence refusal. That is a separate volume and privacy question (D-I32
  open point, §12).

## 7. Protection against shop owners and clients
- The row is global and no client role has any privilege on it (§3).
- No RPC in 7F reads or writes it. The owner and staff apps never ask for it.
- The print functions that read it are security definer, owned by the migration role, with execute revoked from the client
  roles (the 0011 helper pattern).
- Staging test S4 (§11) checks that every client role is refused on the table and on the audit table.

## 8. Interaction with the licence-meta lock
- The switch is outside the R18 lock order. It is a leaf: a switch writer locks only the switch row, then inserts the audit row.
- A print function reads the switch with a plain SELECT, without a lock, in its own statement, after the shared meta lock
  and before the licence state check. It never waits on a switch writer and never adds a lock to an order, agent or job.
- Snapshot: under READ COMMITTED a print statement sees the switch as committed when that statement starts. A switch change
  therefore applies to every print statement that starts after its commit. A transaction that already passed its check
  finishes with the old value. The window is one transaction (milliseconds to seconds).
- Rejected: `FOR SHARE` on the switch row in every print function. It would serialise every claim against a switch writer,
  and it would add a lock to the order-first path with no safety gain.
- Must not happen: a switch writer takes a meta, order, agent or job lock, or a print function takes the switch row lock
  before any other lock. Either would add an edge to the lock order.

## 9. Partial failures
| Failure | Result |
|---|---|
| Switch update fails midway | One transaction: nothing changes |
| Audit insert fails | Change rolls back. Switch unchanged |
| Two operators change the switch at once | Second change waits for the first (row lock). The audit shows both. Recommended: the second must read the audit before writing |
| Row missing | Treated as `off` (D-I32-b) |
| Row unreadable (DB error) | Print statement fails. No print. No state change |
| Break-glass wrote the wrong mode | Reversible by a new audited change |
| Edge function or agent fails | Unaffected by the switch itself. Refusals only come from the gate functions |
| Monitoring query fails | No change to enforcement. Alert gap only |

## 10. Effects on existing queued and claimed jobs
A switch change never deletes, cancels, fails or edits a job by itself. Its effect is only which check a print statement applies.

| Change | Queued jobs (shop not ACTIVE) | Claimed jobs | Printing jobs |
|---|---|---|---|
| Switch to `off` (emergency disable) | Claimable at the next claim. They print | Mark succeeds if the lease is alive. They print | Unaffected |
| Switch to `on` | Held at the next claim. No state change | Mark refuses (Q4 option A or B). Requeued, count restored | Unaffected (mark already succeeded) |
| Switch to `on`, shop ACTIVE | Unaffected | Unaffected | Unaffected |

Hold clock (Q2, M1 not approved): a held job's hold start is derived from the licence history, not from the switch (D-HS).
No M1 timer may run while the switch is `off`, because no job is held then. If M1 is ever approved, its scheduler must
read the switch and must not fail a job while `off`. That requirement is part of the M1 approval, not of this switch.

Refusal under `on` is not a failure: the job stays in the queue and the owner sees a message (Q5).

## 11. Testing without enabling enforcement in production
- Local (no database): unit tests of the mapping and the agent handling (Q4 contract §10), with no switch involved.
- Staging copy only (separate approval): S1 with the switch `off`, the print behaviour matches Chain A exactly (regression
  of existing tests); S2 `on`, refusals as designed; S3 row missing, treated as `off`; S4 every client role refused on both
  tables; S5 audit triggers refuse UPDATE, DELETE and TRUNCATE; S6 an audit insert failure rolls back the switch change;
  S7 emergency disable during an open claim; S8 two-session switch change vs claim (no `40P01`); S9 two operators, second
  change blocked.
- Production, before activation (separate approval): a read-only dry-run function, `print_enforcement_dry_run()`, security
  definer, execute revoked from client roles, returning per shop the number of queued and claimed jobs that would be held
  under `on`. It writes nothing. It sizes the impact before anyone turns enforcement on. It needs a migration approval.
- Optional, stronger: shadow mode, which logs would-refuse decisions without refusing. It needs a log table and its own
  approval. Recommended as an option, not as a requirement (D-I32-d).
- Hosted verification of the table, privileges and function owner is BLOCKED (no hosted access used in this step).

## 12. Decisions needed (D-I32), each with a recommended option

Design approval (D-I32): approve this design, with the choices below. The 7F gate needs this approval (register §15.3).

- **D-I32-a Authority.** Recommended: DB owner only, break-glass, for both on and off, lock-first (O7). Alternative:
  a platform-admin RPC with AAL2, which waits on O6 and AAL2 (register item 5). Consequence of the recommendation: an
  activation needs a person with DB access, which is slow in an incident but keeps the switch out of the app.
- **D-I32-b Missing or invalid row.** Recommended: treated as `off`, with a monitoring query. Alternative: fail closed.
  Consequence: the recommendation can enforce nothing if the row is deleted. The alternative can stop all printing.
- **D-I32-c Two-person activation with `approval_ref`.** Recommended: yes for `on`; single operator for `off`. Consequence:
  activation is slower; emergency disable stays fast.
- **D-I32-d Dry run before activation.** Recommended: yes (§11). Consequence: one more migration function, approved with
  the 7F migration.
- **D-I32-e `enabled_at` column.** Needed by D-HS (hold start clamp). Recommended: yes. Consequence: the switch row carries
  the enforcement start time, which the hold start uses.

Open point, not decided: whether each licence refusal is audited (volume and privacy). Not part of this design.

## 13. Not done
- No table, function, migration, trigger, grant, edge function, agent code, staging run, hosted operation, commit, push or PR.
- The break-glass script is not written. It needs its own approval.
