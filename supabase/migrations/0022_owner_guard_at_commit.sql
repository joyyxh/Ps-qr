-- 0022_owner_guard_at_commit.sql
--
-- Replaces the BEFORE INSERT guard from 0021 with a guard that checks the row when the transaction commits.
--
-- Why. GoTrue's admin createUser inserts the auth.users row first, with provider metadata only
-- ({"provider","providers"}), and applies the request's app_metadata afterwards in the same transaction
-- (supabase/auth, internal/api/admin.go: tx.Create(user), then user.UpdateAppMetaData(tx, params.AppMetaData)).
-- A BEFORE INSERT trigger therefore never sees owner_flow, so 0021 refused every owner account created by
-- owner-auth. Staging logged that refusal on each signup (2026-11-23, POST /auth/v1/admin/users returned 500).
--
-- What. A deferred constraint trigger runs at COMMIT, after GoTrue has applied app_metadata, and reads the
-- row as it then stands. A row is accepted only when
--   raw_app_meta_data ->> 'owner_flow' = 'username-v1'  and  email is an owner username address.
-- Every other insert is refused, so a public email sign-up is refused whatever the dashboard setting says.
-- An update is refused only when it leaves an owner username address without owner_flow, so legacy email
-- accounts (real addresses) are not affected by it. The live test (web/tests/live/owner-auth-live.mjs) checks
-- that a public sign-up is refused on staging. supabase/tests/owner_guard_probe.sql checks the same rules
-- on a local copy of the schema.
--
-- Scope. Only the trigger on auth.users changes. No table, policy, grant or function that the app calls changes.
-- The function is not executable by anon or authenticated. A trigger function needs no EXECUTE grant to fire.

drop trigger if exists owner_guard_auth_users on auth.users;
drop function if exists public.owner_guard_auth_users();

create or replace function public.owner_guard_auth_users_at_commit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta  jsonb;
  v_email text;
begin
  -- Read the row as it stands at commit. NEW is the row as it was when the insert or update ran, before
  -- GoTrue applied app_metadata later in the same transaction.
  select u.raw_app_meta_data, u.email
    into v_meta, v_email
    from auth.users as u
   where u.id = new.id;

  if not found then
    return null;  -- removed again inside the same transaction: nothing to check
  end if;

  if coalesce(v_meta ->> 'owner_flow', '') = 'username-v1'
     and coalesce(v_email, '') ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*@accounts\.qrquick\.invalid$' then
    return null;
  end if;

  if tg_op = 'INSERT' or coalesce(v_email, '') like '%@accounts.qrquick.invalid' then
    raise exception 'Email sign-up is not available. Create an owner account with a username.'
      using errcode = '42501';
  end if;

  return null;
end;
$$;

revoke all on function public.owner_guard_auth_users_at_commit() from public, anon, authenticated;

drop trigger if exists owner_guard_auth_users_at_commit on auth.users;
create constraint trigger owner_guard_auth_users_at_commit
  after insert or update of raw_app_meta_data, email on auth.users
  deferrable initially deferred
  for each row execute function public.owner_guard_auth_users_at_commit();
