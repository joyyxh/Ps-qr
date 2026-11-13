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
--   * _price_order_items: a JPG or PNG picture can only be ordered on A4 (refused before charging).
--   * shop_paper_capability: a non-A4 size is refused before any charge when the shop's printers
--     reliably report that they cannot print it. Unknown capability is not refused (see the function).
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
-- ---------- printer capability: what the shop's printers reliably report ----------
-- Returns 'unsupported' only when every non-revoked print computer of the shop has a chosen printer
-- that reports a paper list, and no list has the size. Returns 'supported' as soon as one reported
-- list has it. Otherwise 'unknown': no computer, no chosen printer, a printer that reports no paper
-- list (Windows), or a list of 20 entries, which the agent may have cut short. The server never
-- assumes a printer is online or able to print a size.
create or replace function public.shop_paper_capability(p_shop_id uuid, p_paper text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent   public.print_agents%rowtype;
  v_printer jsonb;
  v_papers  jsonb;
  v_lacking boolean := false;
  v_unknown boolean := false;
begin
  for v_agent in
    select * from public.print_agents where shop_id = p_shop_id and revoked_at is null
  loop
    if v_agent.chosen_printer is null then
      v_unknown := true;
      continue;
    end if;
    select e into v_printer from jsonb_array_elements(v_agent.printers) e
     where e->>'name' = v_agent.chosen_printer
     limit 1;
    v_papers := case when v_printer is not null then v_printer->'papers' end;
    if v_papers is null or jsonb_typeof(v_papers) <> 'array' or jsonb_array_length(v_papers) = 0 then
      v_unknown := true;
      continue;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_papers) x where lower(x) = lower(p_paper)) then
      return 'supported';
    end if;
    if jsonb_array_length(v_papers) >= 20 then
      v_unknown := true;
    else
      v_lacking := true;
    end if;
  end loop;
  if v_lacking and not v_unknown then
    return 'unsupported';
  end if;
  return 'unknown';
end;
$$;

revoke execute on function public.shop_paper_capability(uuid, text) from public, anon, authenticated;

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
    -- JPG and PNG pictures are printed as one A4 page (the print agent only wraps them on A4).
    -- Refusing any other size here means the customer is not charged for an order that cannot print.
    -- A size the shop's printers reliably cannot print is refused before any charge. A4 is not
    -- checked here: a printer that names A4 differently would then refuse every order. The print
    -- agent still refuses an A4 job it cannot choose.
    if v_paper_size <> 'A4' and public.shop_paper_capability(p_shop_id, v_paper_size) = 'unsupported' then
      raise exception 'the shop printer cannot print % paper. Choose A4 or another size.', v_paper_size
        using errcode = '22023';
    end if;

    if v_file.mime_type <> 'application/pdf' and v_paper_size <> 'A4' then
      raise exception 'JPG and PNG pictures print on A4 paper only. Choose A4, or send a PDF.' using errcode = '22023';
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
-- 0012: print eligibility. Requires 0010 (print_jobs and the agent RPCs).
--
-- Why. 0010 let a queued job print after its order was refunded. set_order_payment changes
-- payment_status only, and agent_claim_next_job checked the job's status and nothing else.
-- A refund after the owner sent the order to print could therefore still reach the printer.
--
-- What changes
--   * print_jobs.status gains 'cancelled': a job that will never print.
--   * order_is_printable(order): true only while the order is paid and printing or ready. An accepted
--     order that the owner has not sent to print (approved) is not printable, even if a job is queued.
--     A refunded, cancelled, rejected, not-yet-paid or completed order is not printable.
--   * orders_cancel_unprintable_jobs: whenever an order's status or payment changes to a state
--     where it is not printable, its queued and claimed jobs are cancelled in the same
--     transaction, with a reason that says which change it was. Nothing is left in the queue
--     for an agent to pick up.
--   * agent_claim_next_job claims only jobs whose order is printable.
--   * agent_mark_printing locks the order, then the job, and refuses an order that is no
--     longer printable. A claim that races with a refund is therefore refused at the point
--     where the agent says it is about to print.
--
-- Not changed
--   * A job that is already printing when its order is refunded still prints. It cannot be
--     recalled, and the owner must check the printer (a physical limit, not a database one).
--   * Retention (expired_customer_file_paths, migration 0010) is not changed. It already keeps
--     a file while a job for it is queued, claimed, printing, needs_check, or failed on an
--     order that is still printing (the only state from which a retry is allowed).
--
-- Ready is printable. A ready order can still have a file printing or waiting (the owner may mark
-- it ready while the print computer is still working), so its queued files keep printing. Completed
-- is not printable: when an order is completed, its queued and claimed files are cancelled, with the
-- reason, so no completed order has a file that an agent can claim.
--
-- Not applied to production. Tested only on the local scratch database.
-- Rollback: supabase/rollbacks/0012_print_eligibility.down.sql

