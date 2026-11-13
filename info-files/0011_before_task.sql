-- =========================================================
-- Migration 0011: paper sizes, surcharges and extra charges per shop.
--
-- Requires 0001-0010 (0010 defines print_jobs and approve_order_for_print).
-- Tested on the local scratch database only. Not applied to production.
--
-- What changes:
--   * shop_paper_sizes: the paper sizes a shop offers (A4, A3, Letter) and a surcharge
--     per billable unit. A shop with NO rows here offers A4 at no surcharge, which is
--     exactly how orders were priced before this migration.
--   * shop_extra_charges: charges a shop adds to orders, per order or per item.
--   * order_items.paper_size and paper_surcharge_paise, and order_charges: snapshots taken
--     when an order is placed, so later price changes never rewrite an existing order.
--   * _price_order_items, quote_order, place_order: validate and price on the server.
--   * approve_order_for_print: the print job's settings carry the order's paper size
--     (settings.paper), instead of a fixed 'A4'.
--
-- Writes to the new tables happen only through the owner functions below. Customers and
-- other shops have read access to the public settings and no write access at all.
--
-- Rollback: supabase/rollbacks/0011_service_options.down.sql
-- =========================================================

-- ---------- 1. Paper sizes per shop ----------
create table public.shop_paper_sizes (
  shop_id         uuid not null references public.shops (id) on delete cascade,
  paper_size      text not null check (paper_size in ('A4', 'A3', 'Letter')),
  is_offered      boolean not null default true,
  surcharge_paise integer not null default 0 check (surcharge_paise between 0 and 100000),
  primary key (shop_id, paper_size)
);

-- ---------- 2. Extra charges per shop ----------
create table public.shop_extra_charges (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 60),
  amount_paise integer not null check (amount_paise between 0 and 100000),
  basis        text not null check (basis in ('per_order', 'per_item')),
  is_active    boolean not null default true,
  sort_order   integer not null default 0 check (sort_order between 0 and 100),
  unique (id, shop_id)
);

-- ---------- 3. Order snapshots ----------
alter table public.order_items
  add column paper_size text check (paper_size in ('A4', 'A3', 'Letter')),
  add column paper_surcharge_paise integer
    check (paper_surcharge_paise is null or paper_surcharge_paise between 0 and 100000);

create table public.order_charges (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  shop_id      uuid not null references public.shops (id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 60),
  basis        text not null check (basis in ('per_order', 'per_item')),
  quantity     integer not null check (quantity >= 1),
  amount_paise integer not null check (amount_paise between 0 and 100000),
  total_paise  integer not null check (total_paise >= 0),
  created_at   timestamptz not null default now()
);

-- ---------- 4. Row-level security and grants ----------
alter table public.shop_paper_sizes enable row level security;
alter table public.shop_extra_charges enable row level security;
alter table public.order_charges enable row level security;

revoke all on public.shop_paper_sizes from anon, authenticated;
grant select on public.shop_paper_sizes to anon, authenticated;
create policy shop_paper_sizes_public_read on public.shop_paper_sizes
  for select to anon, authenticated using (true);

revoke all on public.shop_extra_charges from anon, authenticated;
grant select on public.shop_extra_charges to anon, authenticated;
-- Customers see active charges. Owners also see the inactive ones, to edit them.
-- Two policies rather than one OR: the owner check is not granted to anon.
create policy shop_extra_charges_public_read on public.shop_extra_charges
  for select to anon, authenticated using (is_active);
create policy shop_extra_charges_owner_read on public.shop_extra_charges
  for select to authenticated using (public.is_shop_owner(shop_id));

revoke all on public.order_charges from anon, authenticated;
grant select on public.order_charges to authenticated;
create policy order_charges_owner_read on public.order_charges
  for select to authenticated using (public.is_shop_owner(shop_id));

-- The charges an order was placed with are a price snapshot, like order_items. Nothing may change them
-- after placement. Deleting an order still cascades to its charges, as it does to its items.
create or replace function public.forbid_order_charge_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'order charges are an immutable price snapshot' using errcode = '42501';
end;
$$;

create trigger order_charges_immutable
before update on public.order_charges
for each row execute function public.forbid_order_charge_changes();

-- Lookups by order (tracking, print) and by shop (owner statistics and screens).
create index order_charges_order_id_idx on public.order_charges (order_id);
create index order_charges_shop_id_idx on public.order_charges (shop_id);

