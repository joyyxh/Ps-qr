# D4: exact proposed scope for the three licence tables in migration 0011

Prepared 2026-11-05. **Proposal only. Awaiting owner approval. Nothing has been edited, applied, executed or committed.** `0011_licence_foundation.sql` is unchanged and still untracked.

Sources: STAGE7_DECISIONS.md §12A.5 (line 479 to 481), §12A.8 (e) and (f), §12B.7 (lines 750 to 753), §12B.8 (lines 762 to 772), decision 3 and O2, and the existing 0011 pattern for append-only tables and guards. §12B.8 says the columns are "to be fixed in review". This scope fixes them as a proposal.

---

## 1. What D4 covers

**Edits to one file, `supabase/migrations/0011_licence_foundation.sql`, in one step:**
1. Three new tables, each with its columns, constraints, indexes, guard trigger and privilege revokes (sections 2 and 3).
2. Header comment edits (section 5).

**Not in D4:**
- The admin RPCs (grant, extend, revoke, replace, `shop_licence_status`) and their cap, counter and replay logic (7C).
- Retention or purge functions. None is approved.
- Grants to `authenticated` or `service_role`. Decision 10 keeps `service_role` revoked.
- Changes to `licence_lock_shop()`, `shop_licence_meta`, the existing guards, or any other migration (0010 and earlier).
- Seed data. The bootstrap admin row is not inserted.

**Depends on, before the edit:** D1 (custom boundaries, no column impact), D3 (ledger holds committed successes only, so no result-code column), D5 (`state_version_after` column). Open questions Q1 to Q4 in section 6 need answers first.

---

## 2. Tables

### 2.1 `public.licence_requests`: replay ledger (committed successes only, per D3)

| Column | Type and constraints | Reason |
|---|---|---|
| `request_id` | `uuid primary key` | Globally unique (§12A.8 e). The lookup key for replay. |
| `action` | `text not null`, check `action in ('grant','extend','revoke','replace')` | A replace writes one row. |
| `shop_id` | `uuid not null references public.shops (id) on delete restrict` | Matches the other licence tables. |
| `payload_hash` | `bytea not null`, check `octet_length(payload_hash) = 32` | SHA-256 of the canonical payload. The definition is open (Q2). |
| `coverage_id` | `uuid references public.licence_coverages (id) on delete restrict` | The coverage the operation created. Null for revoke. |
| `state_version_after` | `bigint not null`, check `state_version_after >= 1` | The version after the one increment (D5). |
| `created_at` | `timestamptz not null default now()` | |

No `result_code` column. Business rejections and authorisation denials write no row (D3, A4).

No extra indexes. The primary key is the replay lookup.

**Guard:** `licence_requests_guard()`, with row and statement triggers that refuse UPDATE, DELETE and TRUNCATE. This follows `licence_audit_log_guard`.

### 2.2 `public.licence_denials`: detailed denial records (capped at 20 per actor per UTC hour by the 7C RPC)

| Column | Type and constraints | Reason |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `actor_user_id` | `uuid not null references auth.users (id) on delete restrict` | §12B.7 "actor UUID". Personal data, 90-day retention proposed (§12B.8). |
| `function_name` | `text not null`, check `char_length(function_name) between 1 and 64` | §12B.7. The names are fixed in implementation review, so the check does not list them (Q7). |
| `denial_reason` | `text not null`, check `char_length(denial_reason) between 1 and 40` | Internal reason, not the public code. The values are set in implementation review (Q3). |
| `request_id` | `uuid` (nullable, not unique) | §12B.7 "if supplied". |
| `occurred_at` | `timestamptz not null default now()` | |

**Indexes:** `licence_denials_actor_time` on `(actor_user_id, occurred_at desc)`. The 7C cap query counts rows here for the current hour.

**Guard:** `licence_denials_guard()`, refusing UPDATE, DELETE and TRUNCATE. Retention is not decided, so no delete path is opened.

The public response for every authorisation failure is still `{ok: false, code: 'forbidden'}`. That is set in the RPCs, not in this table.

### 2.3 `public.licence_denial_windows`: counters (per actor and global, per UTC hour)

| Column | Type and constraints | Reason |
|---|---|---|
| `id` | `bigint generated always as identity primary key` | |
| `scope` | `text not null`, check `scope in ('actor','global')` | |
| `actor_user_id` | `uuid references auth.users (id) on delete restrict` (nullable) | Null for the global row. |
| `window_start` | `timestamptz not null` | Start of a UTC hour. Computed in UTC explicitly, because `date_trunc` on `timestamptz` works in the session time zone. |
| `denial_count` | `integer not null default 0`, check `denial_count >= 0` | Every authorisation denial in the window. |
| `detail_omitted_count` | `integer not null default 0`, check `detail_omitted_count >= 0 and detail_omitted_count <= denial_count` | Denials above the 20-row detail cap (O10). |

