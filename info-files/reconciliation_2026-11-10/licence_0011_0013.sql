-- 0011: licence foundation (Stage 7, steps 7B-1 and 7B-2, plus the 7C replay ledger and denial tables). FILE ONLY.
--
-- Status: NOT APPLIED. NOT EXECUTED. NOT TESTED.
-- Edited 2026-11-05 under the owner-approved Stage 7C bundles 1 to 3. Pre-staging review (O2) is still required.
-- Written on the origin/main line (migrations 0001-0010). Number 0011 confirmed free on
-- origin/main on 2026-11-01 (owner decision 1). Local main has a different, unmerged
-- 0011_service_options.sql. It is not part of this file (owner decision 2).
--
-- Adds
--   platform_admins      server-side allow-list of QRquick staff who manage licences
--   licence_coverages    append-only periods of access granted to a shop
--   licence_audit_log    append-only record of licence changes
--   is_platform_admin()  true when auth.uid() is an active platform admin
--   shop_licence_state() a shop's licence state at a given instant
--   shop_licence_meta   one row per shop holding state_version (7B-2)
--   licence_lock_shop() internal lock helper: exclusive or shared (7B-2)
--   licence_requests        replay ledger, committed successful admin operations only (D3)
--   licence_denials         detailed denial records, append-only (M3)
--   licence_denial_windows  per-actor and global denial counters per UTC hour (O1)
--
-- Rules enforced here (no browser or RPC can skip them)
--   * A period is half-open: [starts_at, end) where end = least(ends_at, revoked_at).
--   * 7B-1 allows only admin_grant (has ends_at) and lifetime_grant (no ends_at).
--     Paid coverage, licence payments and trials are excluded (C-5, decided 2026-11-01).
--   * No maximum custom duration is set here (owner decision 6, 2026-11-01).
--   * A coverage is inserted unrevoked. The only permitted UPDATE sets revoked_at,
--     revoked_by and revoke_reason together, once, from null. Nothing else changes.
--   * A revocation may not be at or after the natural end (M2). A future period may be
--     cancelled by revoking it before it starts (fix 1). Future coverage of the same shop
--     is kept when a current period is revoked (C-8).
--   * Deletes and TRUNCATE are refused on both append-only tables.
--   * Two ends at the same instant, one of them a revocation, give REVOKED (fix 5).
--   * A lifetime grant in force ranks above admin grants in the basis (item 7).
--   * Coverage periods are contiguous when they touch: [a, b) followed by [b, c).
--   * Every coverage row needs its shop_licence_meta row (foreign key). Meta rows are created
--     only by licence_lock_shop(). A meta row cannot be deleted or truncated, its shop cannot
--     change. state_version is incremented once per committed successful admin operation (D5).
--     The guard below requires each update to add exactly 1. Denials, rejected requests,
--     replays and reads do not increment it. This file does not increment it.
--   * Lock order (R18, design approved 2026-11-01): shop meta row, then order, then agent, then
--     jobs. licence_lock_shop() takes the first lock and takes no order, agent or job lock.
--
-- Rules the 7C RPCs must follow. This file supplies the tables, constraints and guards only.
--   * Every admin and denial RPC checks that transaction_isolation is 'read committed' before
--     any other statement, and raises an internal error otherwise (bundle 1).
--   * Replay ledger: a row is written only for a committed successful operation (D3). Rejections,
--     denials and replays write none. The ledger row is inserted after the business checks and
--     before the operation writes. If the insert conflicts and a re-read then finds no row, the
--     RPC fails with an error and writes nothing (bundle 1).
--   * Denial counters: lock the actor row, then the global row, both before any shop meta lock.
--     The denial path takes no meta, ledger, order, agent or job lock. Write a detail row only
--     while the counters allow it. Omitted details are denial_count minus detail_count (bundle 3).
--     The global detail ceiling (G) is OPEN and is not set in this file.
--
-- Not in this file (each needs its own approval)
--   * Admin write RPCs for grant, extend, revoke and replace (7C). Order (bundle 1): isolation
--     check, authorisation, shape and hash validation, shop existence, licence_lock_shop(shop,
--     'exclusive'), replay lookup, business checks, licence_requests insert, operation writes
--     (coverage and audit), state_version increment, commit.
--   * Print gates in claim and mark (7F). Each calls licence_lock_shop(shop, 'shared') first,
--     before any agent or job lock.
--   * Denial RPC logic and detail-cap enforcement (7C). Printing enforcement (7F).
--   * Paid verification, licence payments and trials (C-5).
--   * Changes to orders, payments or existing functions, triggers, policies and grants.
--   * The bootstrap admin row. No seed data is inserted.

-- ---------- tables ----------

create table public.platform_admins (
  user_id      uuid primary key references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  disabled_at  timestamptz
);

create table public.shop_licence_meta (
  shop_id        uuid primary key references public.shops (id) on delete restrict,
  state_version  bigint not null default 0,
  created_at     timestamptz not null default now(),
  constraint shop_licence_meta_version_nonnegative check (state_version >= 0)
);

create table public.licence_coverages (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete restrict,
  kind           text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid,
  revoke_reason  text,
  reason         text not null,
  created_by     uuid not null,
  created_at     timestamptz not null default now(),
  request_id     uuid not null unique,
  constraint licence_coverages_kind check (kind in ('admin_grant', 'lifetime_grant')),
  constraint licence_coverages_kind_end check (
    (kind = 'lifetime_grant' and ends_at is null)
    or (kind = 'admin_grant' and ends_at is not null)
  ),
  constraint licence_coverages_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint licence_coverages_revocation_whole check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null and revoke_reason is not null)
  ),
  constraint licence_coverages_reason_length check (char_length(btrim(reason)) between 1 and 500),
  constraint licence_coverages_revoke_reason_length check (
    revoke_reason is null or char_length(btrim(revoke_reason)) between 1 and 500
  )
);

create index licence_coverages_shop_start_idx on public.licence_coverages (shop_id, starts_at);

-- Every coverage row needs its shop_licence_meta row (R18 rule 3). The foreign key enforces
-- that the row exists. The lock is taken by licence_lock_shop() before the write.
alter table public.licence_coverages
  add constraint licence_coverages_shop_meta_fkey
  foreign key (shop_id) references public.shop_licence_meta (shop_id) on delete restrict;

create table public.licence_audit_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  actor_user_id  uuid not null,
  shop_id        uuid not null references public.shops (id) on delete restrict,
  action         text not null,
  coverage_id    uuid references public.licence_coverages (id) on delete restrict,
  reason         text not null,
  licence_start  timestamptz,
  licence_end    timestamptz,
  before_state   jsonb,
  after_state    jsonb,
  request_id     uuid not null,
  constraint licence_audit_log_action check (
    action in ('grant', 'extend', 'revoke', 'replace', 'enforcement_change')
  ),
  constraint licence_audit_log_reason_length check (char_length(btrim(reason)) between 1 and 500)
);

create index licence_audit_log_shop_created_idx on public.licence_audit_log (shop_id, created_at);

-- ---------- replay ledger and denial records (Stage 7C bundles 1 and 3) ----------

-- One row per committed successful admin operation (D3). The primary key is the arbiter for
-- request_id, globally unique across shops (bundle 1). Rejections, denials and replays write no
-- row. There is no coverage_id: the created coverage is found through
-- licence_coverages.request_id. target_coverage_id is set only for revoke and replace.
-- There is no actor column. The caller's UID is part of payload_hash only (bundle 1).
create table public.licence_requests (
  request_id           uuid primary key,
  action               text not null,
  shop_id              uuid not null references public.shops (id) on delete restrict,
  payload_hash         bytea not null,
  target_coverage_id   uuid references public.licence_coverages (id) on delete restrict,
  state_version_after  bigint not null,
  created_at           timestamptz not null default now(),
  constraint licence_requests_action check (action in ('grant', 'extend', 'revoke', 'replace')),
  constraint licence_requests_payload_hash_length check (octet_length(payload_hash) = 32),
  constraint licence_requests_state_version_after check (state_version_after >= 1),
  constraint licence_requests_target_by_action check (
    (action in ('revoke', 'replace')) = (target_coverage_id is not null)
  )
);

-- Detailed denial records (M3). actor_user_id is a plain uuid with no foreign key, so an account
-- can be removed (bundle 3). Retention is not decided, and no delete path is approved.
create table public.licence_denials (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid not null,
  function_name  text not null,
  denial_reason  text not null,
  request_id     uuid,
  occurred_at    timestamptz not null default now(),
  constraint licence_denials_function_name_length check (char_length(function_name) between 1 and 64),
  constraint licence_denials_denial_reason_length check (char_length(denial_reason) between 1 and 40)
);

create index licence_denials_actor_time on public.licence_denials (actor_user_id, occurred_at desc);

