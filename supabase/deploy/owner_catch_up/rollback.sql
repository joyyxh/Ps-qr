-- EMERGENCY ROLLBACK of the owner catch-up (migrations 0010, 0018, 0019, 0020).
-- NOT part of the normal deployment. Run only with the owner's approval, and only after a backup of the
-- current state exists (backup_and_verify.sh).
--
-- Removes: every object the four migrations add (four print tables, the auto-print switch and trigger,
-- the print and rate-limit functions, the seven indexes from 0019, the two new columns, and the
-- _place_order_core function from 0020).
-- Restores: track_order to its 0009 definition and grants; expired_customer_file_paths to its 0007
-- definition and grants; both place_order overloads to their 0003 and 0009 definitions and grants;
-- memberships_read to its 0001 definition.
--
-- Rolling back 0020 brings the UPI bug back: after the rollback every UPI order fails again with
-- "customer payment method is immutable" (42501). No order or payment row is changed, but UPI cannot be
-- placed until 0020 is applied again. A forward fix is preferred over this rollback.
--
-- Refuses, changing nothing, if a print job or print agent exists, if automatic printing is on for any
-- shop, or if any customer file is marked deleted. Dropping those would delete real operational data.
-- Rate-limit counters are not guarded: they are short-lived, and dropping them only resets the
-- customer tracking limit.
--
-- Does NOT delete rows that apply_migration wrote to supabase_migrations.schema_migrations. Removing
-- ledger rows would rewrite history, so that is a separate decision for the owner.
--
-- Safe on a partly applied catch-up: every drop uses IF EXISTS.
-- Run with:  psql -X -v ON_ERROR_STOP=1 -f rollback.sql   (this file contains its own BEGIN and COMMIT)

begin;

-- 0. Guard. Any error here stops the file before a single change is made.
do $$
declare
  n bigint;
begin
  if to_regclass('public.print_jobs') is not null then
    execute 'select count(*) from public.print_jobs' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_jobs has % rows. Nothing was changed.', n; end if;
  end if;
  if to_regclass('public.print_agents') is not null then
    execute 'select count(*) from public.print_agents' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_agents has % rows. Nothing was changed.', n; end if;
  end if;
  if to_regclass('public.print_agent_pairings') is not null then
    execute 'select count(*) from public.print_agent_pairings' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_agent_pairings has % rows. Nothing was changed.', n; end if;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'shops' and column_name = 'auto_print_enabled') then
    execute 'select count(*) from public.shops where auto_print_enabled' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: automatic printing is on for % shop(s). Nothing was changed.', n; end if;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customer_files' and column_name = 'storage_deleted_at') then
    execute 'select count(*) from public.customer_files where storage_deleted_at is not null' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: % customer file(s) are marked deleted. Nothing was changed.', n; end if;
  end if;
end $$;

-- 1. Restore the replaced functions. The bodies and grants are copied from 0009 and 0007.
create or replace function public.track_order(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tracking_code', o.tracking_code,
    'status', o.status,
    'total_paise', o.total_paise,
    'shop_name', s.name,
    'created_at', o.created_at,
    'payment_method', o.customer_payment_method,
    'payment_status', o.payment_status,
    'payment_rejection_reason', o.payment_rejection_reason,
    'cash_payment_timing', s.cash_payment_timing
  )
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.tracking_code = upper(trim(p_code));
$$;

revoke execute on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;

create or replace function public.expired_customer_file_paths(p_limit integer default 100)
returns table (id uuid, storage_path text)
language sql
security definer
set search_path = public
as $$
  select id, storage_path
  from public.customer_files
  where claimed_order_id is null
    and expires_at <= now()
  order by expires_at
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
$$;

revoke all on function public.expired_customer_file_paths(integer) from public, anon, authenticated;
grant execute on function public.expired_customer_file_paths(integer) to service_role;

-- 1b. Restore both place_order overloads with the bodies and grants that were in force before 0020.
-- The three-argument version is the 0003 body. The four-argument version is the 0009 body, which
-- replaced the 0008 body, so 0008 is not the source.
create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop     public.shops%rowtype;
  v_priced   jsonb;
  v_total    bigint;
  v_order_id uuid;
  v_code     text;
  v_line     jsonb;
  v_note     text;
  v_claimed  integer;
begin
  v_note := nullif(trim(coalesce(p_customer_note, '')), '');
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'customer note is too long' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where slug = lower(trim(p_shop_slug));
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if not v_shop.is_open then
    raise exception 'shop is closed' using errcode = 'P0001';
  end if;

  v_priced := public._price_order_items(v_shop.id, p_items);
  v_total  := (v_priced->>'total_paise')::bigint;

  v_code := public.new_tracking_code();
  insert into public.orders (shop_id, tracking_code, total_paise, customer_note)
  values (v_shop.id, v_code, v_total, v_note)
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_priced->'items') loop
    -- Claim first. The update only matches while the file is still unclaimed, so two
    -- orders racing for the same file cannot both succeed. The claim is in this
    -- transaction, so a failure anywhere rolls back the order too.
    update public.customer_files
       set claimed_order_id = v_order_id
     where id = (v_line->>'file_id')::uuid
       and shop_id = v_shop.id
       and claimed_order_id is null
       and expires_at > now();
    get diagnostics v_claimed = row_count;
    if v_claimed <> 1 then
      raise exception 'file not found or no longer available' using errcode = 'P0002';
    end if;

    insert into public.order_items (
      order_id, shop_id, service_id, service_name, pricing_unit,
      file_id, file_name, page_count, copies, colour, duplex,
      billable_units, unit_price_paise, amount_paise
    ) values (
      v_order_id, v_shop.id,
      (v_line->>'service_id')::uuid,
      v_line->>'service_name',
      v_line->>'pricing_unit',
      (v_line->>'file_id')::uuid,
      v_line->>'file_name',
      (v_line->>'page_count')::integer,
      (v_line->>'copies')::integer,
      (v_line->>'colour')::boolean,
      (v_line->>'duplex')::boolean,
      (v_line->>'billable_units')::integer,
      (v_line->>'unit_price_paise')::integer,
      (v_line->>'amount_paise')::integer
    );
  end loop;

  return jsonb_build_object(
    'tracking_code', v_code,
    'status',        'pending',
    'shop_name',     v_shop.name,
    'total_paise',   v_total,
    'items',         v_priced->'items'
  );