-- ---------- 5. Owner functions: the only way to change the settings ----------
create or replace function public.set_paper_sizes(p_shop_id uuid, p_sizes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       jsonb;
  v_size      text;
  v_seen      text[] := array[]::text[];
  v_offered   integer := 0;
  v_surcharge integer;
  v_saved     jsonb;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to change this shop' using errcode = '42501';
  end if;
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'array'
     or jsonb_array_length(p_sizes) not between 1 and 3 then
    raise exception 'paper sizes must be a list of one to three sizes' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_sizes) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'each paper size must be an object' using errcode = '22023';
    end if;
    v_size := v_row->>'paper_size';
    if v_size is null or v_size not in ('A4', 'A3', 'Letter') then
      raise exception 'unknown paper size' using errcode = '22023';
    end if;
    if v_size = any (v_seen) then
      raise exception 'each paper size can be listed once' using errcode = '22023';
    end if;
    v_seen := v_seen || v_size;

    if jsonb_typeof(v_row->'offered') is distinct from 'boolean' then
      raise exception 'offered must be yes or no' using errcode = '22023';
    end if;
    if v_row ? 'surcharge_paise' and jsonb_typeof(v_row->'surcharge_paise') is distinct from 'number' then
      raise exception 'the surcharge must be a whole number of paise' using errcode = '22023';
    end if;
    v_surcharge := coalesce((v_row->>'surcharge_paise')::integer, 0);
    if v_surcharge not between 0 and 100000 then
      raise exception 'the surcharge must be between 0 and Rs 1000' using errcode = '22023';
    end if;
    if (v_row->>'offered')::boolean then
      v_offered := v_offered + 1;
    end if;
  end loop;

  if v_offered = 0 then
    raise exception 'offer at least one paper size' using errcode = '22023';
  end if;

  -- Two saves at once would otherwise both delete, then both insert, and merge their lists.
  -- Locking the shop row makes the second save wait for the first.
  perform 1 from public.shops where id = p_shop_id for update;
  delete from public.shop_paper_sizes where shop_id = p_shop_id;
  insert into public.shop_paper_sizes (shop_id, paper_size, is_offered, surcharge_paise)
  select p_shop_id,
         r->>'paper_size',
         (r->>'offered')::boolean,
         coalesce((r->>'surcharge_paise')::integer, 0)
  from jsonb_array_elements(p_sizes) as e(r);

  select coalesce(jsonb_agg(jsonb_build_object(
           'paper_size', paper_size,
           'offered', is_offered,
           'surcharge_paise', surcharge_paise)
         order by array_position(array['A4', 'A3', 'Letter'], paper_size)), '[]'::jsonb)
    into v_saved
  from public.shop_paper_sizes
  where shop_id = p_shop_id;

  return v_saved;
end;
$$;

create or replace function public.set_extra_charges(p_shop_id uuid, p_charges jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    jsonb;
  v_label  text;
  v_amount integer;
  v_basis  text;
  v_saved  jsonb;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to change this shop' using errcode = '42501';
  end if;
  if p_charges is null or jsonb_typeof(p_charges) <> 'array'
     or jsonb_array_length(p_charges) > 10 then
    raise exception 'a shop can have up to 10 extra charges' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_charges) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'each charge must be an object' using errcode = '22023';
    end if;
    v_label := btrim(coalesce(v_row->>'label', ''));
    if char_length(v_label) not between 1 and 60 then
      raise exception 'each charge needs a name of 1 to 60 characters' using errcode = '22023';
    end if;
    if jsonb_typeof(v_row->'amount_paise') is distinct from 'number' then
      raise exception 'the charge must be a whole number of paise' using errcode = '22023';
    end if;
    v_amount := (v_row->>'amount_paise')::integer;
    if v_amount not between 0 and 100000 then
      raise exception 'a charge must be between Rs 0 and Rs 1000' using errcode = '22023';
    end if;
    v_basis := v_row->>'basis';
    if v_basis is null or v_basis not in ('per_order', 'per_item') then
      raise exception 'a charge is per order or per item' using errcode = '22023';
    end if;
    if v_row ? 'is_active' and jsonb_typeof(v_row->'is_active') is distinct from 'boolean' then
      raise exception 'active must be yes or no' using errcode = '22023';
    end if;
  end loop;

  perform 1 from public.shops where id = p_shop_id for update;
  delete from public.shop_extra_charges where shop_id = p_shop_id;
  insert into public.shop_extra_charges (shop_id, label, amount_paise, basis, is_active, sort_order)
  select p_shop_id,
         btrim(e.r->>'label'),
         (e.r->>'amount_paise')::integer,
         e.r->>'basis',
         coalesce((e.r->>'is_active')::boolean, true),
         e.n::integer - 1
  from jsonb_array_elements(p_charges) with ordinality as e(r, n);

  select coalesce(jsonb_agg(jsonb_build_object(
           'label', label,
           'amount_paise', amount_paise,
           'basis', basis,
           'is_active', is_active)
         order by sort_order, id), '[]'::jsonb)
    into v_saved
  from public.shop_extra_charges
  where shop_id = p_shop_id;

  return v_saved;
