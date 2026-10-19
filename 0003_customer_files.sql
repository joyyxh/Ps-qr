-- =========================================================
-- PrintNest Stage 4: customer files and server-side page counts
--
-- Customers upload through the upload-file edge function. The function
-- checks the type and size, counts pages (PDF) and stores the file in a
-- private bucket. The customer_files row records the page count the
-- SERVER measured.
--
-- Order items now carry a file_id. The page count for pricing comes from
-- the customer_files row. A page_count sent by the browser is ignored.
--
-- Files are server-only. anon and authenticated get no grants and no
-- policies on customer_files or the bucket. Only the edge functions (which
-- use the service role) touch the stored bytes. Owners get a short-lived
-- signed link from owner-file-link, which first checks RLS on order_items.
--
-- Run AFTER 0001 and 0002. Applied to the live project as stage4_customer_files.
-- =========================================================

-- ---------- private bucket ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-files', 'customer-files', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- table ----------

create table public.customer_files (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete restrict,
  storage_path     text not null unique,
  mime_type        text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes       integer not null check (size_bytes between 1 and 10485760),
  page_count       integer not null check (page_count between 1 and 500),
  original_name    text not null check (char_length(original_name) between 1 and 120),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '1 day',
  claimed_order_id uuid references public.orders(id) on delete set null,
  unique (id, shop_id)
);

create index customer_files_unclaimed_expiry_idx
  on public.customer_files (expires_at)
  where claimed_order_id is null;

alter table public.customer_files enable row level security;
-- No policies on purpose: with RLS on and no policy, anon and authenticated see nothing.
-- Supabase grants table privileges to anon and authenticated by default, so revoke them too.
revoke all on public.customer_files from public, anon, authenticated;

-- ---------- order items point at the file they were priced from ----------

alter table public.order_items
  add column file_id   uuid,
  add column file_name text,
  add constraint order_items_file_name_length check (file_name is null or char_length(file_name) between 1 and 120),
  add constraint order_items_file_pair check ((file_id is null) = (file_name is null)),
  add constraint order_items_file_same_shop foreign key (file_id, shop_id)
    references public.customer_files (id, shop_id) on delete restrict;

-- One file, one order item, enforced by the database as well as by place_order.
create unique index order_items_file_unique on public.order_items (file_id) where file_id is not null;

-- ---------- pricing: page count comes from the file ----------
-- Item input: {file_id, service_id, copies, colour, duplex}.
-- page_count and any price or total field in the input are ignored.

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

-- quote_order is unchanged: it calls _price_order_items and writes nothing.

-- ---------- place_order: claims each file as the order is written ----------

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

-- ---------- grants for the new objects ----------
-- Functions keep their existing grants on replace; restated here so this file reads on its own.

revoke execute on function public._price_order_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.place_order(text, jsonb, text) from public;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;