end;
$$;

revoke execute on function public.place_order(text, jsonb, text) from public;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;

create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_code text;
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
begin
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where slug = lower(trim(p_shop_slug));
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if p_payment_method = 'upi' and v_shop.payment_qr_path is null then
    raise exception 'this shop has not configured UPI payment yet' using errcode = '22023';
  end if;

  v_result := public.place_order(p_shop_slug, p_items, p_customer_note);
  v_code := v_result->>'tracking_code';

  update public.orders
     set customer_payment_method = p_payment_method,
         payment_status = case when p_payment_method = 'upi' then 'pending' else 'unpaid' end,
         payment_channel = case when p_payment_method = 'upi' then 'online' else null end
   where tracking_code = v_code
  returning * into v_order;

  return v_result || jsonb_build_object(
    'payment_method', v_order.customer_payment_method,
    'payment_status', v_order.payment_status,
    'cash_payment_timing', v_shop.cash_payment_timing
  );
end;
$$;

revoke execute on function public.place_order(text, jsonb, text, text) from public;
grant execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;

-- 1c. Remove the 0020 core. Nothing calls it once both overloads are restored above.
drop function if exists public._place_order_core(text, jsonb, text, text);

-- 2. Restore the membership read policy to its 0001 definition.
drop policy if exists memberships_read on public.shop_memberships;
create policy memberships_read on public.shop_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_shop_owner(shop_id));

-- 3. Remove the auto-print trigger and its functions (0018). The trigger goes first.
drop trigger if exists orders_auto_print on public.orders;
drop function if exists public.auto_print_on_approval();
drop function if exists public._queue_order_for_print(uuid, uuid);
drop function if exists public.set_auto_print(uuid, boolean);

-- 4. Remove the print and rate-limit functions added by 0010 (approve_order_for_print is replaced by 0018).
drop function if exists public.approve_order_for_print(uuid);
drop function if exists public.create_print_agent_pairing(uuid);
drop function if exists public.owner_print_status(uuid);
drop function if exists public.revoke_print_agent(uuid);
drop function if exists public.set_print_agent_printer(uuid, text);
drop function if exists public.retry_print_job(uuid, boolean);
drop function if exists public.consume_print_pairing(text, text, text, text, text);
drop function if exists public.agent_heartbeat(text, text, jsonb);
drop function if exists public.agent_claim_next_job(text);
drop function if exists public.agent_mark_printing(text, uuid, integer);
drop function if exists public.agent_finish_job(text, uuid, integer, text, text, text);
drop function if exists public.mark_customer_file_deleted(uuid);
drop function if exists public.purge_old_rate_limits();
drop function if exists public.recover_expired_print_jobs(uuid);
drop function if exists public.agent_for_token(text);
drop function if exists public.print_code_hash(text);
drop function if exists public.new_print_pairing_code();
drop function if exists public.request_client_key();
drop function if exists public.consume_rate_limit(text, integer, integer);

-- 5. Remove the seven indexes added by 0019 (none of them existed before the catch-up).
drop index if exists public.customer_files_shop_id_idx;
drop index if exists public.customer_files_claimed_order_id_idx;
drop index if exists public.order_items_file_same_shop_idx;
drop index if exists public.order_items_order_id_shop_id_idx;
drop index if exists public.order_items_service_id_shop_id_idx;
drop index if exists public.orders_payment_verified_by_idx;
drop index if exists public.shop_memberships_user_id_idx;

-- 6. Remove the tables and columns added by 0010 and 0018.
drop table if exists public.print_jobs;
drop table if exists public.print_agent_pairings;
drop table if exists public.print_agents;
drop table if exists public.rate_limits;
alter table public.customer_files drop column if exists storage_deleted_at;
alter table public.shops drop column if exists auto_print_enabled;

-- 7. Verify that nothing from the catch-up is left. Any leftover stops the file, so nothing is committed.
do $$
begin
  if to_regclass('public.print_jobs') is not null
     or to_regclass('public.print_agents') is not null
     or to_regclass('public.print_agent_pairings') is not null
     or to_regclass('public.rate_limits') is not null then
    raise exception 'ROLLBACK INCOMPLETE: a print table still exists';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public'
               and ((table_name = 'shops' and column_name = 'auto_print_enabled')
                 or (table_name = 'customer_files' and column_name = 'storage_deleted_at'))) then
    raise exception 'ROLLBACK INCOMPLETE: a catch-up column still exists';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('owner_print_status', 'set_auto_print', 'auto_print_on_approval',
                                 'consume_rate_limit', 'request_client_key', 'approve_order_for_print', '_place_order_core')) then
    raise exception 'ROLLBACK INCOMPLETE: a catch-up function still exists';
  end if;
end $$;

commit;
