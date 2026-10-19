-- =========================================================
-- PrintNest Stage 6: shop features (yes/no), payment QR, and the database
-- side of the shop QR code.
--
-- Owners switch features on and off with set_shop_features. Two of them are
-- enforced when an order is priced (colour printing and double-sided). The
-- others are shown on the customer page only. feature_catalog says which is which.
--
-- The payment QR is a picture in the public bucket shop-assets, so customers
-- can scan it. Owners upload it straight to Storage, but only into their own
-- shop's folder (storage policies below). set_payment_qr then stores the path
-- after checking that the file really exists.
--
-- Run AFTER 0001-0003. Applied to the live project as stage6_shop_features_payment_qr.
-- =========================================================

-- ---------- feature catalogue ----------

create table public.feature_catalog (
  key            text primary key check (key ~ '^[a-z_]{3,40}$'),
  label          text not null check (char_length(label) between 1 and 60),
  affects_orders boolean not null,
  sort_order     integer not null unique
);

alter table public.feature_catalog enable row level security;
create policy feature_catalog_public_read on public.feature_catalog
  for select to anon, authenticated
  using (true);
revoke all on public.feature_catalog from public, anon, authenticated;
grant select on public.feature_catalog to anon, authenticated;

insert into public.feature_catalog (key, label, affects_orders, sort_order) values
  ('colour_printing', 'Colour printing',         true,  1),
  ('double_sided',    'Double-sided printing',   true,  2),
  ('photocopy',       'Photocopy',               false, 3),
  ('scanning',        'Scanning',                false, 4),
  ('spiral_binding',  'Spiral or comb binding',  false, 5),
  ('lamination',      'Lamination',              false, 6),
  ('passport_photos', 'Passport photos',         false, 7),
  ('stapling',        'Stapling',                false, 8);

-- ---------- shop columns ----------
-- New shops start with colour and double-sided on, everything else off.

alter table public.shops
  add column features jsonb not null default '{
    "colour_printing": true,
    "double_sided": true,
    "photocopy": false,
    "scanning": false,
    "spiral_binding": false,
    "lamination": false,
    "passport_photos": false,
    "stapling": false
  }'::jsonb,
  add column payment_qr_path text,
  add constraint shops_features_is_object check (jsonb_typeof(features) = 'object'),
  add constraint shops_payment_qr_path_shape check (
    payment_qr_path is null
    or payment_qr_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/payment-qr-[0-9a-f]{8}\.(png|jpg)$'
  );

-- ---------- pricing: colour and double-sided follow the shop's features ----------
-- Same logic as 0003, plus two checks. The check runs in the pricing function, which
-- both quote_order and place_order use, so a customer cannot get around it by editing the page.

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

-- ---------- payment QR bucket: public read, owner write inside their own folder ----------
-- The payment QR is meant to be scanned by customers, so reads are public.
-- Owners may add or remove files only under <their shop id>/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy shop_assets_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and public.is_shop_owner(s.id)
    )
  );

create policy shop_assets_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and public.is_shop_owner(s.id)
    )
  );

-- ---------- RPC: owners switch features on or off ----------
-- Only known feature keys with yes/no values are accepted. Keys not sent stay as they are.

create or replace function public.set_shop_features(p_shop_id uuid, p_features jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key   text;
  v_value jsonb;
  v_saved jsonb;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to change this shop' using errcode = '42501';
  end if;
  if p_features is null or jsonb_typeof(p_features) <> 'object' then
    raise exception 'features must be an object' using errcode = '22023';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_features) loop
    if not exists (select 1 from public.feature_catalog c where c.key = v_key) then
      raise exception 'unknown feature: %', v_key using errcode = '22023';
    end if;
    if jsonb_typeof(v_value) <> 'boolean' then
      raise exception 'feature % must be yes or no', v_key using errcode = '22023';
    end if;
  end loop;

  update public.shops
     set features = features || p_features
   where id = p_shop_id
  returning features into v_saved;

  return v_saved;
end;
$$;

-- ---------- RPC: owners attach (or remove) the uploaded payment QR ----------

create or replace function public.set_payment_qr(p_shop_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to change this shop' using errcode = '42501';
  end if;

  if p_path is null then
    update public.shops set payment_qr_path = null where id = p_shop_id;
    return null;
  end if;

  -- The file must sit in this shop's own folder and must really be uploaded.
  if p_path not like p_shop_id::text || '/%' then
    raise exception 'that file does not belong to this shop' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'shop-assets' and o.name = p_path
  ) then
    raise exception 'the payment QR file was not found. Upload it again.' using errcode = 'P0002';
  end if;

  update public.shops set payment_qr_path = p_path where id = p_shop_id;
  return p_path;
end;
$$;

-- ---------- grants ----------

revoke execute on function public._price_order_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.set_shop_features(uuid, jsonb) from public, anon;
grant execute on function public.set_shop_features(uuid, jsonb) to authenticated;
revoke execute on function public.set_payment_qr(uuid, text) from public, anon;
grant execute on function public.set_payment_qr(uuid, text) to authenticated;