-- Denial counters (O1). A scope 'actor' row counts one actor's authorisation denials in one UTC
-- hour. A scope 'global' row counts all authorisation denials in one UTC hour. denial_count counts
-- every denial. detail_count counts the licence_denials rows written for that window. Omitted
-- details are denial_count minus detail_count and are not stored (bundle 3). window_start is the
-- start of a UTC hour, computed by the RPC as date_trunc('hour', now() at time zone 'UTC') at time
-- zone 'UTC'. The lock order is actor row, then global row (see the rules above).
create table public.licence_denial_windows (
  id             bigint generated always as identity primary key,
  scope          text not null,
  actor_user_id  uuid,
  window_start   timestamptz not null,
  denial_count   integer not null default 0,
  detail_count   integer not null default 0,
  constraint licence_denial_windows_scope check (scope in ('actor', 'global')),
  constraint licence_denial_windows_scope_actor check (
    (scope = 'global' and actor_user_id is null)
    or (scope = 'actor' and actor_user_id is not null)
  ),
  constraint licence_denial_windows_denial_count_nonnegative check (denial_count >= 0),
  constraint licence_denial_windows_detail_count_range check (
    detail_count >= 0 and detail_count <= denial_count
  )
);

-- Partial unique indexes, used as ON CONFLICT targets. NULLS NOT DISTINCT is not used, because
-- it needs PostgreSQL 15 and the server version is unverified.
create unique index licence_denial_windows_actor_hour
  on public.licence_denial_windows (actor_user_id, window_start)
  where scope = 'actor';

create unique index licence_denial_windows_global_hour
  on public.licence_denial_windows (window_start)
  where scope = 'global';

-- ---------- append-only guards ----------

create or replace function public.licence_coverages_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_revocation_fields text[] := array['revoked_at', 'revoked_by', 'revoke_reason'];
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'licence_coverages is append-only: % is not allowed', tg_op;
  end if;

  if tg_op = 'INSERT' then
    if new.revoked_at is not null or new.revoked_by is not null or new.revoke_reason is not null then
      raise exception 'a coverage cannot be inserted already revoked';
    end if;
    return new;
  end if;

  -- UPDATE. Runs after the row lock, so a second revocation sees the first one here.
  if old.revoked_at is not null then
    raise exception 'coverage % is already revoked', old.id;
  end if;

  if new.revoked_at is null or new.revoked_by is null or new.revoke_reason is null then
    raise exception 'the only permitted update sets revoked_at, revoked_by and revoke_reason together';
  end if;

  if (to_jsonb(new) - v_revocation_fields) is distinct from (to_jsonb(old) - v_revocation_fields) then
    raise exception 'only the revocation fields may change on a coverage';
  end if;

  if new.revoked_at < old.created_at or new.revoked_at > clock_timestamp() then
    raise exception 'revoked_at must be between the coverage creation time and now';
  end if;

  if old.ends_at is not null and new.revoked_at >= old.ends_at then
    raise exception 'a coverage cannot be revoked at or after its natural end';
  end if;

  return new;
end;
$$;

create or replace function public.licence_audit_log_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'licence_audit_log is append-only: % is not allowed', tg_op;
end;
$$;

create trigger licence_coverages_guard_rows
  before insert or update or delete on public.licence_coverages
  for each row execute function public.licence_coverages_guard();

create trigger licence_coverages_guard_truncate
  before truncate on public.licence_coverages
  for each statement execute function public.licence_coverages_guard();

create trigger licence_audit_log_guard_rows
  before update or delete on public.licence_audit_log
  for each row execute function public.licence_audit_log_guard();

create trigger licence_audit_log_guard_truncate
  before truncate on public.licence_audit_log
  for each statement execute function public.licence_audit_log_guard();

-- ---------- shop_licence_meta guard (7B-2) ----------

create or replace function public.shop_licence_meta_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'shop_licence_meta is not deletable: % is not allowed', tg_op;
  end if;

  -- UPDATE. The shop and created_at cannot change. Each update adds exactly 1 to state_version (D5).
  -- The RPC performs one update per committed operation. This guard checks each update, not the
  -- number of updates in a transaction.
  if new.shop_id is distinct from old.shop_id then
    raise exception 'shop_licence_meta.shop_id cannot change';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'shop_licence_meta.created_at cannot change';
  end if;

  if new.state_version is distinct from old.state_version + 1 then
    raise exception 'shop_licence_meta.state_version must increase by exactly 1 per update';
  end if;

  return new;
end;
$$;

create trigger shop_licence_meta_guard_rows
  before update or delete on public.shop_licence_meta
  for each row execute function public.shop_licence_meta_guard();

create trigger shop_licence_meta_guard_truncate
  before truncate on public.shop_licence_meta
  for each statement execute function public.shop_licence_meta_guard();

-- ---------- guards for the replay ledger and denial records (7C bundles 1 and 3) ----------

create or replace function public.licence_requests_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'licence_requests is append-only: % is not allowed', tg_op;
end;
$$;

create or replace function public.licence_denials_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'licence_denials is append-only: % is not allowed', tg_op;
end;
$$;

create or replace function public.licence_denial_windows_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'licence_denial_windows is not deletable: % is not allowed', tg_op;
  end if;

  -- UPDATE. Identity columns cannot change. Both counts can only rise.
  if new.scope is distinct from old.scope
     or new.actor_user_id is distinct from old.actor_user_id
     or new.window_start is distinct from old.window_start then
    raise exception 'licence_denial_windows identity columns cannot change';
  end if;

  if new.denial_count < old.denial_count or new.detail_count < old.detail_count then
    raise exception 'licence_denial_windows counts cannot decrease';
  end if;

  return new;
end;
$$;

create trigger licence_requests_guard_rows
  before update or delete on public.licence_requests
  for each row execute function public.licence_requests_guard();

create trigger licence_requests_guard_truncate
  before truncate on public.licence_requests
  for each statement execute function public.licence_requests_guard();

create trigger licence_denials_guard_rows
  before update or delete on public.licence_denials
  for each row execute function public.licence_denials_guard();

create trigger licence_denials_guard_truncate
  before truncate on public.licence_denials
  for each statement execute function public.licence_denials_guard();

create trigger licence_denial_windows_guard_rows
  before update or delete on public.licence_denial_windows
  for each row execute function public.licence_denial_windows_guard();

create trigger licence_denial_windows_guard_truncate
  before truncate on public.licence_denial_windows
  for each statement execute function public.licence_denial_windows_guard();

-- ---------- helpers ----------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.platform_admins a
     where a.user_id = auth.uid()
       and a.disabled_at is null
  );
$$;

