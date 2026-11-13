-- 0011: licence foundation (Stage 7, step 7B-1). FILE ONLY.
--
-- Status: NOT APPLIED. NOT EXECUTED. NOT TESTED.
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
--
-- Not in this file (each needs its own approval)
--   * licence_lock_shop() and shop_licence_meta (7B-2). They depend on the R18 admin-side
--     lock contract, which is NOT APPROVED. This file takes no advisory lock and no
--     meta-row lock.
--   * Admin write RPCs for grant, extend, revoke and replace (7C).
--   * Licence denials and their cap (7C). Printing enforcement (7F).
--   * Paid verification, licence payments and trials (C-5).
--   * Changes to orders, payments or existing functions, triggers, policies and grants.
--   * The bootstrap admin row. No seed data is inserted.

-- ---------- tables ----------

create table public.platform_admins (
  user_id      uuid primary key references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  disabled_at  timestamptz
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

-- ---------- privileges ----------

alter table public.platform_admins   enable row level security;
alter table public.licence_coverages enable row level security;
alter table public.licence_audit_log enable row level security;
-- No policies on purpose. Browsers, anon and authenticated read and write nothing here.
-- Service role is revoked as well, so only functions owned by the migration role touch
-- these tables. This differs from 0010, which leaves service_role alone.
revoke all on public.platform_admins, public.licence_coverages, public.licence_audit_log
  from public, anon, authenticated, service_role;

revoke execute on function public.is_platform_admin()
  from public, anon, authenticated, service_role;
revoke execute on function public.shop_licence_state(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.licence_coverages_guard()
  from public, anon, authenticated, service_role;
revoke execute on function public.licence_audit_log_guard()
  from public, anon, authenticated, service_role;

-- End of 0011 (7B-1). Not applied.
