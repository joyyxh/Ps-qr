-- =========================================================
-- Rollback for migration 0011_service_options.sql.
--
-- Restores the four functions 0011 replaced, exactly as they were in 0001, 0003, 0004 and
-- 0010, then removes the 0011 objects. Run it only when 0011 is the latest migration applied.
--
-- DATA LOSS: the paper-size and extra-charge settings, the order_charges rows, and the
-- paper_size and paper_surcharge_paise values on order_items are deleted. Export them
-- first if they matter. Orders keep their stored totals and their other fields.
--
-- Tested on the local scratch database: supabase/tests/scratch/run.sh --rollback 0011
-- =========================================================

begin;

-- ---------- guard: refuse to delete order data unless the operator confirms ----------
-- Settings can always be re-entered. Order charges and paper choices on past orders cannot, so
-- the rollback stops when any exist. To accept the loss, run:
--   set qrquick.allow_data_loss = 'on';  before this script, in the same session.
do $$
declare
  v_has_data boolean := false;
begin
  -- Nothing to protect if 0011 is not in place (for example, the rollback was already run).
  if to_regclass('public.order_charges') is not null then
    execute $q$
      select exists (select 1 from public.order_charges)
          or exists (select 1 from public.order_items
                     where (paper_size is not null and paper_size <> 'A4') or coalesce(paper_surcharge_paise, 0) > 0)
    $q$ into v_has_data;
  end if;
  if v_has_data and coalesce(current_setting('qrquick.allow_data_loss', true), '') <> 'on' then
    raise exception 'rolling back 0011 would delete order charges or paper choices on past orders. Export them, then set qrquick.allow_data_loss = on to confirm.'
      using errcode = '55000';
  end if;
end;
$$;

