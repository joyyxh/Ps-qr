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

    if v_copies is null or v_copies not between 1 and 101 then
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
      when 'per_sheet' then (case when v_duplex then v_pages::bigint else v_pages::bigint end) * v_copies
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