Table check: `(scope = 'global' and actor_user_id is null) or (scope = 'actor' and actor_user_id is not null)`.

**Unique indexes** (partial, for `ON CONFLICT`):
- `licence_denial_windows_actor_hour` unique on `(actor_user_id, window_start)` where `scope = 'actor'`.
- `licence_denial_windows_global_hour` unique on `(window_start)` where `scope = 'global'`.

Partial indexes are used rather than `NULLS NOT DISTINCT`, because that needs PostgreSQL 15 and the server version is unverified.

**Guard:** `licence_denial_windows_guard()`, which:
- refuses DELETE and TRUNCATE (no purge is approved, §12B.8);
- refuses any UPDATE that changes `scope`, `actor_user_id` or `window_start`;
- refuses any UPDATE that lowers `denial_count` or `detail_omitted_count`.

Counts can therefore only rise within a window.

---

## 3. Privileges and row security (same pattern as the existing 0011 tables)

- `alter table ... enable row level security` on all three tables. No policies, so client roles are denied.
- `revoke all on` each table from `public`, `anon`, `authenticated` and `service_role`.
- `revoke execute` on the three guard functions from the same four roles.
- No grants are added. The 7C RPCs will be the only writers.

---

## 4. Consequences to note for review

- `licence_coverages.request_id` is already `not null unique`. A retry that skips the ledger lookup would hit that constraint and raise a raw error, not return the stored result. The ledger lookup must run before any insert (see the consistency report, section 8).
- The global counter row is a serialisation point. Every authorisation denial updates it, so denials queue behind one another. That is acceptable for admin traffic, but the owner should know.
- `on delete restrict` on the `auth.users` references means an admin's auth account cannot be deleted while denial or counter rows exist for it. The account-removal process needs review (Q4).

---

## 5. Header comment edits (same file, same step)

These lines of `0011_licence_foundation.sql` are stale. Edit them in the same approved step, so the file does not contradict itself:

| Line | Current | Proposed |
|---|---|---|
| 9 to 15 ("Adds") | Lists the current objects only | Add `licence_requests`, `licence_denials` and `licence_denial_windows` |
| 33 | "state_version is set by the admin RPC, once per request (R2), not by this file." | "state_version is incremented once per committed successful admin operation (D5). It is not incremented on denials, rejections or replays. This file does not set it." |
| 38 to 39 | "Each calls `licence_lock_shop(shop, 'exclusive')` first, then writes its coverage and audit rows." | Add: "On success, also the `licence_requests` row and the state_version increment. Denial counters are written before the meta lock (proposed R18 extension, not yet approved)." |
| 42 (under "Not in this file") | "Licence denials and their cap (7C)." | "Denial RPC logic and cap enforcement (7C)." |

Lines 3 to 6, 19 to 21 and 45 stay as they are.

---

## 6. Questions to answer before the edit

- **Q1 (D3).** Confirm that the ledger holds committed successes only, so there is no result-code column.
- **Q2. Payload hash and actor.** §12B.8 stores `actor_user_id` only where replay prevention needs it. Recommended: do not store it. Hash the caller's auth UID together with the canonical payload. A retry by the same admin matches. A different admin sending the same `request_id` gets a conflict, without the ledger holding any personal data. The canonical payload includes `expected_state_version` and `confirm`, excludes `request_id`, and is defined in review. Owner to confirm.
- **Q3. Denial reason.** §12B.7 says the denial record stores "the denial code", but every public response is `forbidden`. Recommended: store an internal reason, such as "not platform admin", "AAL2 missing" or "not write-permitted". Those values are never returned to a caller. Owner to confirm.
- **Q4. `on delete restrict` on `auth.users`.** Recommended: accept this for now and add the account-removal process to the review list. Owner to confirm.
- **Q5. Retention.** Confirm that counter and denial rows cannot be deleted until a retention decision and a purge approval exist (§12B.8 says retention is open).
- **Q6. Denial row when `request_id` is absent.** Confirm that a denial row is written with a null `request_id`.
- **Q7. Function names.** Confirm that `function_name` is length-checked only, until names are fixed in implementation review.

---

## 7. Next actions (none taken)

1. Owner answers Q1 to Q7.
2. Owner approves this scope, with any changes.
3. One approved edit to `0011_licence_foundation.sql`: the three tables and the header lines in section 5. Nothing else in the file changes.
4. Pre-staging review of 0011 (O2). This is static review of the diff only, and it runs no SQL.
5. Commit, under a separate approval.
6. Apply to staging, under a separate approval (G5 in the D6 plan).

**Not approved by this scope:** editing 0011, applying it, running SQL, running tests, creating the staging project, committing or pushing.