end;
$$;

revoke execute on function public.set_paper_sizes(uuid, jsonb) from public, anon;
grant execute on function public.set_paper_sizes(uuid, jsonb) to authenticated;
revoke execute on function public.set_extra_charges(uuid, jsonb) from public, anon;
grant execute on function public.set_extra_charges(uuid, jsonb) to authenticated;

-- ---------- 6. Server-side pricing ----------
-- Same rules as 0004, plus: the paper size (default A4), the shop's surcharge per billable
-- unit, and the shop's active extra charges. Totals are whole paise.
create or replace function public._price_order_items(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_service      public.services%rowtype;
  v_file         public.customer_files%rowtype;
  v_features     jsonb;
  v_paper_rows   integer;
  v_paper        public.shop_paper_sizes%rowtype;
  v_charge       public.shop_extra_charges%rowtype;
  v_item         jsonb;
  v_priced       jsonb := '[]'::jsonb;
  v_charges      jsonb := '[]'::jsonb;
  v_file_ids     uuid[] := array[]::uuid[];
  v_file_id      uuid;
  v_paper_size   text;
  v_surcharge    integer;
  v_pages        integer;
  v_copies       integer;
  v_colour       boolean;
  v_duplex       boolean;
  v_unit_price   integer;
  v_units        bigint;
  v_amount       bigint;
  v_items_total  bigint := 0;
  v_charge_qty   integer;
  v_charge_total bigint;
  v_total        bigint := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'an order needs between 1 and 20 items' using errcode = '22023';
  end if;

  select features into v_features from public.shops where id = p_shop_id;
  select count(*) into v_paper_rows from public.shop_paper_sizes where shop_id = p_shop_id;

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

    -- Paper size. An item without one is A4, which is how older app versions ordered.
    v_paper_size := coalesce(nullif(v_item->>'paper_size', ''), 'A4');
    if v_paper_size not in ('A4', 'A3', 'Letter') then
      raise exception 'unknown paper size' using errcode = '22023';
    end if;
    if v_paper_rows = 0 then
      -- The shop has saved no paper settings: A4 at no surcharge, nothing else.
      if v_paper_size <> 'A4' then
        raise exception 'this shop does not offer that paper size' using errcode = '22023';
      end if;
      v_surcharge := 0;
    else
      select * into v_paper
      from public.shop_paper_sizes
      where shop_id = p_shop_id and paper_size = v_paper_size;
      if not found or not v_paper.is_offered then
        raise exception 'this shop does not offer that paper size' using errcode = '22023';
      end if;
      v_surcharge := v_paper.surcharge_paise;
    end if;

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

    -- The paper surcharge is added to every billable unit.
    v_amount := v_units * (v_unit_price + v_surcharge);
    v_items_total := v_items_total + v_amount;

    v_priced := v_priced || jsonb_build_array(jsonb_build_object(
      'service_id',           v_service.id,
      'service_name',         v_service.name,
      'pricing_unit',         v_service.pricing_unit,
      'file_id',              v_file.id,
      'file_name',            v_file.original_name,
      'page_count',           v_pages,
      'copies',               v_copies,
      'colour',               v_colour,
      'duplex',               v_duplex,
      'paper_size',           v_paper_size,
      'paper_surcharge_paise', v_surcharge,
      'billable_units',       v_units,
      'unit_price_paise',     v_unit_price,
      'amount_paise',         v_amount
    ));
  end loop;

  -- Extra charges the shop has switched on. Per-order charges count once; per-item
  -- charges count once for each item in the order.
  for v_charge in
    select * from public.shop_extra_charges
     where shop_id = p_shop_id and is_active
     order by sort_order, id
  loop
    v_charge_qty   := case when v_charge.basis = 'per_order' then 1 else jsonb_array_length(v_priced) end;
    v_charge_total := v_charge_qty::bigint * v_charge.amount_paise;
    v_charges := v_charges || jsonb_build_array(jsonb_build_object(
      'label',        v_charge.label,
      'basis',        v_charge.basis,
      'quantity',     v_charge_qty,
      'amount_paise', v_charge.amount_paise,
      'total_paise',  v_charge_total));
  end loop;

  select coalesce(sum((c->>'total_paise')::bigint), 0) into v_charge_total
  from jsonb_array_elements(v_charges) as c;
  v_total := v_items_total + v_charge_total;

  if v_total > 1000000 then
    raise exception 'order total exceeds the online limit of Rs 10,000' using errcode = '22023';
  end if;

  return jsonb_build_object('items', v_priced, 'charges', v_charges, 'total_paise', v_total);
end;
$$;

-- ---------- 7. quote_order returns the charges too ----------
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
    'items',       v_priced->'items',
    'charges',     v_priced->'charges'
  );