-- ---------- job status: cancelled ----------
alter table public.print_jobs drop constraint if exists print_jobs_status_check;
alter table public.print_jobs
  add constraint print_jobs_status_check
  check (status in ('queued', 'claimed', 'printing', 'sent', 'failed', 'needs_check', 'cancelled'));

-- ---------- eligibility ----------
create or replace function public.order_is_printable(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and o.payment_status = 'paid'
       and o.status in ('printing', 'ready')
  );
$$;

create or replace function public.cancel_unprintable_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  if public.order_is_printable(new.id) then
    return null;
  end if;
  v_message := case
    when new.payment_status = 'refunded' then 'The order was refunded, so this file was not printed.'
    when new.status in ('cancelled', 'rejected') then 'The order was cancelled, so this file was not printed.'
    when new.payment_status <> 'paid' then 'The order is not paid, so this file was not printed.'
    when new.status = 'completed' then 'The order was completed before this file printed, so it was not printed.'
    else 'The order is no longer waiting to print, so this file was not printed.'
  end;
  update public.print_jobs
     set status = 'cancelled',
         lease_until = null,
         error_code = 'order_not_printable',
         error_message = v_message,
         finished_at = now(),
         updated_at = now()
   where order_id = new.id
     and status in ('queued', 'claimed');
  return null;
end;
$$;

drop trigger if exists orders_cancel_unprintable_jobs on public.orders;
create trigger orders_cancel_unprintable_jobs
after update of status, payment_status on public.orders
for each row
when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
execute function public.cancel_unprintable_jobs();

