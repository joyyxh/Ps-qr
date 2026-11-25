-- 0024_owner_legacy_claim.sql
--
-- Lets an existing email-style owner (a "legacy" owner) move to a username account and KEEP the same
-- auth user id, so their shop, memberships, services, orders and files stay attached. Nothing is deleted
-- or recreated. NOT APPLIED to staging or production. Run after 0001 to 0023.
--
-- How a claim works (see supabase/functions/owner-auth, route POST /claim):
--   1. The operator verifies the person, then issues a one-time claim code for that legacy account by running
--        select public.owner_issue_claim_code('<auth user id>');
--      in the SQL editor. The code is shown once, is valid for 72 hours, and only its bcrypt hash is stored.
--   2. The owner enters the legacy email, the claim code, a new username and a new password in the app.
--   3. The function checks everything, then (a) applies the DB side in one transaction
--      (owner_claim_apply: username reservation, Terms and Privacy acceptance, ten recovery codes),
--      (b) converts the GoTrue user through the admin API (email becomes <username>@accounts.qrquick.invalid,
--      the password is set, app_metadata owner_flow = username-v1), (c) syncs the identity row.
--      If (b) fails, owner_claim_undo removes (a) and re-opens the claim code. The legacy account is unchanged.
--
-- Security. Every function is SECURITY DEFINER with an empty search_path, executable by service_role only (the
-- operator runs the issue function as the database owner). The table has RLS on, no policies and no grants.
-- Claim codes carry about 79 bits (16 symbols of a 31-symbol alphabet), are single use, expire, and the
-- function rate-limits attempts per address and per email.
--
-- Rollback: drop the functions and the table (nothing else depends on them). Converted accounts stay valid
-- username accounts; to revert one, restore from backup.

create table if not exists public.owner_claim_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists owner_claim_codes_user_id_idx on public.owner_claim_codes (user_id);

alter table public.owner_claim_codes enable row level security;
revoke all on public.owner_claim_codes from anon, authenticated;

-- A legacy owner: a real (non-internal) email, no username account yet, and an owner membership.
create or replace function public.owner_is_legacy(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = p_user_id
       and coalesce(u.raw_app_meta_data ->> 'owner_flow', '') <> 'username-v1'
       and coalesce(u.email, '') <> ''
       and u.email not like '%@accounts.qrquick.invalid'
       and not exists (select 1 from public.owner_usernames n where n.user_id = u.id)
       and exists (select 1 from public.shop_memberships m where m.user_id = u.id and m.role = 'owner')
  );
$$;

-- Finds the legacy owner for an email address, or null. Never returns anything else.
create or replace function public.owner_legacy_user_for(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_email is null or char_length(p_email) > 254 then
    return null;
  end if;
  select u.id into v_id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if v_id is null or not public.owner_is_legacy(v_id) then
    return null;
  end if;
  return v_id;
end;
$$;

-- Issues a claim code for one legacy owner and returns it in the form XXXX-XXXX-XXXX-XXXX. Replaces any unused code.
create or replace function public.owner_issue_claim_code(p_user_id uuid, p_ttl_hours integer default 72)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code  text := '';
  v_bytes bytea;
  v_i     integer;
  v_b     integer;
begin
  if p_user_id is null or p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 168 then
    raise exception 'bad claim request' using errcode = '22023';
  end if;
  if not public.owner_is_legacy(p_user_id) then
    raise exception 'not a legacy owner account' using errcode = '22023';
  end if;

  -- Rejection sampling: a byte is used only below 248 (31 * 8), so every symbol is equally likely.
  while char_length(v_code) < 16 loop
    v_bytes := extensions.gen_random_bytes(32);
    for v_i in 0..31 loop
      v_b := get_byte(v_bytes, v_i);
      if v_b < 248 and char_length(v_code) < 16 then
        v_code := v_code || substr(c_alphabet, (v_b % 31) + 1, 1);
      end if;
    end loop;
  end loop;

  delete from public.owner_claim_codes where user_id = p_user_id and used_at is null;
  insert into public.owner_claim_codes (user_id, code_hash, expires_at)
  values (p_user_id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), now() + make_interval(hours => p_ttl_hours));

  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4) || '-' || substr(v_code, 13, 4);
end;
$$;

