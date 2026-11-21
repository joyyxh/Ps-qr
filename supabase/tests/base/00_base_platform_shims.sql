-- TEST-ONLY stand-ins for the Supabase platform surface used by the base SQL suites
-- (supabase/tests/stage*_tests.sql) and the development seed (supabase/seed/demo_seed.sql).
-- Plain PostgreSQL 16 only. Not a migration. Never applied to Supabase.
--
-- These stand-ins are reconstructed from the platform behaviour the suites and migrations assume.
-- They have NOT been checked against a live Supabase project in this work; that needs EX-02 approval.
--
-- Load order: this file first, then supabase/migrations in order, then the seed.

-- ---------- auth ----------
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

-- ---------- storage ----------
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

-- Direct SQL deletes on the storage tables are refused unless the Storage API sets
-- storage.allow_delete_query. Statement level, so it fires whether or not RLS shows any rows.
-- The stage 6 suite (S41) relies on this and expects SQLSTATE 42501.
create or replace function storage.protect_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), '') <> 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using errcode = '42501';
  end if;
  return null;
end $$;
drop trigger if exists protect_objects_delete on storage.objects;
create trigger protect_objects_delete before delete on storage.objects
  for each statement execute function storage.protect_delete();
drop trigger if exists protect_buckets_delete on storage.buckets;
create trigger protect_buckets_delete before delete on storage.buckets
  for each statement execute function storage.protect_delete();

-- ---------- roles ----------
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default table and sequence privileges in schema public. Migrations 0001 to 0010 rely on
-- these: row level security then controls access. Function EXECUTE defaults are NOT emulated; those
-- migrations grant EXECUTE explicitly.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- The Storage API tables are granted to the client roles; row level security on them decides access.
grant select, insert, update, delete on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
