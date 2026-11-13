-- 0015: licence foundation (Stage 7, steps 7B-1 and 7B-2, plus the 7C replay ledger and denial tables). FILE ONLY.
--
-- Status: NOT APPLIED. NOT EXECUTED. NOT TESTED.
-- Edited 2026-11-05 under the owner-approved Stage 7C bundles 1 to 3. Pre-staging review (O2) is still required.
-- Renamed from 0011 to 0015 on 2026-11-10 (owner-authorised D-MIG default; comments only changed).
-- Written on the origin/main line (migrations 0001-0010). Originally numbered 0011, confirmed free on
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

-- End of 0015 (7B-1, 7B-2 and the 7C ledger and denial tables). Not applied.
