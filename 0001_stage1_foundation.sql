-- =========================================================
-- PrintNest Stage 1: tenants, services, orders, RLS, pricing
--
-- Consolidated copy of the three migrations applied to the live
-- project (stage1_foundation, fix_tracking_code_alphabet,
-- shared_pricing_and_quote_order). Run it on a FRESH project.
--
-- Conventions
--  * Money is integer paise (1 rupee = 100 paise).
--  * Customers never write orders directly. They call place_order().
--  * Prices are computed only on the server (_price_order_items).
--  * Every shop-owned row carries shop_id and is filtered by RLS.
-- =========================================================

-- ---------- tables ----------

create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  phone       text,
  address     text,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint shops_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  constraint shops_slug_reserved check (slug not in ('admin','api','www','app','login','signup','help','support')),
  constraint shops_name_length check (char_length(name) between 2 and 120)
);

create table public.shop_memberships (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','staff')),
  created_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops(id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 80),
  pricing_unit        text not null check (pricing_unit in ('per_side','per_sheet','per_copy')),
  bw_price_paise      integer check (bw_price_paise is null or bw_price_paise between 0 and 100000),
  colour_price_paise  integer check (colour_price_paise is null or colour_price_paise between 0 and 100000),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  constraint services_has_a_price check (bw_price_paise is not null or colour_price_paise is not null),
  unique (id, shop_id)
);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete restrict,
  tracking_code   text not null unique,
  status          text not null default 'pending'
                  check (status in ('pending','approved','printing','ready','completed','rejected','cancelled')),
  payment_method  text not null default 'pay_at_counter' check (payment_method in ('pay_at_counter')),
  total_paise     integer not null check (total_paise >= 0),
  customer_note   text check (customer_note is null or char_length(customer_note) <= 300),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null,
  shop_id            uuid not null,
  service_id         uuid not null,
  service_name       text not null,
  pricing_unit       text not null check (pricing_unit in ('per_side','per_sheet','per_copy')),
  page_count         integer not null check (page_count between 1 and 500),
  copies             integer not null check (copies between 1 and 100),
  colour             boolean not null,
  duplex             boolean not null,
  billable_units     integer not null check (billable_units >= 0),
  unit_price_paise   integer not null check (unit_price_paise >= 0),
  amount_paise       integer not null check (amount_paise >= 0),
  foreign key (order_id, shop_id) references public.orders(id, shop_id) on delete cascade,
  foreign key (service_id, shop_id) references public.services(id, shop_id) on delete restrict
);

create index services_shop_idx on public.services(shop_id);
create index orders_shop_created_idx on public.orders(shop_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

-- ---------- helpers ----------

create or replace function public.is_shop_member(p_shop uuid, p_roles text[] default array['owner','staff'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_shop_owner(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_shop_member(p_shop, array['owner']);
$$;

-- 8-character codes from 32 symbols (no 0/O/1/I). Customers type these.
create or replace function public.new_tracking_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  idx int;
begin
  for i in 0..7 loop
    idx := (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), i) % length(alphabet)) + 1;
    result := result || substr(alphabet, idx, 1);
  end loop;
  return result;
end;
$$;

-- ---------- integrity triggers ----------

create or replace function public.guard_order_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.total_paise is distinct from old.total_paise
     or new.shop_id is distinct from old.shop_id
     or new.tracking_code is distinct from old.tracking_code
     or new.payment_method is distinct from old.payment_method
     or new.customer_note is distinct from old.customer_note then
    raise exception 'order money and identity fields are immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'pending'   and new.status in ('approved','rejected','cancelled'))
      or (old.status = 'approved'  and new.status in ('printing','ready','completed','cancelled'))
      or (old.status = 'printing'  and new.status in ('ready','completed'))
      or (old.status = 'ready'     and new.status = 'completed')
    ) then
      raise exception 'invalid order status change from % to %', old.status, new.status
        using errcode = '22023';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_guard_changes
before update on public.orders
for each row execute function public.guard_order_changes();

create or replace function public.forbid_order_item_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'order items are an immutable price snapshot' using errcode = '42501';
end;
$$;

create trigger order_items_immutable
before update on public.order_items
for each row execute function public.forbid_order_item_changes();

-- ---------- row level security ----------

alter table public.shops             enable row level security;
alter table public.shop_memberships  enable row level security;
alter table public.services          enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;

create policy shops_public_read on public.shops
  for select to anon, authenticated
  using (true);

create policy shops_owner_update on public.shops
  for update to authenticated
  using (public.is_shop_owner(id))
  with check (public.is_shop_owner(id));

create policy memberships_read on public.shop_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_shop_owner(shop_id));