-- ---------- agent RPCs (replace the 0010 versions) ----------
create or replace function public.agent_claim_next_job(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
  v_job   public.print_jobs%rowtype;
  v_file  public.customer_files%rowtype;
  v_name  text;
begin
  v_agent := public.agent_for_token(p_token_hash);
  update public.print_agents set last_seen_at = now() where id = v_agent.id;
  perform public.recover_expired_print_jobs(v_agent.shop_id);

  select j.* into v_job
    from public.print_jobs j
   where j.shop_id = v_agent.shop_id
     and j.status = 'queued'
     and public.order_is_printable(j.order_id)
     and exists (
       select 1 from public.customer_files f
        where f.id = j.file_id and f.storage_deleted_at is null
     )
   order by j.created_at
   for update skip locked
   limit 1;
  if not found then
    return null;
  end if;

  update public.print_jobs
     set status = 'claimed',
         agent_id = v_agent.id,
         claim_count = claim_count + 1,
         lease_until = now() + interval '2 minutes',
         updated_at = now()
   where id = v_job.id
  returning * into v_job;

  select * into v_file from public.customer_files where id = v_job.file_id;
  select file_name into v_name from public.order_items where id = v_job.order_item_id;

  return jsonb_build_object(
    'job_id', v_job.id,
    'attempt', v_job.attempt,
    'lease_until', v_job.lease_until,
    'storage_path', v_file.storage_path,
    'mime_type', v_file.mime_type,
    'size_bytes', v_file.size_bytes,
    'file_name', coalesce(v_name, 'QRquick job'),
    'settings', v_job.settings,
    'printer', v_agent.chosen_printer
  );
end;
$$;

create or replace function public.agent_mark_printing(p_token_hash text, p_job_id uuid, p_attempt integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent    public.print_agents%rowtype;
  v_job      public.print_jobs%rowtype;
  v_order_id uuid;
begin
  v_agent := public.agent_for_token(p_token_hash);
  -- Lock the order before the job. The cancel trigger locks in the same order, so the two cannot deadlock.
  select j.order_id into v_order_id from public.print_jobs j where j.id = p_job_id;
  if v_order_id is null then
    raise exception 'lease_lost' using errcode = 'P0001';
  end if;
  perform 1 from public.orders where id = v_order_id for update;
  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found or v_job.agent_id is distinct from v_agent.id or v_job.attempt <> p_attempt
     or v_job.status <> 'claimed' or v_job.lease_until <= now() then
    raise exception 'lease_lost' using errcode = 'P0001';
  end if;
  -- A refund, cancellation or rejection after the claim means the file must not be sent.
  if not public.order_is_printable(v_job.order_id) then
    raise exception 'order_not_printable' using errcode = 'P0001';
  end if;
  update public.print_jobs
     set status = 'printing', lease_until = now() + interval '3 minutes', updated_at = now()
   where id = p_job_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.order_is_printable(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_unprintable_jobs() from public, anon, authenticated;
-- =========================================================
-- Migration 0013: the order workflow. Requires 0001-0012.
--
-- The order the shop runs. Each step is a separate owner or customer action:
--   1. the customer requests the order; no payment yet            place_order
--   2. the owner accepts it (pending -> approved)                  owner status change (guard, 0001)
--   3. the customer pays; the owner records cash or UPI            set_order_payment
--   4. the owner approves printing (approved -> printing, files queued)
--                                                                 approve_order_for_print (0010, 0011)
--   5. the print agent prints queued files of a paid order that is printing or ready (0012)
--
-- What changes here
--   * place_order (four arguments): the customer's cash or UPI choice is written when the order
--     is created, and the order starts unpaid. Nothing is due until the owner accepts it.
--     Before this migration the UPI choice was written by an UPDATE after the insert (0009), and
--     the payment-method guard (0008) refused that change, so every UPI order was refused.
--   * place_order (three arguments, from 0011): kept for existing callers. It places a cash order.
--   * set_order_payment: a payment can be recorded only after the owner has accepted the order.
--     A pending (not yet accepted) order takes no cash or UPI payment. Clearing a pending payment,
--     refunds and the other payment rules are unchanged.
--   * A paid order cannot be cancelled or rejected until its refund is recorded
--     (orders_refund_before_stop). Otherwise the order would read Cancelled and Paid together.
--   * The owner's cash timing setting is removed. Cash is always paid after the owner accepts the
--     order and before it prints. The owner can no longer write shops.cash_payment_timing (the
--     column privilege is revoked). The column stays, unused.
--   * Paper sizes on Windows: a shop whose print computer cannot choose a tray refuses A3 and
--     Letter at order time, before any charge (shop_paper_capability, replaced here). Windows never
--     reports a paper list, and the agent refuses any non-A4 job, so such a size is never offered.
--     A chosen printer that reports no paper list counts the same way. Unknown capability (no
--     chosen printer, or a 20-entry list that may be cut short) still follows the owner's offer.
--   * shop_paper_offer (new): the sizes a customer may choose, by shop slug. A size the printer
--     refuses is shown as not offered, so customers never see a size that place_order would refuse.
--
-- Checked, not changed
--   * Recording a payment never queues or starts printing. Only approve_order_for_print does that.
--   * approve_order_for_print needs an approved order that is paid.
--   * The payment guard (0008) still refuses printing, ready or completed without a paid order.
--   * order_is_printable (0012, corrected there) allows only printing and ready orders.
--
-- Not applied to production. Tested only on the local scratch database.
-- Rollback: supabase/rollbacks/0013_order_workflow.down.sql
-- =========================================================

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

  -- The payment method is written with the order. Changing it afterwards is refused (0008).
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
  end if;
  if p_payment_method = 'upi' and v_shop.payment_qr_path is null then
    raise exception 'this shop has not configured UPI payment yet' using errcode = '22023';
  end if;

  v_priced := public._price_order_items(v_shop.id, p_items);
  v_total  := (v_priced->>'total_paise')::bigint;

  v_code := public.new_tracking_code();
  insert into public.orders (shop_id, tracking_code, total_paise, customer_note,
                             customer_payment_method, payment_status, payment_channel)
  values (v_shop.id, v_code, v_total, v_note, p_payment_method, 'unpaid', null)
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
    'charges',       v_priced->'charges',
    'payment_method',       p_payment_method,
    'payment_status',       'unpaid',
    'cash_payment_timing',  v_shop.cash_payment_timing
  );
end;
$$;

create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.place_order(p_shop_slug, p_items, p_customer_note, 'cash');
$$;

create or replace function public.set_order_payment(
  p_order_id uuid,
  p_action   text,
  p_channel  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       public.orders%rowtype;
  v_status      text;
  v_channel     text;
  v_paid_at     timestamptz;
  v_refunded_at timestamptz;
  v_refund      integer;
  v_row         public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(v_order.shop_id) then
    raise exception 'you do not have permission to change this order' using errcode = '42501';
  end if;

  -- A payment is taken only after the owner has accepted the order (pending -> approved).
  if p_action in ('set_pending', 'set_paid') and v_order.status = 'pending' then
    raise exception 'accept the order before taking a payment' using errcode = '22023';
  end if;

  v_status      := v_order.payment_status;
  v_channel     := v_order.payment_channel;
  v_paid_at     := v_order.paid_at;
  v_refunded_at := v_order.refunded_at;
  v_refund      := v_order.refund_paise;

  if p_action = 'set_pending' then
    if v_status <> 'unpaid' then
      raise exception 'only an unpaid order can be marked as payment pending' using errcode = '22023';
    end if;
    if p_channel is distinct from 'online' then
      raise exception 'a pending payment has to be online' using errcode = '22023';
    end if;
    if v_order.status in ('cancelled', 'rejected') then
      raise exception 'a cancelled or rejected order cannot take a payment' using errcode = '22023';
    end if;
    v_status  := 'pending';
    v_channel := 'online';

  elsif p_action = 'set_paid' then
    if v_status not in ('unpaid', 'pending') then
      raise exception 'this order is already paid or refunded' using errcode = '22023';
    end if;
    if p_channel is null or p_channel not in ('cash', 'online') then
      raise exception 'choose cash or online' using errcode = '22023';
    end if;
    if v_order.status in ('cancelled', 'rejected') then
      raise exception 'a cancelled or rejected order cannot take a payment' using errcode = '22023';
    end if;
    v_status  := 'paid';
    v_channel := p_channel;
    v_paid_at := now();

  elsif p_action = 'set_unpaid' then
    if v_status <> 'pending' then
      raise exception 'only a pending payment can be cleared' using errcode = '22023';
    end if;
    v_status  := 'unpaid';
    v_channel := null;

  elsif p_action = 'refund' then
    if v_status <> 'paid' then
      raise exception 'only a paid order can be refunded' using errcode = '22023';
    end if;
    v_status      := 'refunded';
    v_refunded_at := now();
    v_refund      := v_order.total_paise;

  else
    raise exception 'unknown payment action' using errcode = '22023';
  end if;

  update public.orders
     set payment_status  = v_status,
         payment_channel = v_channel,
         paid_at         = v_paid_at,
         refunded_at     = v_refunded_at,
         refund_paise    = v_refund
   where id = p_order_id
  returning * into v_row;

  return jsonb_build_object(
    'id',              v_row.id,
    'payment_status',  v_row.payment_status,
    'payment_channel', v_row.payment_channel,
    'paid_at',         v_row.paid_at,
    'refund_paise',    v_row.refund_paise
  );
end;
$$;

-- ---------- a paid order is refunded before it is cancelled or rejected ----------
-- Only a change of status is refused, so a refunded order can still be cancelled later.
create or replace function public.guard_paid_order_stop()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'rejected')
     and old.status is distinct from new.status
     and new.payment_status = 'paid' then
    raise exception 'record the refund before cancelling or rejecting a paid order' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_refund_before_stop on public.orders;
create trigger orders_refund_before_stop
before update on public.orders
for each row execute function public.guard_paid_order_stop();

revoke execute on function public.guard_paid_order_stop() from public, anon, authenticated;

-- ---------- the owner's cash timing setting is removed ----------
-- The column stays, unused. A later migration may drop it.
revoke update (cash_payment_timing) on public.shops from authenticated;

-- ---------- printer capability: a size a print computer cannot choose is refused (replaces 0011) ----------
-- The agent that claims a job is not chosen by the customer, so every active computer of the shop
-- must be able to print the size. Returns:
--   'unsupported'  a computer cannot choose the size: a Windows computer (it never reports a paper
--                  list, and the agent refuses a non-A4 job), a chosen printer whose list lacks the size,
--                  or a chosen printer that reports no list (the agent refuses a non-A4 job then too);
--   'unknown'      no active computer, a computer with no chosen printer, a chosen printer missing from
--                  its report, or a 20-entry list that may be cut short. The shop's own offer decides;
--   'supported'    every active computer has a chosen printer that reports the size.
create or replace function public.shop_paper_capability(p_shop_id uuid, p_paper text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent   public.print_agents%rowtype;
  v_printer jsonb;
  v_papers  jsonb;
  v_lacking boolean := false;
  v_unknown boolean := false;
  v_any     boolean := false;
begin
  for v_agent in
    select * from public.print_agents where shop_id = p_shop_id and revoked_at is null
  loop
    v_any := true;
    -- Windows never reports a paper list, and the agent refuses a non-A4 job it cannot choose a tray for.
    if v_agent.platform = 'windows' then
      v_lacking := true;
      continue;
    end if;
    if v_agent.chosen_printer is null then
      v_unknown := true;
      continue;
    end if;
    select e into v_printer from jsonb_array_elements(v_agent.printers) e
     where e->>'name' = v_agent.chosen_printer
     limit 1;
    if v_printer is null then
      v_unknown := true;
      continue;
    end if;
    v_papers := v_printer->'papers';
    if v_papers is null or jsonb_typeof(v_papers) <> 'array' or jsonb_array_length(v_papers) = 0 then
      v_lacking := true;
      continue;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_papers) x where lower(x) = lower(p_paper)) then
      continue;
    end if;
    if jsonb_array_length(v_papers) >= 20 then
      v_unknown := true;
    else
      v_lacking := true;
    end if;
  end loop;
  if v_lacking then
    return 'unsupported';
  end if;
  if v_unknown or not v_any then
    return 'unknown';
  end if;
  return 'supported';
end;
$$;

-- ---------- the paper sizes a customer may choose (new) ----------
-- The shop's offered sizes, with a size dropped when printer capability refuses it. The same rule as
-- place_order, so customers see only sizes that can be ordered. Owners read their own offer from
-- shop_paper_sizes, unchanged.
create or replace function public.shop_paper_offer(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'paper_size', p.paper_size,
           'is_offered', p.is_offered
                         and (p.paper_size = 'A4'
                              or public.shop_paper_capability(s.id, p.paper_size) <> 'unsupported'),
           'surcharge_paise', p.surcharge_paise
         ) order by p.paper_size), '[]'::jsonb)
    from public.shops s
    join public.shop_paper_sizes p on p.shop_id = s.id
   where s.slug = lower(trim(p_slug));
$$;

revoke execute on function public.shop_paper_offer(text) from public;
grant execute on function public.shop_paper_offer(text) to anon, authenticated;
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
