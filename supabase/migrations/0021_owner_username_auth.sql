-- 0021_owner_username_auth.sql
--
-- Owner accounts sign in with a username and a password. Email is not used for
-- owner accounts. Recovery uses single-use codes. Terms and Privacy acceptance is
-- recorded. See docs/AUTH_REDESIGN.md for the reasons and the blockers.
--
-- Staging only until the owner approves the production catch-up. Nothing here
-- changes existing tables, policies or grants other than the trigger on auth.users.
--
-- Behaviour the rest of the system relies on:
--   * Only rows with raw_app_meta_data.owner_flow = 'username-v1' and an address
--     ending in @accounts.qrquick.invalid can be inserted into auth.users. A public
--     email sign-up is refused here, whatever the dashboard setting is.
--   * Every table here has RLS on and no policies. Only service_role can reach it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.owner_usernames (
  username   text primary key,
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint owner_usernames_format check (
    username ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    and char_length(username) between 3 and 24
  ),
  constraint owner_usernames_reserved check (
    username not in ('admin', 'owner', 'root', 'support', 'qrquick', 'system', 'null', 'help', 'api', 'www', 'staff', 'moderator')
  )
);

create table if not exists public.owner_recovery_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  set_id     uuid not null,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists owner_recovery_codes_open_idx
  on public.owner_recovery_codes (user_id)
  where used_at is null;

create table if not exists public.legal_documents (
  kind         text not null check (kind in ('terms', 'privacy')),
  version      text not null check (char_length(version) between 1 and 40),
  title        text not null,
  effective_at timestamptz not null,
  primary key (kind, version)
);

insert into public.legal_documents (kind, version, title, effective_at)
values
  ('terms', '2026-11-22.1', 'Terms and Conditions', '2026-11-22T00:00:00Z'),
  ('privacy', '2026-11-22.1', 'Privacy Policy', '2026-11-22T00:00:00Z')
on conflict (kind, version) do nothing;

create table if not exists public.owner_policy_acceptances (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  version     text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, kind, version),
  foreign key (kind, version) references public.legal_documents (kind, version)
);

alter table public.owner_usernames enable row level security;
alter table public.owner_recovery_codes enable row level security;
alter table public.legal_documents enable row level security;
alter table public.owner_policy_acceptances enable row level security;

revoke all on public.owner_usernames, public.owner_recovery_codes,
  public.legal_documents, public.owner_policy_acceptances
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions (service role only)
-- ---------------------------------------------------------------------------

-- Replaces all recovery codes of one account with a new set of ten. Each code is
-- stored as a bcrypt hash. The plain codes are not stored and are not returned.
create or replace function public.owner_replace_recovery_codes(p_user_id uuid, p_codes text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set  uuid := gen_random_uuid();
  v_code text;
begin
  if p_user_id is null or p_codes is null or cardinality(p_codes) <> 10 then
    raise exception 'bad recovery code set' using errcode = '22023';
  end if;
  foreach v_code in array p_codes loop
    if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$' then
      raise exception 'bad recovery code' using errcode = '22023';
    end if;
  end loop;

  delete from public.owner_recovery_codes where user_id = p_user_id;

  insert into public.owner_recovery_codes (user_id, set_id, code_hash)
  select p_user_id, v_set, extensions.crypt(replace(c, '-', ''), extensions.gen_salt('bf', 8))
  from unnest(p_codes) as c;

  return v_set;
end;
$$;

-- Checks a recovery code (16 characters, no dashes, upper case) and marks it used.
-- Returns true only once for each code.
create or replace function public.owner_consume_recovery_code(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_user_id is null or p_code is null
     or p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{16}$' then
    return false;
  end if;

  select c.id into v_id
  from public.owner_recovery_codes c
  where c.user_id = p_user_id
    and c.used_at is null
    and extensions.crypt(p_code, c.code_hash) = c.code_hash
  order by c.id
  limit 1
  for update;

  if v_id is null then
    return false;
  end if;

  update public.owner_recovery_codes
     set used_at = now()
   where id = v_id and used_at is null;

  return found;
end;
$$;

-- One bcrypt comparison at the same cost GoTrue uses (10). Called when the
-- username is unknown, so that an unknown name takes about as long as a wrong password.
create or replace function public.owner_auth_burn(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform extensions.crypt(left(coalesce(p_password, ''), 72), '$2a$10$abcdefghijklmnopqrstuu');
end;
$$;

-- Ends every refresh session of one account. Access tokens already issued last
-- until they expire (default one hour).
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tokens integer;
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '22023';
  end if;
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  get diagnostics v_tokens = row_count;
  delete from auth.sessions where user_id = p_user_id;
  return v_tokens;
end;
$$;

revoke all on function public.owner_replace_recovery_codes(uuid, text[]) from public, anon, authenticated;
revoke all on function public.owner_consume_recovery_code(uuid, text) from public, anon, authenticated;
revoke all on function public.owner_auth_burn(text) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;

grant execute on function public.owner_replace_recovery_codes(uuid, text[]) to service_role;
grant execute on function public.owner_consume_recovery_code(uuid, text) to service_role;
grant execute on function public.owner_auth_burn(text) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Guard: only owner accounts created by the owner-auth function may be inserted.
-- A public email sign-up cannot set raw_app_meta_data, so it is refused here.
-- ---------------------------------------------------------------------------

create or replace function public.owner_guard_auth_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'owner_flow', '') = 'username-v1'
     and coalesce(new.email, '') ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*@accounts\.qrquick\.invalid$' then
    return new;
  end if;
  raise exception 'Email sign-up is not available. Create an owner account with a username.'
    using errcode = '42501';
end;
$$;

-- A trigger function needs no EXECUTE grant to fire, so nothing else may call it.
revoke all on function public.owner_guard_auth_users() from public, anon, authenticated;

drop trigger if exists owner_guard_auth_users on auth.users;
create trigger owner_guard_auth_users
  before insert on auth.users
  for each row execute function public.owner_guard_auth_users();
