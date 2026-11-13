-- LOCAL SCRATCH ONLY. Minimal stand-ins for the Supabase-managed schemas and roles
-- so the QRquick migrations and SQL tests can run on a plain Postgres 16.
-- Never run against production.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id                  uuid primary key,
  aud                 text,
  role                text,
  email               text,
  created_at          timestamptz,
  updated_at          timestamptz,
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb
);

-- Same lookup Supabase uses: the JWT subject of the current request.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), '')::uuid
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id                  text primary key,
  name                text,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[]
);
create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets(id),
  name        text,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table storage.objects enable row level security;

-- Supabase semantics: all path segments except the last.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Supabase grants API roles usage on auth/storage and table access (RLS still applies).
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select, insert, update, delete on storage.buckets to anon, authenticated, service_role;

-- Supabase blocks direct SQL deletes on storage tables; the Storage API is the only way.
-- Mirrors the platform's protect_delete trigger (SQLSTATE 42501).
create or replace function storage.protect_delete() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), '') = 'true' then
    return null;
  end if;
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    using errcode = '42501';
end $$;
create trigger protect_objects_delete before delete on storage.objects
  for each statement execute function storage.protect_delete();
