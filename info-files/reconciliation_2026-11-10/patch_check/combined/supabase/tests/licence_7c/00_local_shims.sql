-- LOCAL TEST HARNESS ONLY. Not a Supabase object. Never run against a Supabase project.
-- Provides the minimum Supabase surface that 0011 and the 7C RPCs use, so they can be tested on a
-- throwaway local PostgreSQL 16 cluster: roles, the auth schema (auth.users, auth.uid(), auth.jwt())
-- and a stub public.shops table. auth.uid() and auth.jwt() read the request.jwt.claims setting,
-- as Supabase does. The real Supabase behaviour is not verified by this file (hosted check: O11).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

-- Columns copied from 0001_stage1_foundation.sql (shops, lines 17-27). Defaults let the older
-- harness insert an id only. The read RPCs in 0013 use slug and name.
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique default ('shop-' || replace(gen_random_uuid()::text, '-', '')),
  name        text not null default 'Test shop',
  phone       text,
  address     text,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

-- Owner check, copied from 0001_stage1_foundation.sql (shop_memberships, lines 30-36, and
-- is_shop_member / is_shop_owner, lines 89-112) so shop_licence_status behaves the same locally.
create table if not exists public.shop_memberships (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','staff')),
  created_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create or replace function public.is_shop_member(p_shop uuid, p_roles text[] default array['owner','staff'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_shop_owner(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_shop_member(p_shop, array['owner']);
$$;

grant execute on function public.is_shop_member(uuid, text[]), public.is_shop_owner(uuid) to authenticated;