create policy memberships_owner_write on public.shop_memberships
  for all to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy services_public_read on public.services
  for select to anon, authenticated
  using (is_active or public.is_shop_member(shop_id));

create policy services_owner_write on public.services
  for all to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy orders_member_read on public.orders
  for select to authenticated
  using (public.is_shop_member(shop_id));

create policy orders_member_update on public.orders
  for update to authenticated
  using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create policy order_items_member_read on public.order_items
  for select to authenticated
  using (public.is_shop_member(shop_id));

-- ---------- grants (second line of defence) ----------

revoke all on public.shops, public.shop_memberships, public.services, public.orders, public.order_items from anon;
revoke insert, update, delete on public.shops, public.orders, public.order_items from authenticated;
grant update (name, phone, address, is_open) on public.shops to authenticated;
grant update (status) on public.orders to authenticated;
grant insert, update, delete on public.services to authenticated;
grant insert, update, delete on public.shop_memberships to authenticated;
grant select on public.shops, public.services to anon;

-- ---------- RPC: create a shop (owner membership created atomically) ----------

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

  insert into public.shops (slug, name, phone, address)
  values (lower(trim(p_slug)), trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_address), ''))
  returning * into v_shop;

  insert into public.shop_memberships (shop_id, user_id, role)
  values (v_shop.id, auth.uid(), 'owner');

  return v_shop;
end;
$$;

-- ---------- pricing: one function shared by quote and order ----------
-- Item input: {service_id, page_count, copies, colour, duplex}.
-- Any price or total field in the input is ignored.

create or replace function public._price_order_items(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_service    public.services%rowtype;
  v_item       jsonb;
  v_priced     jsonb := '[]'::jsonb;
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

    v_pages  := (v_item->>'page_count')::integer;
    v_copies := (v_item->>'copies')::integer;
    v_colour := coalesce((v_item->>'colour')::boolean, false);
    v_duplex := coalesce((v_item->>'duplex')::boolean, false);

    if v_pages is null or v_pages not between 1 and 500 then
      raise exception 'page count must be between 1 and 500' using errcode = '22023';
    end if;
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

-- Read-only preview for the customer page. Writes nothing.
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

-- Creates the order. The price is recalculated here, never taken from the browser.
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
    insert into public.order_items (
      order_id, shop_id, service_id, service_name, pricing_unit,
      page_count, copies, colour, duplex, billable_units,
      unit_price_paise, amount_paise
    ) values (
      v_order_id, v_shop.id,
      (v_line->>'service_id')::uuid,
      v_line->>'service_name',
      v_line->>'pricing_unit',
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

-- Customers look up status with the code only. Returns no customer note and no shop internals.
create or replace function public.track_order(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tracking_code', o.tracking_code,
    'status',        o.status,
    'total_paise',   o.total_paise,
    'shop_name',     s.name,
    'created_at',    o.created_at
  )
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.tracking_code = upper(trim(p_code));
$$;

-- ---------- RPC grants ----------

revoke execute on function public.create_shop(text, text, text, text) from public, anon;
revoke execute on function public.place_order(text, jsonb, text) from public;
revoke execute on function public.quote_order(text, jsonb) from public;
revoke execute on function public.track_order(text) from public;
revoke execute on function public._price_order_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.new_tracking_code() from public, anon, authenticated;
grant execute on function public.create_shop(text, text, text, text) to authenticated;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;
grant execute on function public.quote_order(text, jsonb) to anon, authenticated;
grant execute on function public.track_order(text) to anon, authenticated;
revoke execute on function public.is_shop_member(uuid, text[]) from public, anon;
revoke execute on function public.is_shop_owner(uuid) from public, anon;
grant execute on function public.is_shop_member(uuid, text[]) to authenticated;
grant execute on function public.is_shop_owner(uuid) to authenticated;