-- Checks a claim code (16 characters, no dashes, upper case) and marks it used. True only once per code.
create or replace function public.owner_consume_claim_code(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_user_id is null or p_code is null or p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{16}$' then
    return false;
  end if;
  select c.id into v_id
    from public.owner_claim_codes c
   where c.user_id = p_user_id
     and c.used_at is null
     and c.expires_at > now()
     and extensions.crypt(p_code, c.code_hash) = c.code_hash
   order by c.id
   limit 1
   for update;
  if v_id is null then
    return false;
  end if;
  update public.owner_claim_codes set used_at = now() where id = v_id and used_at is null;
  return found;
end;
$$;

-- Re-opens a code that was consumed by a claim that then failed. Only for the same user, and only while the
-- account is still legacy and the code has not expired.
create or replace function public.owner_unconsume_claim_code(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_user_id is null or p_code is null or p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{16}$'
     or not public.owner_is_legacy(p_user_id) then
    return false;
  end if;
  select c.id into v_id
    from public.owner_claim_codes c
   where c.user_id = p_user_id
     and c.used_at is not null
     and c.expires_at > now()
     and extensions.crypt(p_code, c.code_hash) = c.code_hash
   order by c.id desc
   limit 1
   for update;
  if v_id is null then
    return false;
  end if;
  update public.owner_claim_codes set used_at = null where id = v_id;
  return true;
end;
$$;

-- The database side of a claim, in one transaction: reserve the username, record acceptance of the current
-- Terms and Privacy versions, and replace the recovery codes. Refuses anything that is not a legacy owner.
create or replace function public.owner_claim_apply(
  p_user_id uuid,
  p_username text,
  p_terms_version text,
  p_privacy_version text,
  p_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owner_is_legacy(p_user_id) then
    raise exception 'not a legacy owner account' using errcode = '22023';
  end if;
  insert into public.owner_usernames (username, user_id) values (p_username, p_user_id);
  insert into public.owner_policy_acceptances (user_id, kind, version)
  values (p_user_id, 'terms', p_terms_version), (p_user_id, 'privacy', p_privacy_version);
  return public.owner_replace_recovery_codes(p_user_id, p_codes);
end;
$$;

-- Undoes owner_claim_apply for an account that was not converted. Removes only this account's rows.
create or replace function public.owner_claim_undo(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '22023';
  end if;
  -- A converted account (internal address) is never touched here.
  if exists (select 1 from auth.users u where u.id = p_user_id and u.email like '%@accounts.qrquick.invalid') then
    raise exception 'account already converted' using errcode = '22023';
  end if;
  delete from public.owner_recovery_codes where user_id = p_user_id;
  delete from public.owner_policy_acceptances where user_id = p_user_id;
  delete from public.owner_usernames where user_id = p_user_id;
end;
$$;

-- Keeps the email identity row consistent with the new internal address. A no-op when GoTrue already did it.
create or replace function public.owner_claim_sync_identity(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_email is null or p_email !~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*@accounts\.qrquick\.invalid$' then
    raise exception 'bad address' using errcode = '22023';
  end if;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', p_email, 'email_verified', true),
         updated_at = now()
   where user_id = p_user_id and provider = 'email';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.owner_is_legacy(uuid) from public, anon, authenticated;
revoke all on function public.owner_legacy_user_for(text) from public, anon, authenticated;
revoke all on function public.owner_issue_claim_code(uuid, integer) from public, anon, authenticated;
revoke all on function public.owner_consume_claim_code(uuid, text) from public, anon, authenticated;
revoke all on function public.owner_unconsume_claim_code(uuid, text) from public, anon, authenticated;
revoke all on function public.owner_claim_apply(uuid, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.owner_claim_undo(uuid) from public, anon, authenticated;
revoke all on function public.owner_claim_sync_identity(uuid, text) from public, anon, authenticated;

grant execute on function public.owner_is_legacy(uuid) to service_role;
grant execute on function public.owner_legacy_user_for(text) to service_role;
grant execute on function public.owner_issue_claim_code(uuid, integer) to service_role;
grant execute on function public.owner_consume_claim_code(uuid, text) to service_role;
grant execute on function public.owner_unconsume_claim_code(uuid, text) to service_role;
grant execute on function public.owner_claim_apply(uuid, text, text, text, text[]) to service_role;
grant execute on function public.owner_claim_undo(uuid) to service_role;
grant execute on function public.owner_claim_sync_identity(uuid, text) to service_role;