-- ---------- restore: quote_order (from 0001) ----------
create or replace function public.quote_order(p_shop_slug text, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop   public.shops%rowtype;
  v_priced jsonb;
begin
  select * into v_shop from public.shops where slug = lower(trim(p_shop_slug));
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if not v_shop.is_open then
    raise exception 'shop is closed' using errcode = 'P0001';
  end if;

  v_priced := public._price_order_items(v_shop.id, p_items);
  return jsonb_build_object(
    'shop_name',   v_shop.name,
    'total_paise', (v_priced->>'total_paise')::bigint,
    'items',       v_priced->'items'
  );
end;
$$;

-- ---------- restore: _price_order_items (from 0004) ----------
create or replace function public._price_order_items(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_service    public.services%rowtype;
  v_file       public.customer_files%rowtype;
  v_features   jsonb;
  v_item       jsonb;
  v_priced     jsonb := '[]'::jsonb;
  v_file_ids   uuid[] := array[]::uuid[];
  v_file_id    uuid;
  v_pages      integer;
  v_copies     integer;
  v_colour     boolean;
  v_duplex     boolean;
  v_unit_price integer;
  v_units      bigint;
  v_amount     bigint;
  v_total      bigint := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'an order needs between 1 and 20 items' using errcode = '22023';
  end if;

  select features into v_features from public.shops where id = p_shop_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service
    from public.services
    where id = (v_item->>'service_id')::uuid
      and shop_id = p_shop_id
      and is_active;
    if not found then
      raise exception 'service is not available at this shop' using errcode = 'P0002';
    end if;

    if v_item->>'file_id' is null then
      raise exception 'each item needs an uploaded file' using errcode = '22023';
    end if;
    v_file_id := (v_item->>'file_id')::uuid;
    if v_file_id = any (v_file_ids) then
      raise exception 'each file can be used once per order' using errcode = '22023';
    end if;

    -- The file must belong to this shop, be unclaimed and not expired.
    select * into v_file
    from public.customer_files
    where id = v_file_id
      and shop_id = p_shop_id
      and claimed_order_id is null
      and expires_at > now();
    if not found then
      raise exception 'file not found or no longer available' using errcode = 'P0002';
    end if;
    v_file_ids := v_file_ids || v_file_id;

    v_pages  := v_file.page_count;
    v_copies := (v_item->>'copies')::integer;
    v_colour := coalesce((v_item->>'colour')::boolean, false);
    v_duplex := coalesce((v_item->>'duplex')::boolean, false);

    if v_copies is null or v_copies not between 1 and 100 then
      raise exception 'copies must be between 1 and 100' using errcode = '22023';
    end if;

    if v_colour and not coalesce((v_features->>'colour_printing')::boolean, false) then
      raise exception 'this shop is not offering colour printing right now' using errcode = '22023';
    end if;
    if v_duplex and not coalesce((v_features->>'double_sided')::boolean, false) then
      raise exception 'this shop is not offering double-sided printing right now' using errcode = '22023';
    end if;

    v_unit_price := case when v_colour then v_service.colour_price_paise else v_service.bw_price_paise end;
    if v_unit_price is null then
      raise exception 'this service is not offered in the requested colour mode' using errcode = '22023';
    end if;

    -- per_side : every printed side is billed (duplex does not change the side count)
    -- per_sheet: every physical sheet is billed (duplex halves the sheet count)
    -- per_copy : one charge per copy, regardless of page count
    v_units := case v_service.pricing_unit
      when 'per_side'  then v_pages::bigint * v_copies
      when 'per_sheet' then (case when v_duplex then ceil(v_pages / 2.0)::bigint else v_pages::bigint end) * v_copies
      when 'per_copy'  then v_copies::bigint
    end;

    v_amount := v_units * v_unit_price;
    v_total  := v_total + v_amount;

    v_priced := v_priced || jsonb_build_array(jsonb_build_object(
      'service_id',       v_service.id,
      'service_name',     v_service.name,
      'pricing_unit',     v_service.pricing_unit,
      'file_id',          v_file.id,
      'file_name',        v_file.original_name,
      'page_count',       v_pages,
      'copies',           v_copies,
      'colour',           v_colour,
      'duplex',           v_duplex,
      'billable_units',   v_units,
      'unit_price_paise', v_unit_price,
      'amount_paise',     v_amount
    ));
  end loop;

  if v_total > 1000000 then
    raise exception 'order total exceeds the online limit of Rs 10,000' using errcode = '22023';
  end if;

  return jsonb_build_object('items', v_priced, 'total_paise', v_total);
end;
$$;

-- ---------- restore: place_order, 3-argument (from 0003) ----------
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

-- ---------- restore: approve_order_for_print (from 0010) ----------
create or replace function public.approve_order_for_print(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_item   public.order_items%rowtype;
  v_queued integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_shop_owner(v_order.shop_id) then
    raise exception 'you do not have permission to change this order' using errcode = '42501';
  end if;
  if v_order.status not in ('approved', 'printing') then
    raise exception 'only an approved order can be sent to print' using errcode = '22023';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'verify the payment before printing' using errcode = '22023';
  end if;

  for v_item in
    select * from public.order_items where order_id = p_order_id order by id
  loop
    if v_item.file_id is null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'order_item_id', v_item.id, 'name', v_item.service_name, 'reason', 'no_file'));
      continue;
    end if;
    if exists (select 1 from public.print_jobs j where j.order_item_id = v_item.id) then
      continue;
    end if;
    insert into public.print_jobs (shop_id, order_id, order_item_id, file_id, settings, created_by)
    values (
      v_order.shop_id, p_order_id, v_item.id, v_item.file_id,
      jsonb_build_object(
        'copies', v_item.copies,
        'colour', v_item.colour,
        'duplex', v_item.duplex,
        'paper', 'A4',
        'pages', v_item.page_count,
        'file_name', v_item.file_name
      ),
      auth.uid()
    );
    v_queued := v_queued + 1;
  end loop;

  if v_order.status = 'approved' then
    update public.orders set status = 'printing' where id = p_order_id;
  end if;

  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped);
end;
$$;

-- ---------- remove the 0011 objects ----------
drop function if exists public.set_extra_charges(uuid, jsonb);
drop function if exists public.set_paper_sizes(uuid, jsonb);

alter table public.order_items
  drop column if exists paper_surcharge_paise,
  drop column if exists paper_size;

drop function if exists public.shop_stats_revenue_split(uuid, date, date);
drop table if exists public.order_charges;
drop function if exists public.forbid_order_charge_changes();
drop table if exists public.shop_extra_charges;
drop table if exists public.shop_paper_sizes;

commit;