end;
$$;

-- ---------- 8. place_order stores the paper size and the charge snapshots ----------
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
  v_charge   jsonb;
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
      billable_units, unit_price_paise, amount_paise,
      paper_size, paper_surcharge_paise
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
      (v_line->>'amount_paise')::integer,
      v_line->>'paper_size',
      (v_line->>'paper_surcharge_paise')::integer
    );
  end loop;

  for v_charge in select * from jsonb_array_elements(v_priced->'charges') loop
    insert into public.order_charges (
      order_id, shop_id, label, basis, quantity, amount_paise, total_paise
    ) values (
      v_order_id, v_shop.id,
      v_charge->>'label',
      v_charge->>'basis',
      (v_charge->>'quantity')::integer,
      (v_charge->>'amount_paise')::integer,
      (v_charge->>'total_paise')::integer
    );
  end loop;

  return jsonb_build_object(
    'tracking_code', v_code,
    'status',        'pending',
    'shop_name',     v_shop.name,
    'total_paise',   v_total,
    'items',         v_priced->'items',
    'charges',       v_priced->'charges'
  );
end;
$$;

-- ---------- 9. The print job carries the order's paper size ----------
-- Changed line only: 'paper' was the constant 'A4'. Orders placed before this migration
-- have no paper size on their items and still print on A4.
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
        'paper', coalesce(v_item.paper_size, 'A4'),
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

-- ---------- 7. Statistics: how the order value splits into items and extra charges ----------
-- Accounting rule (documented for the owner in the statistics screen):
--   * order value = the sum of each live order's total, which already includes extra charges;
--   * items = each order item's amount, which includes its paper surcharge;
--   * extra charges = the order-level charges (per order and per file) of those same orders;
--   * items + extra charges = order value, for orders placed in the period and not cancelled or rejected.
-- The per-service table shows items only. Extra charges are not split across services.
-- A separate function, so shop_stats_summary (0006) stays as it was.
create or replace function public.shop_stats_revenue_split(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start   timestamptz;
  v_end     timestamptz;
  v_orders  bigint;
  v_value   bigint;
  v_items   bigint;
  v_charges bigint;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to see this shop''s statistics' using errcode = '42501';
  end if;
  perform public._stats_check_range(p_from, p_to);

  v_start := (p_from::timestamp) at time zone 'Asia/Kolkata';
  v_end   := ((p_to + 1)::timestamp) at time zone 'Asia/Kolkata';

  select count(*), coalesce(sum(o.total_paise), 0)
    into v_orders, v_value
  from public.orders o
  where o.shop_id = p_shop_id
    and o.status not in ('cancelled', 'rejected')
    and o.created_at >= v_start and o.created_at < v_end;

  select coalesce(sum(oi.amount_paise), 0)
    into v_items
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.shop_id = p_shop_id
    and o.status not in ('cancelled', 'rejected')
    and o.created_at >= v_start and o.created_at < v_end;

  select coalesce(sum(oc.total_paise), 0)
    into v_charges
  from public.order_charges oc
  join public.orders o on o.id = oc.order_id
  where oc.shop_id = p_shop_id
    and o.status not in ('cancelled', 'rejected')
    and o.created_at >= v_start and o.created_at < v_end;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'orders', v_orders,
    'order_value_paise', v_value,
    'items_paise', v_items,
    'extra_charges_paise', v_charges
  );
end;
$$;

revoke execute on function public.shop_stats_revenue_split(uuid, date, date) from public, anon;
grant execute on function public.shop_stats_revenue_split(uuid, date, date) to authenticated;