-- Returns one row for a shop at p_at.
--   state        ACTIVE | SCHEDULED | REVOKED | EXPIRED | NONE
--   basis        lifetime_grant | admin_grant when ACTIVE, otherwise null
--   access_until end of the contiguous access run (exclusive); null when open-ended or not ACTIVE
--   next_start   earliest valid future start; set only when SCHEDULED
-- Precedence: ACTIVE, then SCHEDULED, then the latest-ending valid group (REVOKED if any
-- coverage in it ended by revocation, otherwise EXPIRED), then NONE.
create or replace function public.shop_licence_state(
  p_shop_id uuid,
  p_at      timestamptz default now()
)
returns table (
  state         text,
  basis         text,
  access_until  timestamptz,
  next_start    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cur         timestamptz;
  v_step        timestamptz;
  v_next        timestamptz := null;
  v_last_end    timestamptz;
  v_state       text;
  v_basis       text := null;
  v_until       timestamptz := null;
  v_flag        boolean;
begin
  if p_shop_id is null or p_at is null then
    raise exception 'shop_id and at are required';
  end if;

  -- The period that covers p_at (starts at or before it, effective end after it).
  select max(s.end_eff) into v_cur
    from (
      select c.starts_at,
             least(coalesce(c.ends_at, 'infinity'::timestamptz),
                   coalesce(c.revoked_at, 'infinity'::timestamptz)) as end_eff
        from public.licence_coverages c
       where c.shop_id = p_shop_id
    ) s
   where s.starts_at <= p_at
     and s.end_eff > p_at;

  if v_cur is not null then
    -- Extend through touching periods. A period that starts at or before the current end
    -- and ends after it continues the run. Each step moves v_cur forward, so this ends.
    loop
      exit when v_cur = 'infinity'::timestamptz;

      select max(s.end_eff) into v_step
        from (
          select c.starts_at,
                 least(coalesce(c.ends_at, 'infinity'::timestamptz),
                       coalesce(c.revoked_at, 'infinity'::timestamptz)) as end_eff
            from public.licence_coverages c
           where c.shop_id = p_shop_id
        ) s
       where s.starts_at <= v_cur
         and s.end_eff > v_cur;

      exit when v_step is null;
      v_cur := v_step;
    end loop;

    v_state := 'ACTIVE';
    v_until := case when v_cur = 'infinity'::timestamptz then null else v_cur end;

    -- Lifetime ranks above admin grants (item 7).
    select exists (
      select 1
        from public.licence_coverages c
       where c.shop_id = p_shop_id
         and c.kind = 'lifetime_grant'
         and c.starts_at <= p_at
         and least(coalesce(c.ends_at, 'infinity'::timestamptz),
                   coalesce(c.revoked_at, 'infinity'::timestamptz)) > p_at
    ) into v_flag;
    v_basis := case when v_flag then 'lifetime_grant' else 'admin_grant' end;
  else
    -- Not active at p_at. A valid future start makes the state SCHEDULED.
    select min(c.starts_at) into v_next
      from public.licence_coverages c
     where c.shop_id = p_shop_id
       and c.starts_at > p_at
       and least(coalesce(c.ends_at, 'infinity'::timestamptz),
                 coalesce(c.revoked_at, 'infinity'::timestamptz)) > c.starts_at;

    if v_next is not null then
      v_state := 'SCHEDULED';
    else
      -- Every valid period has ended, or none exists.
      select max(least(coalesce(c.ends_at, 'infinity'::timestamptz),
                       coalesce(c.revoked_at, 'infinity'::timestamptz))) into v_last_end
        from public.licence_coverages c
       where c.shop_id = p_shop_id
         and least(coalesce(c.ends_at, 'infinity'::timestamptz),
                   coalesce(c.revoked_at, 'infinity'::timestamptz)) > c.starts_at;

      if v_last_end is null then
        v_state := 'NONE';
      else
        -- Same-instant rule (fix 5): a revocation that ends the latest group wins.
        select exists (
          select 1
            from public.licence_coverages c
           where c.shop_id = p_shop_id
             and c.revoked_at is not null
             and c.revoked_at = v_last_end
             and c.revoked_at > c.starts_at
        ) into v_flag;
        v_state := case when v_flag then 'REVOKED' else 'EXPIRED' end;
      end if;
    end if;
  end if;

  return query select v_state, v_basis, v_until, v_next;
end;
$$;

-- ---------- lock helper (7B-2) ----------

-- Takes the shop's meta row lock, creating the row first if it is missing (R18).
--   p_mode 'exclusive'  admin licence writes (7C): insert if missing, then FOR UPDATE.
--   p_mode 'shared'     print gates (7F): insert if missing, then FOR SHARE.
-- Takes no order, agent or job lock. Callers take this lock before any of those, and before
-- writing a coverage row. Returns the current state_version.
-- Assumes READ COMMITTED (the default). Under REPEATABLE READ or stricter, the lock select can
-- miss a row that a concurrent transaction committed, and the helper then raises an error.
-- Do not raise the isolation level for callers of this helper. The 7C RPCs enforce READ COMMITTED
-- on entry (bundle 1).
create or replace function public.licence_lock_shop(
  p_shop_id uuid,
  p_mode    text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version bigint;
begin
  if p_shop_id is null or p_mode is null then
    raise exception 'shop_id and mode are required';
  end if;

  if p_mode not in ('exclusive', 'shared') then
    raise exception 'mode must be exclusive or shared';
  end if;

  -- A concurrent first insert for the same shop makes this wait, then do nothing.
  insert into public.shop_licence_meta (shop_id)
  values (p_shop_id)
  on conflict (shop_id) do nothing;

  if p_mode = 'exclusive' then
    select m.state_version into v_version
      from public.shop_licence_meta m
     where m.shop_id = p_shop_id
       for update;
  else
    select m.state_version into v_version
      from public.shop_licence_meta m
     where m.shop_id = p_shop_id
       for share;
  end if;

  if v_version is null then
    raise exception 'shop_licence_meta row for shop % could not be locked', p_shop_id;
  end if;

  return v_version;
end;
$$;

-- ---------- privileges ----------

alter table public.platform_admins   enable row level security;
alter table public.licence_coverages enable row level security;
alter table public.licence_audit_log enable row level security;
alter table public.shop_licence_meta enable row level security;
alter table public.licence_requests  enable row level security;
alter table public.licence_denials   enable row level security;
alter table public.licence_denial_windows enable row level security;
-- No policies on purpose. Browsers, anon and authenticated read and write nothing here.
-- Service role is revoked as well, so only functions owned by the migration role touch
-- these tables. This differs from 0010, which leaves service_role alone.
revoke all on public.platform_admins, public.licence_coverages, public.licence_audit_log,
  public.shop_licence_meta, public.licence_requests, public.licence_denials,
  public.licence_denial_windows
  from public, anon, authenticated, service_role;

revoke execute on function public.is_platform_admin()
  from public, anon, authenticated, service_role;
revoke execute on function public.shop_licence_state(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.licence_coverages_guard()
  from public, anon, authenticated, service_role;
revoke execute on function public.licence_audit_log_guard()
  from public, anon, authenticated, service_role;

revoke execute on function public.licence_lock_shop(uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.shop_licence_meta_guard()
  from public, anon, authenticated, service_role;
revoke execute on function public.licence_requests_guard(),
  public.licence_denials_guard(), public.licence_denial_windows_guard()
  from public, anon, authenticated, service_role;

-- End of 0011 (7B-1, 7B-2 and the 7C ledger and denial tables). Not applied.
-- 0012: licence admin RPCs (Stage 7C). FILE ONLY. NOT APPLIED. NOT RUN ON ANY SUPABASE PROJECT.
--
-- Status: implementation written 2026-11-07 under the Stage 7C implementation task. Tested only on a
-- throwaway local PostgreSQL 16 cluster (supabase/tests/licence_7c). Hosted AAL2 verification and
-- staging concurrency checks are NOT done (see the 7C implementation report).
--
-- Correction pass, 2026-11-07 (STAGE7_DECISIONS.md, dated 2026-11-07 notes): the P-07 overlap rule is
-- removed; enumerated tokens match exactly after NFC; one_month and one_year reject future starts;
-- the staging backdating window reads licence_config (server-side, no client access); shop_licence_status
-- is added (decision D, owner only). Migration numbering is reported separately (0011 and 0012 also
-- exist on local main, unmerged). Nothing is renamed.
--
-- Depends on 0011_licence_foundation.sql, which is unchanged by this file.
--
-- Adds (all SECURITY DEFINER, fixed search_path, schema-qualified)
--   licence_admin_grant(p_request_id uuid, p_payload jsonb)    EXECUTE: authenticated only
--   licence_admin_extend(p_request_id uuid, p_payload jsonb)   EXECUTE: authenticated only
--   licence_admin_revoke(p_request_id uuid, p_payload jsonb)   EXECUTE: authenticated only
--   licence_admin_replace(p_request_id uuid, p_payload jsonb)  EXECUTE: authenticated only
--   shop_licence_status(p_shop_id uuid)                        EXECUTE: authenticated only; owner only
--   table licence_config: server-side settings, RLS on, no client privilege. Row
--     'staging_backdate_window_days' is inserted by the staging operator only. Absent means no window is
--     configured, and then every backdate is refused as backdate_window_exceeded (fail closed, 2026-11-08).
--   internal helpers (no client EXECUTE): licence_admin_core, licence_admin_deny, licence_admin_reject,
--   licence_admin_allowed_keys, licence_admin_plan_grant, licence_admin_overlaps, licence_calendar_end,
--   licence_canon_text, licence_hash_*, licence_parse_instant, licence_try_uuid, licence_backdate_window_days.
--
-- Each RPC follows §12A.17 J (order of steps):
--   1 isolation check (READ COMMITTED, raises if not)
--   2 authorisation: caller UID, is_platform_admin(), aal2. Failure is a committed
--     {ok:false, code:'forbidden'} after the denial counters (and any allowed detail row) are written.
--   3 shape validation, normalisation and the replay hash (§12A.17 A). Rejections write nothing.
--   4 shop existence
--   5 licence_lock_shop(shop, 'exclusive') returns the locked version V
--   6 replay lookup (same hash: stored result; different hash: committed conflict)
--   7 expected_state_version check against V (stale: committed rejection)
--   8 business checks (confirm, reason, grant rules, overlap, target, natural end)
--   9 state_version_after = V + 1, computed before the ledger insert
--   10 licence_requests insert (ON CONFLICT (request_id) DO NOTHING, then re-read)
--   11 operation writes (coverage rows and audit rows)
--   12 one update of shop_licence_meta to V + 1
--   13 commit (the caller's transaction)
--
-- Denial counters (§12A.17 F, G): actor counter row, then global counter row, both before any shop
-- lock. The denial path takes no meta, ledger, order, agent or job lock. Counter and detail writes
-- have no exception handler, so an unexpected failure rolls back and raises (C2). A detail row is
-- written only while both caps allow it. Both caps are read from the locked counter rows.
--   Per-actor cap: 20 detail rows per actor per UTC hour (existing decision).
--   Global cap: 1,000 detail rows per UTC hour. PROVISIONAL staging and engineering default only
--   (§12A.17 E). The production value is OPEN. It is not a production approval.
--
-- Audit labels (correction pass, 2026-11-07). Replace writes two audit rows, and both use the action
-- 'replace'. The revocation row carries the target's before and after state. The new-coverage row carries
-- only the new coverage. Plain Revoke writes action 'revoke'.
--
-- Hash contract (§12A.17 A, domain 'qrquick-licence-request-v1'): fields are type-tag (1 byte),
-- length (4 bytes, big-endian), value. Tags: 0x00 null, 0x01 boolean, 0x02 integer (ASCII decimal),
-- 0x03 text (UTF-8 after NFC and space-only trimming), 0x04 uuid (16 bytes), 0x05 timestamp (int64
-- microseconds since 1970-01-01T00:00:00Z). The digest is SHA-256 over the concatenation.
-- request_id is not hashed. Unknown payload keys are rejected before hashing.

-- ---------- canonical encoding helpers ----------

create or replace function public.licence_canon_text(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select btrim(normalize(p_text, NFC), ' ')
$$;

create or replace function public.licence_hash_field(p_tag integer, p_value bytea)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select decode(lpad(to_hex(p_tag), 2, '0'), 'hex')
         || int4send(octet_length(p_value))
         || p_value
$$;

create or replace function public.licence_hash_null()
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select public.licence_hash_field(0, '\x'::bytea)
$$;

create or replace function public.licence_hash_bool(p_value boolean)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_value is null then public.licence_hash_null()
              else public.licence_hash_field(1, case when p_value then '\x01'::bytea else '\x00'::bytea end)
         end
$$;

create or replace function public.licence_hash_int(p_value bigint)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_value is null then public.licence_hash_null()
              else public.licence_hash_field(2, convert_to(p_value::text, 'UTF8'))
         end
$$;

create or replace function public.licence_hash_text(p_value text)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_value is null then public.licence_hash_null()
              else public.licence_hash_field(3, convert_to(p_value, 'UTF8'))
         end
$$;

create or replace function public.licence_hash_uuid(p_value uuid)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_value is null then public.licence_hash_null()
              else public.licence_hash_field(4, uuid_send(p_value))
         end
$$;

create or replace function public.licence_hash_ts(p_value timestamptz)
returns bytea
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_value is null then public.licence_hash_null()
              else public.licence_hash_field(
                     5,
                     int8send((extract(epoch from p_value) * 1000000)::bigint))
         end
$$;

-- Parses a client timestamp or date-only text. Returns null when the text is not accepted.
--   Date-only YYYY-MM-DD: 00:00 Asia/Kolkata on that date (§12A.17 B, A.5).
--   Timestamp: ISO 8601 with an explicit offset (Z or +hh:mm), 0 to 6 fractional digits.
--   More than six fractional digits, a missing offset or an impossible date gives null.
create or replace function public.licence_parse_instant(p_text text)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog, public
as $$
begin
  if p_text is null then
    return null;
  end if;

  if p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return ((p_text || ' 00:00:00')::timestamp) at time zone 'Asia/Kolkata';
  end if;

  if p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return p_text::timestamptz;
  end if;

  return null;
exception
  when others then
    return null;
end;
$$;

-- Parses a UUID text in canonical 8-4-4-4-12 hex form. Returns null when it is not one.
create or replace function public.licence_try_uuid(p_text text)
returns uuid
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
           when p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then p_text::uuid
           else null
         end
$$;

-- Calendar end for one calendar month or year, keeping the start's clock time in Asia/Kolkata.
-- Month-end dates clamp (§12A.6, O5, A2).
create or replace function public.licence_calendar_end(p_start timestamptz, p_unit text)
returns timestamptz
language sql
stable
set search_path = pg_catalog, public
as $$
  select case p_unit
           when 'month' then ((p_start at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata'
           when 'year'  then ((p_start at time zone 'Asia/Kolkata') + interval '1 year') at time zone 'Asia/Kolkata'
         end
$$;

-- Overlap test for same-kind non-revoked coverages (§12A.6, O4). Half-open: [a1, b1) and [a2, b2)
-- overlap if and only if a1 < b2 and a2 < b1. A null end means no end (lifetime) and is treated as
-- infinity. p_exclude names a coverage to leave out (the replace target).
create or replace function public.licence_admin_overlaps(
  p_shop_id  uuid,
  p_kind     text,
  p_start    timestamptz,
  p_end      timestamptz,
  p_exclude  uuid
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.licence_coverages c
     where c.shop_id = p_shop_id
       and c.kind = p_kind
       and c.revoked_at is null
       and (p_exclude is null or c.id <> p_exclude)
       and p_start < coalesce(c.ends_at, 'infinity'::timestamptz)
       and c.starts_at < coalesce(p_end, 'infinity'::timestamptz)
  )
$$;

-- Allowed payload keys for each action (§12A.17 A.2 and A.3). request_id is never a payload key.
-- Anything else is an unknown field and is rejected before hashing (A.4).
create or replace function public.licence_admin_allowed_keys(p_action text)
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_action
           when 'grant'   then array['shop_id','expected_state_version','confirm','reason',
                                     'grant_kind','start','end','backdate_confirm']
           when 'extend'  then array['shop_id','expected_state_version','confirm','reason',
                                     'extension_unit']
           when 'revoke'  then array['shop_id','expected_state_version','confirm','reason',
                                     'target_coverage_id']
           when 'replace' then array['shop_id','expected_state_version','confirm','reason',
                                     'target_coverage_id','grant_kind','start','end','backdate_confirm']
         end
$$;

-- A committed rejection with a specific code. Writes nothing (§12A.8 (ii)).
create or replace function public.licence_admin_reject(p_code text)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object('ok', false, 'code', p_code)
$$;

-- ---------- denial path (§12B.7, §12A.17 F and G) ----------

-- Writes the denial counters and, while the caps allow, one detail row. Returns the committed
-- forbidden result. There is no exception handler: an unexpected failure rolls back and raises (C2).
-- p_actor null means the caller has no usable UID: only the global counter is incremented (G.5).
create or replace function public.licence_admin_deny(
  p_function_name  text,
  p_denial_reason  text,
  p_request_id     uuid,
  p_actor          uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  -- PROVISIONAL caps. The 20 per actor is the existing decision. The 1,000 global per UTC hour is a
  -- staging and engineering default (§12A.17 E). The production value is OPEN.
  c_actor_detail_cap  constant integer := 20;
  c_global_detail_cap constant integer := 1000;
  v_hour              timestamptz := date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC';
  v_actor_id          bigint;
  v_actor_details     integer := 0;
  v_global_id         bigint;
  v_global_details    integer;
begin
  -- Actor counter row first (lock order step 1), then the global row (step 2).
  if p_actor is not null then
    insert into public.licence_denial_windows (scope, actor_user_id, window_start, denial_count, detail_count)
    values ('actor', p_actor, v_hour, 1, 0)
    on conflict (actor_user_id, window_start) where scope = 'actor'
    do update set denial_count = public.licence_denial_windows.denial_count + 1
    returning id, detail_count into v_actor_id, v_actor_details;
  end if;

  insert into public.licence_denial_windows (scope, actor_user_id, window_start, denial_count, detail_count)
  values ('global', null, v_hour, 1, 0)
  on conflict (window_start) where scope = 'global'
  do update set denial_count = public.licence_denial_windows.denial_count + 1
  returning id, detail_count into v_global_id, v_global_details;

  -- Caps use the counts read from the locked rows (G.6). A detail row needs an actor (its
  -- actor_user_id is not null) and room under both caps.
  if p_actor is not null
     and v_actor_details < c_actor_detail_cap
     and v_global_details < c_global_detail_cap then
    insert into public.licence_denials (actor_user_id, function_name, denial_reason, request_id)
    values (p_actor, p_function_name, p_denial_reason, p_request_id);

    update public.licence_denial_windows
       set detail_count = detail_count + 1
     where id = v_actor_id;

    update public.licence_denial_windows
       set detail_count = detail_count + 1
     where id = v_global_id;
  end if;

  return jsonb_build_object('ok', false, 'code', 'forbidden');
end;
$$;

-- Canonical bytes of the replay hash (§12A.17 A.1 to A.6). Inputs must already be normalised.
-- Only the fields in the action's list are encoded. The common fields come first, in fixed order.
-- The digest is sha256 over these bytes (computed by the caller). request_id is never an input.
create or replace function public.licence_admin_canonical_bytes(
  p_action    text,
  p_uid       uuid,
  p_shop_id   uuid,
  p_expected  bigint,
  p_confirm   boolean,
  p_reason    text,
  p_kind      text,
  p_unit      text,
  p_target    uuid,
  p_start     timestamptz,
  p_end       timestamptz,
  p_backdate  boolean
)
returns bytea
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_bytes bytea;
begin
  v_bytes := public.licence_hash_text('qrquick-licence-request-v1')
          || public.licence_hash_uuid(p_uid)
          || public.licence_hash_uuid(p_shop_id)
          || public.licence_hash_text(p_action)
          || public.licence_hash_int(p_expected)
          || public.licence_hash_bool(p_confirm)
          || public.licence_hash_text(p_reason);

  if p_action = 'grant' then
    v_bytes := v_bytes
            || public.licence_hash_text(p_kind)
            || public.licence_hash_ts(p_start)
            || public.licence_hash_ts(p_end)
            || public.licence_hash_bool(p_backdate);
  elsif p_action = 'extend' then
    v_bytes := v_bytes || public.licence_hash_text(p_unit);
  elsif p_action = 'revoke' then
    v_bytes := v_bytes || public.licence_hash_uuid(p_target);
  elsif p_action = 'replace' then
    v_bytes := v_bytes
            || public.licence_hash_uuid(p_target)
            || public.licence_hash_text(p_kind)
            || public.licence_hash_ts(p_start)
            || public.licence_hash_ts(p_end)
            || public.licence_hash_bool(p_backdate);
  else
    raise exception 'unknown action % for the replay hash', p_action;
  end if;

  return v_bytes;
end;
$$;

-- ---------- shared admin core (steps 1 to 3 here; steps 4 to 13 below) ----------

-- Called only by the four RPCs below. Not granted to any client role.
create or replace function public.licence_admin_core(
  p_action      text,
  p_request_id  uuid,
  p_payload     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_iso        text := current_setting('transaction_isolation');
  v_fn         text := 'licence_admin_' || p_action;
  v_uid        uuid;
  v_aal        text;
  v_allowed    text[] := public.licence_admin_allowed_keys(p_action);
  v_shop       uuid;
  v_expected   bigint;
  v_confirm    boolean;
  v_reason     text;
  v_kind       text;
  v_unit       text;
  v_target     uuid;
  v_start_in   timestamptz;
  v_end_in     timestamptz;
  v_backdate   boolean;
  v_bytes      bytea;
  v_hash       bytea;
  v_ver        bigint;
  v_next_ver   bigint;
  v_now        timestamptz;
  v_rows       integer;
  v_req        public.licence_requests%rowtype;
  v_plan_code  text;
  v_cov_kind   text;
  v_start      timestamptz;
  v_end        timestamptz;
  v_target_row public.licence_coverages%rowtype;
  v_revoked    public.licence_coverages%rowtype;
  v_new_cov    public.licence_coverages%rowtype;
  v_latest_end timestamptz;
begin
  -- Step 1: isolation. Raises, so nothing is committed.
  if v_iso <> 'read committed' then
    raise exception 'licence admin RPCs require READ COMMITTED (session is %)', v_iso;
  end if;

  -- Step 2: authorisation. A failure is a committed forbidden, after the denial records (§12A.8 (i)).
  -- A caller with no readable UID is counted in the global counter only (§12A.17 G.5).
  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  if v_uid is null then
    return public.licence_admin_deny(v_fn, 'no_actor', p_request_id, null);
  end if;

  if not public.is_platform_admin() then
    return public.licence_admin_deny(v_fn, 'not_platform_admin', p_request_id, v_uid);
  end if;

  -- Missing, unreadable or insufficient aal fails closed (§12A.17 D).
  begin
    v_aal := auth.jwt() ->> 'aal';
  exception when others then
    v_aal := null;
  end;

  if v_aal is distinct from 'aal2' then
    return public.licence_admin_deny(v_fn, 'aal_not_aal2', p_request_id, v_uid);
  end if;

  -- Step 3: shape, normalisation and hash. Every rejection here writes nothing.
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return public.licence_admin_reject('invalid_request');
  end if;

  -- Unknown fields are rejected, never ignored (§12A.17 A.4). This includes client-supplied
  -- hashes, UIDs and request_id inside the payload.
  if exists (
    select 1
      from jsonb_object_keys(p_payload) as k(name)
     where k.name <> all (v_allowed)
  ) then
    return public.licence_admin_reject('unknown_field');
  end if;

  if coalesce(jsonb_typeof(p_payload -> 'shop_id'), '') <> 'string'
     or public.licence_try_uuid(p_payload ->> 'shop_id') is null then
    return public.licence_admin_reject('invalid_request');
  end if;
  v_shop := public.licence_try_uuid(p_payload ->> 'shop_id');

  -- Integer without sign or leading zeros (A.5). jsonb keeps a JSON number in canonical form, so 1e3
  -- arrives here as 1000 and is accepted as 1000. A value with a decimal point, such as 5.0, is rejected.
  if coalesce(jsonb_typeof(p_payload -> 'expected_state_version'), '') <> 'number'
     or (p_payload -> 'expected_state_version')::text !~ '^(0|[1-9][0-9]{0,17})$' then
    return public.licence_admin_reject('invalid_request');
  end if;
  v_expected := ((p_payload -> 'expected_state_version')::text)::bigint;

  -- Confirmation is checked here, before the replay lookup. confirm=false writes no ledger row and is
  -- never a replay conflict (§12A.8 (ii); STAGE7_DECISIONS.md §12B.11, note of 2026-11-07).
  if coalesce(jsonb_typeof(p_payload -> 'confirm'), '') <> 'boolean' then
    return public.licence_admin_reject('invalid_request');
  end if;
  v_confirm := (p_payload ->> 'confirm')::boolean;
  if not v_confirm then
    return public.licence_admin_reject('not_confirmed');
  end if;

  -- Reason: NFC, space-only trimming, 1 to 500 code points (§12A.17 S.2, A.5).
  if coalesce(jsonb_typeof(p_payload -> 'reason'), '') <> 'string' then
    return public.licence_admin_reject('invalid_reason');
  end if;
  v_reason := public.licence_canon_text(p_payload ->> 'reason');
  if char_length(v_reason) < 1 or char_length(v_reason) > 500 then
    return public.licence_admin_reject('invalid_reason');
  end if;

  if p_action in ('grant', 'replace') then
    if coalesce(jsonb_typeof(p_payload -> 'grant_kind'), '') <> 'string' then
      return public.licence_admin_reject('invalid_grant_kind');
    end if;
    -- Enumerated text: NFC only, never trimmed. It must equal an allowed token exactly (§12A.17 A.5).
    v_kind := normalize(p_payload ->> 'grant_kind', NFC);
    if v_kind not in ('one_month', 'one_year', 'custom', 'lifetime') then
      return public.licence_admin_reject('invalid_grant_kind');
    end if;
  end if;

  if p_action = 'extend' then
    if coalesce(jsonb_typeof(p_payload -> 'extension_unit'), '') <> 'string' then
      return public.licence_admin_reject('invalid_extension_unit');
    end if;
    v_unit := normalize(p_payload ->> 'extension_unit', NFC);
    if v_unit not in ('month', 'year') then
      return public.licence_admin_reject('invalid_extension_unit');
    end if;
  end if;

  if p_action in ('revoke', 'replace') then
    if coalesce(jsonb_typeof(p_payload -> 'target_coverage_id'), '') <> 'string'
       or public.licence_try_uuid(p_payload ->> 'target_coverage_id') is null then
      return public.licence_admin_reject('invalid_request');
    end if;
    v_target := public.licence_try_uuid(p_payload ->> 'target_coverage_id');
  end if;

  if p_action in ('grant', 'replace') then
    -- start and end: JSON null or absent means not supplied. Otherwise a date-only or offset timestamp.
    if coalesce(jsonb_typeof(p_payload -> 'start'), 'null') = 'string' then
      v_start_in := public.licence_parse_instant(p_payload ->> 'start');
      if v_start_in is null then
        return public.licence_admin_reject('invalid_timestamp');
      end if;
    elsif coalesce(jsonb_typeof(p_payload -> 'start'), 'null') <> 'null' then
      return public.licence_admin_reject('invalid_timestamp');
    end if;

    if coalesce(jsonb_typeof(p_payload -> 'end'), 'null') = 'string' then
      v_end_in := public.licence_parse_instant(p_payload ->> 'end');
      if v_end_in is null then
        return public.licence_admin_reject('invalid_timestamp');
      end if;
    elsif coalesce(jsonb_typeof(p_payload -> 'end'), 'null') <> 'null' then
      return public.licence_admin_reject('invalid_timestamp');
    end if;

    if coalesce(jsonb_typeof(p_payload -> 'backdate_confirm'), 'null') = 'boolean' then
      v_backdate := (p_payload ->> 'backdate_confirm')::boolean;
    elsif coalesce(jsonb_typeof(p_payload -> 'backdate_confirm'), 'null') <> 'null' then
      return public.licence_admin_reject('invalid_request');
    end if;
  end if;

  -- Replay hash (§12A.17 A). The caller's UID comes from auth.uid() only. Inputs are normalised above.
  v_bytes := public.licence_admin_canonical_bytes(
    p_action, v_uid, v_shop, v_expected, v_confirm, v_reason,
    v_kind, v_unit, v_target, v_start_in, v_end_in, v_backdate);
  v_hash := sha256(v_bytes);

  -- Step 4: shop existence. Nothing is locked yet.
  if not exists (select 1 from public.shops s where s.id = v_shop) then
    return public.licence_admin_reject('shop_not_found');
  end if;

  -- Step 5: exclusive shop meta lock. Returns the locked current version V.
  v_ver := public.licence_lock_shop(v_shop, 'exclusive');

  -- Step 6: replay lookup. It runs after the lock, so a committed winner for this shop is visible.
  -- Same hash is a replay. A different hash is a committed conflict, with no write (§12A.17 A.7).
  select * into v_req
    from public.licence_requests r
   where r.request_id = p_request_id;

  if found then
    if v_req.payload_hash = v_hash then
      return public.licence_admin_replay_result(
        p_request_id, v_req.action, v_req.target_coverage_id, v_req.state_version_after);
    end if;
    return public.licence_admin_reject('request_conflict');
  end if;

  -- Step 7: expected state version. Replays were answered above, so they are never refused as stale.
  if v_expected <> v_ver then
    return public.licence_admin_reject('stale_state_version');
  end if;

  -- The clock is read after the lock (§12A.17 K.2), so waiting for the lock cannot give a stale time.
  v_now := clock_timestamp();

  -- Step 8: business checks. Read only, until the ledger insert.
  if p_action = 'grant' then
    select r.reject_code, r.cov_kind, r.starts_at, r.ends_at
      into v_plan_code, v_cov_kind, v_start, v_end
      from public.licence_admin_plan_grant(v_kind, v_start_in, v_end_in, v_backdate, v_now) r;

    if v_plan_code is not null then
      return public.licence_admin_reject(v_plan_code);
    end if;

    if public.licence_admin_overlaps(v_shop, v_cov_kind, v_start, v_end, null) then
      return public.licence_admin_reject('overlap');
    end if;

  elsif p_action = 'extend' then
    -- A non-revoked lifetime grant, active or scheduled, rejects Extend (§12A.17 T.1). This check
    -- runs first, because a lifetime end is NULL and no finite start can be derived from it (T.2).
    if exists (
      select 1 from public.licence_coverages c
       where c.shop_id = v_shop and c.kind = 'lifetime_grant' and c.revoked_at is null
    ) then
      return public.licence_admin_reject('extend_blocked_by_lifetime');
    end if;

    -- start = greatest(v_now, latest non-revoked coverage end) (§12A.6 O3, T.3).
    select max(c.ends_at) into v_latest_end
      from public.licence_coverages c
     where c.shop_id = v_shop and c.revoked_at is null;

    v_start    := greatest(v_now, v_latest_end);
    v_end      := public.licence_calendar_end(v_start, v_unit);
    v_cov_kind := 'admin_grant';

    if public.licence_admin_overlaps(v_shop, v_cov_kind, v_start, v_end, null) then
      return public.licence_admin_reject('overlap');
    end if;

  else
    -- revoke and replace: the target must belong to this shop (§12A.17 K.1). A missing coverage and
    -- a coverage in another shop give the same code, so the response does not reveal which.
    select * into v_target_row
      from public.licence_coverages c
     where c.id = v_target and c.shop_id = v_shop;

    if not found then
      return public.licence_admin_reject('coverage_not_found');
    end if;

    if v_target_row.revoked_at is not null then
      return public.licence_admin_reject('coverage_already_revoked');
    end if;

    -- M2: a revocation at or after the natural end is refused. Cancelling a future period is allowed.
    if v_target_row.ends_at is not null and v_now >= v_target_row.ends_at then
      return public.licence_admin_reject('natural_end_passed');
    end if;

    if p_action = 'replace' then
      select r.reject_code, r.cov_kind, r.starts_at, r.ends_at
        into v_plan_code, v_cov_kind, v_start, v_end
        from public.licence_admin_plan_grant(v_kind, v_start_in, v_end_in, v_backdate, v_now) r;

      if v_plan_code is not null then
        return public.licence_admin_reject(v_plan_code);
      end if;

      -- Other coverages of the same kind. The target is left out here and checked below.
      if public.licence_admin_overlaps(v_shop, v_cov_kind, v_start, v_end, v_target) then
        return public.licence_admin_reject('overlap');
      end if;

      -- No historical-overlap rule for the target (correction pass, 2026-11-07, H3). A revoked coverage
      -- does not block a new same-kind grant, even when their historical intervals overlap (§12A.11).
      -- The target is excluded above, and licence_admin_overlaps ignores revoked rows.
    end if;
  end if;

  -- Step 9: state_version_after = V + 1, computed before the ledger row is written (§12A.17 J, R13).
  v_next_ver := v_ver + 1;

  -- Step 10: ledger insert. The primary key on request_id is the arbiter. A conflict is resolved by a
  -- re-read in a new statement. A row that is still not visible fails safely (§12A.17 A.7).
  insert into public.licence_requests
    (request_id, action, shop_id, payload_hash, target_coverage_id, state_version_after)
  values
    (p_request_id, p_action, v_shop, v_hash, v_target, v_next_ver)
  on conflict (request_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_req
      from public.licence_requests r
     where r.request_id = p_request_id;

    if not found then
      raise exception 'licence request % conflicted but could not be re-read; nothing was written', p_request_id;
    end if;

    if v_req.payload_hash = v_hash then
      return public.licence_admin_replay_result(
        p_request_id, v_req.action, v_req.target_coverage_id, v_req.state_version_after);
    end if;
    return public.licence_admin_reject('request_conflict');
  end if;

  -- Step 11: operation writes (coverage rows and audit rows). Each audit row carries the same
  -- request_id. Replace writes two audit rows, one for the revocation and one for the new coverage. Both
  -- use the action 'replace' (correction pass, 2026-11-07).
  if p_action in ('grant', 'extend') then
    insert into public.licence_coverages
      (shop_id, kind, starts_at, ends_at, reason, created_by, request_id)
    values
      (v_shop, v_cov_kind, v_start, v_end, v_reason, v_uid, p_request_id)
    returning * into v_new_cov;

    insert into public.licence_audit_log
      (actor_user_id, shop_id, action, coverage_id, reason, licence_start, licence_end,
       before_state, after_state, request_id)
    values
      (v_uid, v_shop, p_action, v_new_cov.id, v_reason, v_new_cov.starts_at, v_new_cov.ends_at,
       null, public.licence_admin_snapshot(v_new_cov), p_request_id);

  elsif p_action = 'revoke' then
    update public.licence_coverages
       set revoked_at = v_now, revoked_by = v_uid, revoke_reason = v_reason
     where id = v_target
    returning * into v_revoked;

    insert into public.licence_audit_log
      (actor_user_id, shop_id, action, coverage_id, reason, licence_start, licence_end,
       before_state, after_state, request_id)
    values
      (v_uid, v_shop, 'revoke', v_target, v_reason, v_target_row.starts_at, v_target_row.ends_at,
       public.licence_admin_snapshot(v_target_row), public.licence_admin_snapshot(v_revoked), p_request_id);

  else
    update public.licence_coverages
       set revoked_at = v_now, revoked_by = v_uid, revoke_reason = v_reason
     where id = v_target
    returning * into v_revoked;

    insert into public.licence_audit_log
      (actor_user_id, shop_id, action, coverage_id, reason, licence_start, licence_end,
       before_state, after_state, request_id)
    values
      (v_uid, v_shop, 'replace', v_target, v_reason, v_target_row.starts_at, v_target_row.ends_at,
       public.licence_admin_snapshot(v_target_row), public.licence_admin_snapshot(v_revoked), p_request_id);

    insert into public.licence_coverages
      (shop_id, kind, starts_at, ends_at, reason, created_by, request_id)
    values
      (v_shop, v_cov_kind, v_start, v_end, v_reason, v_uid, p_request_id)
    returning * into v_new_cov;

    insert into public.licence_audit_log
      (actor_user_id, shop_id, action, coverage_id, reason, licence_start, licence_end,
       before_state, after_state, request_id)
    values
      (v_uid, v_shop, 'replace', v_new_cov.id, v_reason, v_new_cov.starts_at, v_new_cov.ends_at,
       null, public.licence_admin_snapshot(v_new_cov), p_request_id);
  end if;

  -- Step 12: one update of shop_licence_meta to V + 1 per committed operation (B2-2). The 0011 guard
  -- requires exactly +1. The state version is not changed on any other path.
  update public.shop_licence_meta
     set state_version = v_next_ver
   where shop_id = v_shop
     and state_version = v_ver;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'shop_licence_meta for shop % did not advance from % (rows updated: %)', v_shop, v_ver, v_rows;
  end if;

  -- Step 13: return. The caller's transaction commits the writes above.
  return jsonb_build_object(
    'ok', true,
    'replay', false,
    'action', p_action,
    'coverage_id', case when p_action in ('grant', 'extend', 'replace') then v_new_cov.id end,
    'target_coverage_id', v_target,
    'state_version_after', v_next_ver
  );
end;
$$;

-- ---------- helpers used by the core ----------

-- Snapshot of one coverage row for the audit log (before_state and after_state).
create or replace function public.licence_admin_snapshot(p_row public.licence_coverages)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'coverage_id', p_row.id,
    'kind', p_row.kind,
    'starts_at', p_row.starts_at,
    'ends_at', p_row.ends_at,
    'revoked_at', p_row.revoked_at
  )
$$;

-- Response for a replay of a committed request: the stored result, with no write (§12A.17 A.7, B1-4).
create or replace function public.licence_admin_replay_result(
  p_request_id           uuid,
  p_action               text,
  p_target_coverage_id   uuid,
  p_state_version_after  bigint
)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'ok', true,
    'replay', true,
    'action', p_action,
    'coverage_id', (select c.id from public.licence_coverages c where c.request_id = p_request_id),
    'target_coverage_id', p_target_coverage_id,
    'state_version_after', p_state_version_after
  )
$$;

-- Server-side settings (correction pass, 2026-11-07, H2). Clients have no privilege on this table, and it
-- is not read from any request parameter or client-settable GUC. The staging backdating window (O8) is
-- the row 'staging_backdate_window_days'. Only the staging operator inserts it, in the staging project
-- only. The production value is OPEN (decision 5), so production has no such row and no window applies.
create table public.licence_config (
  key    text primary key,
  value  text not null
);

alter table public.licence_config enable row level security;

-- Returns the staging backdating window in days, or null when the row is absent. Null is not an
-- allowance: licence_admin_plan_grant refuses every backdate when no window is configured (fail closed).
-- A row whose value is not a positive integer raises, so a bad setting fails closed.
create or replace function public.licence_backdate_window_days()
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_text text;
begin
  select c.value into v_text
    from public.licence_config c
   where c.key = 'staging_backdate_window_days';

  if not found then
    return null;
  end if;

  if v_text !~ '^[1-9][0-9]{0,3}$' then
    raise exception 'licence_config staging_backdate_window_days must be a positive integer';
  end if;

  return v_text::integer;
end;
$$;

-- Grant rules for one new coverage (§12A.6, §12A.17 B and S), shared by Grant and Replace.
--   start: absent or null means the clock time v_now. A start before v_now is a backdate and needs
--          explicit confirmation, and inside the staging window. With no window configured, every
--          backdate is refused as backdate_window_exceeded (fail closed, 2026-11-08). A start after
--          v_now is accepted for custom and lifetime only (scheduled coverage).
--   one_month and one_year: end must be absent. A start after v_now is future_start_not_allowed
--          (correction pass, 2026-11-07). The end is the calendar end of the start (IST).
--   lifetime: end must be absent. The coverage has no end.
--   custom: start and end are both required, and end must be after start. Date-only inputs were
--           already converted to 00:00 Asia/Kolkata by the parser.
-- Returns one row. reject_code is null when the plan is valid.
create or replace function public.licence_admin_plan_grant(
  p_kind        text,
  p_start_in    timestamptz,
  p_end_in      timestamptz,
  p_backdate    boolean,
  p_now         timestamptz
)
returns table (
  reject_code  text,
  cov_kind     text,
  starts_at    timestamptz,
  ends_at      timestamptz
)
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_start  timestamptz := coalesce(p_start_in, p_now);
  v_end    timestamptz;
  v_window integer;
begin
  -- One_month and one_year start now unless explicitly backdated. A future start is refused.
  if p_kind in ('one_month', 'one_year') and p_start_in is not null and p_start_in > p_now then
    return query select 'future_start_not_allowed'::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_start < p_now and not coalesce(p_backdate, false) then
    return query select 'backdate_not_confirmed'::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- Staging backdating window (O8). Fail closed (2026-11-08): when no window is configured
  -- (production, decision 5 OPEN) v_window is null and every backdate is refused. The reject code
  -- is reused from the existing window rule, so no new code is needed.
  v_window := public.licence_backdate_window_days();
  if v_start < p_now
     and (v_window is null or v_start < p_now - make_interval(days => v_window)) then
    return query select 'backdate_window_exceeded'::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if p_kind in ('one_month', 'one_year') then
    if p_end_in is not null then
      return query select 'end_not_allowed'::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    v_end := public.licence_calendar_end(v_start, case when p_kind = 'one_month' then 'month' else 'year' end);
    return query select null::text, 'admin_grant'::text, v_start, v_end;

  elsif p_kind = 'lifetime' then
    if p_end_in is not null then
      return query select 'end_not_allowed'::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    return query select null::text, 'lifetime_grant'::text, v_start, null::timestamptz;

  else
    -- custom
    if p_start_in is null then
      return query select 'start_required'::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    if p_end_in is null then
      return query select 'end_required'::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    if p_end_in <= p_start_in then
      return query select 'custom_range_invalid'::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    return query select null::text, 'admin_grant'::text, p_start_in, p_end_in;
  end if;
end;
$$;

-- ---------- the four client RPCs ----------

create or replace function public.licence_admin_grant(p_request_id uuid, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.licence_admin_core('grant', p_request_id, p_payload)
$$;

create or replace function public.licence_admin_extend(p_request_id uuid, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.licence_admin_core('extend', p_request_id, p_payload)
$$;

create or replace function public.licence_admin_revoke(p_request_id uuid, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.licence_admin_core('revoke', p_request_id, p_payload)
$$;

create or replace function public.licence_admin_replace(p_request_id uuid, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.licence_admin_core('replace', p_request_id, p_payload)
$$;

-- ---------- owner read RPC (decision D; §12A.8; §12B.2 D) ----------
-- Minimal owner status. It returns only the decision D categories: active or inactive; access end or
-- no expiry; next start, shown only in SCHEDULED. It returns no reason, actor, coverage ID, basis,
-- audit, payment or revocation field, and it does not distinguish EXPIRED from REVOKED.
-- Access: the caller must be a shop owner (is_shop_owner, 0001). Staff, other users and anon are denied.
-- A denial is a committed {ok:false, code:'forbidden'} with no denial row (§12A.8 (ii) covers admin RPCs).
-- Field names are an implementation choice. The categories are the approved ones.
create or replace function public.shop_licence_status(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_state text;
  v_until timestamptz;
  v_next  timestamptz;
begin
  if auth.uid() is null or p_shop_id is null or not public.is_shop_owner(p_shop_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select s.state, s.access_until, s.next_start
    into v_state, v_until, v_next
    from public.shop_licence_state(p_shop_id, now()) s;

  return jsonb_build_object(
    'ok', true,
    'active', (v_state = 'ACTIVE'),
    'no_expiry', (v_state = 'ACTIVE' and v_until is null),
    'access_end', case when v_state = 'ACTIVE' then v_until end,
    'next_start', case when v_state = 'SCHEDULED' then v_next end
  );
end;
$$;

-- ---------- privileges (§12A.17 L, R9) ----------
-- The four RPCs are granted to authenticated only. Internal helpers keep EXECUTE revoked from every
-- client role. Supabase default privileges (R17, unverified) may grant more, so each function is
-- revoked explicitly.

revoke execute on function
  public.licence_admin_grant(uuid, jsonb),
  public.licence_admin_extend(uuid, jsonb),
  public.licence_admin_revoke(uuid, jsonb),
  public.licence_admin_replace(uuid, jsonb)
  from public, anon, service_role;

grant execute on function
  public.licence_admin_grant(uuid, jsonb),
  public.licence_admin_extend(uuid, jsonb),
  public.licence_admin_revoke(uuid, jsonb),
  public.licence_admin_replace(uuid, jsonb)
  to authenticated;

revoke execute on function
  public.licence_admin_core(text, uuid, jsonb),
  public.licence_admin_canonical_bytes(text, uuid, uuid, bigint, boolean, text, text, text, uuid, timestamptz, timestamptz, boolean),
  public.licence_admin_deny(text, text, uuid, uuid),
  public.licence_admin_reject(text),
  public.licence_admin_allowed_keys(text),
  public.licence_admin_plan_grant(text, timestamptz, timestamptz, boolean, timestamptz),
  public.licence_admin_overlaps(uuid, text, timestamptz, timestamptz, uuid),
  public.licence_admin_snapshot(public.licence_coverages),
  public.licence_admin_replay_result(uuid, text, uuid, bigint),
  public.licence_calendar_end(timestamptz, text),
  public.licence_canon_text(text),
  public.licence_hash_field(integer, bytea),
  public.licence_hash_null(),
  public.licence_hash_bool(boolean),
  public.licence_hash_int(bigint),
  public.licence_hash_text(text),
  public.licence_hash_uuid(uuid),
  public.licence_hash_ts(timestamptz),
  public.licence_parse_instant(text),
  public.licence_try_uuid(text),
  public.licence_backdate_window_days()
  from public, anon, authenticated, service_role;

-- The settings table is not readable or writable by any client role (RLS on, no policy, no grant).
revoke all on public.licence_config from public, anon, authenticated, service_role;

-- The owner read RPC is the only client read path in this file. Authenticated callers pass the
-- is_shop_owner check inside the function. Anon and service_role have no EXECUTE.
revoke execute on function public.shop_licence_status(uuid) from public, anon, service_role;
grant execute on function public.shop_licence_status(uuid) to authenticated;

-- End of 0012 (Stage 7C admin RPCs). Not applied. Not run on any Supabase project.
-- 0013: admin read RPCs (Stage 7D backend). FILE ONLY. NOT APPLIED. NOT RUN ON ANY SUPABASE PROJECT.
--
-- Provisional number on the Stage 7 branch (2026-11-08). Renumber only with owner approval.
-- Depends on: 0001 (shops, is_shop_owner), 0011 (platform_admins, is_platform_admin, shop_licence_meta,
-- shop_licence_state, licence_coverages, licence_audit_log) and 0012 (licence_admin_deny,
-- licence_admin_reject). It changes no existing function and no existing table.
--
-- Adds (all SECURITY DEFINER, fixed search_path, schema-qualified, VOLATILE so that a denial can write
-- its counters; STABLE would make the denial write fail):
--   admin_search_shops(p_query text, p_limit integer default 10)           EXECUTE: authenticated only
--   admin_shop_licence(p_shop_id uuid)                                     EXECUTE: authenticated only
--   admin_shop_audit(p_shop_id uuid, p_after_created_at timestamptz default null,
--                    p_after_id uuid default null, p_limit integer default 25)
--                                                                          EXECUTE: authenticated only
--   licence_admin_read_gate(p_function_name text)                          internal, no client EXECUTE
--   indexes: shops_slug_pattern_idx, shops_name_pattern_idx (both on shops, a Stage 1 table: owner
--   approval needed), licence_audit_log_shop_created_id_idx (keyset order with the id tie-break).
--
-- Authorisation follows licence_admin_core step 2 in the same order: caller UID, is_platform_admin(),
-- aal2. A failure is a committed {ok:false, code:'forbidden'} after the denial counters (and any allowed
-- detail row) are written, with the same denial reasons as the write RPCs. A missing shop is a committed
-- shop_not_found with no denial row (it is not an authorisation failure). Bad input is invalid_request.
--
-- Isolation: the write RPCs require READ COMMITTED. These reads do not check it. Each read is a single
-- statement, so its snapshot is consistent in either isolation level.

-- ---------- gate ----------

-- Returns null when the caller passes. Otherwise it writes the denial records and returns the committed
-- forbidden result. A caller with no readable UID is counted in the global counter only (as in 0012).
create or replace function public.licence_admin_read_gate(p_function_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid;
  v_aal text;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  if v_uid is null then
    return public.licence_admin_deny(p_function_name, 'no_actor', null, null);
  end if;

  if not public.is_platform_admin() then
    return public.licence_admin_deny(p_function_name, 'not_platform_admin', null, v_uid);
  end if;

  -- Missing, unreadable or insufficient aal fails closed.
  begin
    v_aal := auth.jwt() ->> 'aal';
  exception when others then
    v_aal := null;
  end;

  if v_aal is distinct from 'aal2' then
    return public.licence_admin_deny(p_function_name, 'aal_not_aal2', null, v_uid);
  end if;

  return null;
end;
$$;

-- ---------- search ----------

-- Shop search for platform admins. The query is trimmed and lower-cased. It matches an exact shop UUID,
-- or a prefix of the slug or of the name. LIKE metacharacters are escaped, so the query is literal text.
-- Output is capped at p_limit (1 to 25); has_more says whether another match exists. There is no cursor:
-- the admin refines the query. Returns only shop_id, slug and name (shops also has phone, address and
-- is_open; those are not returned to admins here).
create or replace function public.admin_search_shops(p_query text, p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate  jsonb;
  v_q     text;
  v_pat   text;
  v_items jsonb;
  v_more  boolean;
begin
  v_gate := public.licence_admin_read_gate('admin_search_shops');
  if v_gate is not null then
    return v_gate;
  end if;

  v_q := lower(btrim(coalesce(p_query, '')));
  if char_length(v_q) < 2 or char_length(v_q) > 80 then
    return public.licence_admin_reject('invalid_request');
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 25 then
    return public.licence_admin_reject('invalid_request');
  end if;

  v_pat := replace(replace(replace(v_q, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'),
                   '_', chr(92) || '_') || '%';

  select coalesce(jsonb_agg(jsonb_build_object('shop_id', h.id, 'slug', h.slug, 'name', h.name)
                            order by h.rn) filter (where h.rn <= p_limit), '[]'::jsonb),
         coalesce(max(h.rn), 0) > p_limit
    into v_items, v_more
    from (
      select s.id, s.slug, s.name,
             row_number() over (order by s.name, s.id) as rn
        from public.shops s
       where s.id::text = v_q
          or s.slug like v_pat escape '\'
          or lower(s.name) like v_pat escape '\'
       order by s.name, s.id
       limit p_limit + 1
    ) h;

  return jsonb_build_object('ok', true, 'shops', v_items, 'has_more', v_more);
end;
$$;

-- ---------- shop licence view ----------

-- One shop's licence view for the admin: its state_version (the value the write RPCs need as
-- expected_state_version), its state at now(), and its live coverages (the target_coverage_id
-- candidates). Live means not revoked and not yet ended. Scheduled coverages (not yet started) are
-- included with status 'scheduled'. Expired and revoked coverages are excluded. At most 50 are returned,
-- ordered by start; coverages_truncated says whether more exist. Coverage rows carry no actor IDs.
--
-- The version, the state and the coverage list come from one statement, so they come from one snapshot.
-- A version can still be stale by the time the admin submits it: the write RPC re-checks it under lock.
create or replace function public.admin_shop_licence(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate jsonb;
  v_doc  jsonb;
begin
  v_gate := public.licence_admin_read_gate('admin_shop_licence');
  if v_gate is not null then
    return v_gate;
  end if;

  if p_shop_id is null then
    return public.licence_admin_reject('invalid_request');
  end if;

  select jsonb_build_object(
           'ok', true,
           'shop', jsonb_build_object('shop_id', s.id, 'slug', s.slug, 'name', s.name),
           'state_version', coalesce(m.state_version, 0),
           'state', jsonb_build_object(
                      'state', st.state,
                      'basis', st.basis,
                      'access_until', st.access_until,
                      'next_start', st.next_start),
           'coverages', cov.items,
           'coverages_truncated', cov.more)
    into v_doc
    from public.shops s
    left join public.shop_licence_meta m on m.shop_id = s.id
    cross join lateral public.shop_licence_state(s.id, now()) st
    cross join lateral (
      select coalesce(jsonb_agg(x.item order by x.starts_at, x.coverage_id)
                        filter (where x.rn <= 50), '[]'::jsonb) as items,
             coalesce(max(x.rn), 0) > 50 as more
        from (
          select c.id as coverage_id,
                 c.starts_at,
                 jsonb_build_object(
                   'coverage_id', c.id,
                   'kind', c.kind,
                   'status', case when c.starts_at <= now() then 'current' else 'scheduled' end,
                   'starts_at', c.starts_at,
                   'ends_at', c.ends_at,
                   'reason', c.reason) as item,
                 row_number() over (order by c.starts_at, c.id) as rn
            from public.licence_coverages c
           where c.shop_id = s.id
             and c.revoked_at is null
             and (c.ends_at is null or c.ends_at > now())
           order by c.starts_at, c.id
           limit 51
        ) x
    ) cov
   where s.id = p_shop_id;

  if v_doc is null then
    return public.licence_admin_reject('shop_not_found');
  end if;

  return v_doc;
end;
$$;

-- ---------- audit history ----------

-- Audit entries for one shop, newest first, 1 to 100 per page (default 25). Keyset pagination on
-- (created_at, id), so a replace's two rows (same now()) are ordered by id and neither is skipped. Pass
-- both cursor fields from the previous page's next object, or neither for the first page. The audit log
-- is append-only, so newer entries never shift an older page.
create or replace function public.admin_shop_audit(
  p_shop_id           uuid,
  p_after_created_at  timestamptz default null,
  p_after_id          uuid default null,
  p_limit             integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate    jsonb;
  v_rows    jsonb;
  v_more    boolean;
  v_next_at timestamptz;
  v_next_id uuid;
begin
  v_gate := public.licence_admin_read_gate('admin_shop_audit');
  if v_gate is not null then
    return v_gate;
  end if;

  if p_shop_id is null or p_limit is null or p_limit < 1 or p_limit > 100
     or (p_after_created_at is null) <> (p_after_id is null) then
    return public.licence_admin_reject('invalid_request');
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id) then
    return public.licence_admin_reject('shop_not_found');
  end if;

  -- The probe row (rn = p_limit + 1) only tells whether another page exists. The cursor is the last
  -- returned row (rn = p_limit).
  select coalesce(jsonb_agg(jsonb_build_object(
                     'entry_id', p.id,
                     'created_at', p.created_at,
                     'action', p.action,
                     'coverage_id', p.coverage_id,
                     'reason', p.reason,
                     'licence_start', p.licence_start,
                     'licence_end', p.licence_end,
                     'actor_user_id', p.actor_user_id,
                     'before_state', p.before_state,
                     'after_state', p.after_state)
                   order by p.rn) filter (where p.rn <= p_limit), '[]'::jsonb),
         coalesce(max(p.rn), 0) > p_limit,
         (array_agg(p.created_at order by p.rn))[p_limit],
         (array_agg(p.id order by p.rn))[p_limit]
    into v_rows, v_more, v_next_at, v_next_id
    from (
      select a.id, a.created_at, a.action, a.coverage_id, a.reason,
             a.licence_start, a.licence_end, a.actor_user_id, a.before_state, a.after_state,
             row_number() over (order by a.created_at desc, a.id desc) as rn
        from public.licence_audit_log a
       where a.shop_id = p_shop_id
         and (p_after_created_at is null
              or (a.created_at, a.id) < (p_after_created_at, p_after_id))
       order by a.created_at desc, a.id desc
       limit p_limit + 1
    ) p;

  return jsonb_build_object(
    'ok', true,
    'entries', v_rows,
    'next', case when v_more
                 then jsonb_build_object('created_at', v_next_at, 'entry_id', v_next_id)
            end);
end;
$$;

-- ---------- indexes ----------

-- Prefix search needs pattern operator classes unless the database collation is C.
create index shops_slug_pattern_idx on public.shops (slug text_pattern_ops);
create index shops_name_pattern_idx on public.shops (lower(name) text_pattern_ops);

-- Keyset order for admin_shop_audit. The 0011 index (shop_id, created_at) is kept unchanged.
create index licence_audit_log_shop_created_id_idx
  on public.licence_audit_log (shop_id, created_at desc, id desc);

-- ---------- privileges ----------

revoke all on function public.licence_admin_read_gate(text)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.admin_search_shops(text, integer),
  public.admin_shop_licence(uuid),
  public.admin_shop_audit(uuid, timestamptz, uuid, integer)
  from public, anon, service_role;

grant execute on function
  public.admin_search_shops(text, integer),
  public.admin_shop_licence(uuid),
  public.admin_shop_audit(uuid, timestamptz, uuid, integer)
  to authenticated;

-- End of 0013 (Stage 7D admin read RPCs). Not applied. Not run on any Supabase project.
