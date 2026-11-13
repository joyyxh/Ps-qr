-- =========================================================
-- Migration 0014: only an owner whose email is confirmed can create a shop.
--
-- create_shop checked only that the caller was signed in. With Supabase's "Confirm email"
-- setting on, an unconfirmed owner cannot sign in at all, so this check is a second guard.
-- With "Confirm email" off, Supabase confirms each new account at sign-up, so this check
-- does not stop those accounts. Keep "Confirm email" ON in the project; it is the real control.
--
-- Existing owners are not affected. Their shops, memberships, row level security and every
-- other function stay as they are. Only creating a new shop is checked, and only for an
-- account whose email is not confirmed.
--
-- Not applied to the hosted project. Applying it needs the owner's approval.
-- Rollback: supabase/rollbacks/0014_create_shop_confirmed_email.down.sql
-- =========================================================

create or replace function public.create_shop(
  p_slug text,
  p_name text,
  p_phone text default null,
  p_address text default null
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- The owner must have confirmed the email address before creating a shop.
  if not exists (
    select 1
      from auth.users u
     where u.id = auth.uid()
       and u.email_confirmed_at is not null
  ) then
    raise exception 'confirm your email address before creating a shop' using errcode = '42501';
  end if;

  insert into public.shops (slug, name, phone, address)
  values (lower(trim(p_slug)), trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_address), ''))
  returning * into v_shop;

  insert into public.shop_memberships (shop_id, user_id, role)
  values (v_shop.id, auth.uid(), 'owner');

  return v_shop;
end;
$$;
