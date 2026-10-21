-- 0010: automatic printing through a shop computer, rate limits and file retention.
--
-- Adds
--   print_agents          one row per shop computer that runs the QRquick print agent
--   print_agent_pairings  one-time codes an owner makes to connect a computer
--   print_jobs            one row per attempt to print one customer file
--   rate_limits           fixed-window counters for edge functions and track_order
--
-- Rules enforced here (the browser and the agent cannot skip them):
--   * A job is only created for an order that is approved, paid and has a file.
--   * Only one job per order item may be queued, claimed or printing at a time.
--   * Only an agent of the same shop can claim a job.
--   * An agent must record 'printing' before it sends a file to the printer. A job
--     whose lease ends before that goes back to the queue, because nothing was
--     printed. A job that lost its lease while printing becomes 'needs_check'. It is
--     never printed again automatically; the owner decides.
--   * Agent tokens are random and stored only as SHA-256 hashes.
--   * Every table is closed to browsers. Owners use RPCs that check ownership.

-- ---------- tables ----------

create table public.print_agents (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  platform        text not null check (platform in ('windows', 'linux')),
  agent_version   text check (agent_version is null or char_length(agent_version) between 1 and 20),
  token_hash      text not null unique check (char_length(token_hash) = 64),
  printers        jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(printers) = 'array' and jsonb_array_length(printers) <= 50),
  chosen_printer  text check (chosen_printer is null or char_length(chosen_printer) between 1 and 200),
  last_seen_at    timestamptz,
  paired_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  unique (id, shop_id)
);

create index print_agents_active_idx on public.print_agents (shop_id) where revoked_at is null;

create table public.print_agent_pairings (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  code_hash   text not null unique check (char_length(code_hash) = 64),
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  check (expires_at > created_at)
);

create table public.print_jobs (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  order_id      uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  file_id       uuid not null references public.customer_files (id) on delete restrict,
  attempt       integer not null default 1 check (attempt between 1 and 50),
  status        text not null default 'queued'
                check (status in ('queued', 'claimed', 'printing', 'sent', 'failed', 'needs_check')),
  settings      jsonb not null check (jsonb_typeof(settings) = 'object'),
  agent_id      uuid,
  claim_count   integer not null default 0 check (claim_count between 0 and 20),
  lease_until   timestamptz,
  error_code    text check (error_code is null or char_length(error_code) <= 60),
  error_message text check (error_message is null or char_length(error_message) <= 300),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz,
  unique (order_item_id, attempt),
  foreign key (agent_id, shop_id) references public.print_agents (id, shop_id),
  check ((status = 'queued' and agent_id is null) or status <> 'queued')
);

create unique index print_jobs_one_active_per_item
  on public.print_jobs (order_item_id)
  where status in ('queued', 'claimed', 'printing');
create index print_jobs_queue_idx on public.print_jobs (shop_id, created_at) where status = 'queued';
create index print_jobs_lease_idx on public.print_jobs (lease_until) where status in ('claimed', 'printing');
create index print_jobs_order_idx on public.print_jobs (order_id);
create index print_jobs_file_idx on public.print_jobs (file_id);

create table public.rate_limits (
  key          text primary key check (char_length(key) between 1 and 200),
  window_start timestamptz not null default now(),
  hits         integer not null default 0 check (hits >= 0)
);

alter table public.print_agents         enable row level security;
alter table public.print_agent_pairings enable row level security;
alter table public.print_jobs           enable row level security;
alter table public.rate_limits          enable row level security;
-- No policies on purpose: browsers never read or write these tables directly.
revoke all on public.print_agents, public.print_agent_pairings, public.print_jobs, public.rate_limits
  from public, anon, authenticated;

-- Retention marks a file as removed from storage instead of deleting the row,
-- because order_items keeps a reference to it for the order history.
alter table public.customer_files add column if not exists storage_deleted_at timestamptz;

-- ---------- helpers (not callable by browsers) ----------

create or replace function public.print_code_hash(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')),
    'hex'
  )
$$;

-- 8 symbols from 32 (no 0, O, 1 or I), taken from cryptographic random bytes.
-- 256 is a multiple of 32, so every symbol is equally likely.
create or replace function public.new_print_pairing_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes  bytea := decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex');
  v_code   text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end;
$$;

create or replace function public.request_client_key()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw     text;
  v_headers json := null;
  v_ip      text;
begin
  v_raw := current_setting('request.headers', true);
  if v_raw is not null and v_raw <> '' then
    begin
      v_headers := v_raw::json;
    exception when others then
      v_headers := null;
    end;
  end if;
  v_ip := btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1));
  if v_ip = '' then
    v_ip := btrim(coalesce(v_headers->>'x-real-ip', v_headers->>'cf-connecting-ip', ''));
  end if;
  if v_ip = '' then
    return 'client:unknown';
  end if;
  -- Hash the address so the table never holds raw IP addresses.
  return 'ip:' || encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
end;
$$;

create or replace function public.agent_for_token(p_token_hash text)
returns public.print_agents
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'agent_unauthorized' using errcode = '28000';
  end if;
  select * into v_agent from public.print_agents
   where token_hash = p_token_hash and revoked_at is null;
  if not found then
    raise exception 'agent_unauthorized' using errcode = '28000';
  end if;
  return v_agent;
end;
$$;

-- Requeues or fails jobs whose lease has ended. Called by agent calls for one shop.
create or replace function public.recover_expired_print_jobs(p_shop_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_rows  integer;
begin
  -- Claimed but never started: nothing reached a printer, so the job goes back in the queue.
  update public.print_jobs
     set status = 'queued', agent_id = null, lease_until = null, updated_at = now()
   where shop_id = p_shop_id and status = 'claimed' and lease_until <= now() and claim_count < 5;
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  -- Claimed again and again without starting: stop and say why.
  update public.print_jobs
     set status = 'failed', error_code = 'too_many_claims', lease_until = null,
         error_message = 'The shop computer did not start this job after several tries.',
         finished_at = now(), updated_at = now()
   where shop_id = p_shop_id and status = 'claimed' and lease_until <= now() and claim_count >= 5;
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  -- Started printing, then went quiet: it may have printed, so the owner must check.
  update public.print_jobs
     set status = 'needs_check', lease_until = null,
         error_code = 'lease_expired',
         error_message = 'The shop computer stopped responding during printing. Check the printer before printing again.',
         updated_at = now()
   where shop_id = p_shop_id and status = 'printing' and lease_until <= now();
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  return v_total;
end;
$$;

-- ---------- rate limiting ----------

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'bad rate limit settings' using errcode = '22023';
  end if;
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits         = case when r.window_start <= now() - make_interval(secs => p_window_seconds)
                        then 1 else r.hits + 1 end
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- track_order is called by anonymous customers with a tracking code. Limit lookups per
-- connection so a code cannot be guessed by trying many codes quickly.
drop function if exists public.track_order(text);
create function public.track_order(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.consume_rate_limit('track:' || public.request_client_key(), 30, 60) then
    raise exception 'Too many lookups from this connection. Wait a minute and try again.'
      using errcode = '54000';
  end if;

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
    into v_result
    from public.orders o
    join public.shops s on s.id = o.shop_id
   where o.tracking_code = upper(trim(p_code));

  return v_result;
end;
$$;

revoke execute on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;

-- ---------- owner RPCs (signed-in owner or staff) ----------

create or replace function public.create_print_agent_pairing(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text := public.new_print_pairing_code();
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if auth.uid() is null or not public.is_shop_owner(p_shop_id) then
    raise exception 'only the shop owner can connect a computer' using errcode = '42501';
  end if;
  -- A newer code replaces any older unused code.
  update public.print_agent_pairings
     set expires_at = now()
   where shop_id = p_shop_id and used_at is null and expires_at > now();
  insert into public.print_agent_pairings (shop_id, code_hash, created_by, expires_at)
  values (p_shop_id, public.print_code_hash(v_code), auth.uid(), v_expires);
  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

create or replace function public.owner_print_status(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agents jsonb;
  v_jobs   jsonb;
begin
  if auth.uid() is null or not public.is_shop_member(p_shop_id) then
    raise exception 'you do not have permission to see this shop' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'name', a.name,
           'platform', a.platform,
           'agent_version', a.agent_version,
           'printers', a.printers,
           'chosen_printer', a.chosen_printer,
           'last_seen_at', a.last_seen_at,
           'online', coalesce(a.last_seen_at > now() - interval '2 minutes', false),
           'paired_at', a.paired_at
         ) order by a.paired_at), '[]'::jsonb)
    into v_agents
    from public.print_agents a
   where a.shop_id = p_shop_id and a.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', j.id,
           'order_id', j.order_id,
           'order_item_id', j.order_item_id,
           'attempt', j.attempt,
           'status', j.status,
           'error_code', j.error_code,
           'error_message', j.error_message,
           'agent_id', j.agent_id,
           'created_at', j.created_at,
           'updated_at', j.updated_at
         ) order by j.created_at desc), '[]'::jsonb)
    into v_jobs
    from (
      select * from public.print_jobs
       where shop_id = p_shop_id
       order by created_at desc
       limit 300
    ) j;

  return jsonb_build_object(
    'agents', v_agents,
    'jobs', v_jobs,
    'is_owner', public.is_shop_owner(p_shop_id)
  );
end;
$$;

create or replace function public.revoke_print_agent(p_agent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.print_agents
   where id = p_agent_id and revoked_at is null;
  if not found then
    raise exception 'computer not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_shop_owner(v_shop) then
    raise exception 'only the shop owner can remove a computer' using errcode = '42501';
  end if;

  update public.print_agents set revoked_at = now() where id = p_agent_id;
  -- Jobs it had not started go back to the queue. Jobs it may have started need a check.
  update public.print_jobs
     set status = 'queued', agent_id = null, lease_until = null, updated_at = now()
   where agent_id = p_agent_id and status = 'claimed';
  update public.print_jobs
     set status = 'needs_check', lease_until = null, updated_at = now(),
         error_code = 'agent_removed',
         error_message = 'The computer was removed while printing. Check the printer before printing again.'
   where agent_id = p_agent_id and status = 'printing';

  return jsonb_build_object('id', p_agent_id, 'revoked', true);
end;
$$;

create or replace function public.set_print_agent_printer(p_agent_id uuid, p_printer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
begin
  select * into v_agent from public.print_agents where id = p_agent_id and revoked_at is null;
  if not found then
    raise exception 'computer not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_shop_owner(v_agent.shop_id) then
    raise exception 'only the shop owner can choose the printer' using errcode = '42501';
  end if;
  if p_printer is not null and not exists (
    select 1 from jsonb_array_elements(v_agent.printers) e where e->>'name' = p_printer
  ) then
    raise exception 'that printer is not connected to this computer' using errcode = '22023';
  end if;
  update public.print_agents set chosen_printer = p_printer where id = p_agent_id;
  return jsonb_build_object('id', p_agent_id, 'chosen_printer', p_printer);
end;
$$;

-- Queues one job per customer file in the order. Safe to call again: items that already
-- have a job are skipped, so nothing is queued twice.
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

-- Owner asks for another attempt after a failure, or after a 'needs_check' job once
-- they have looked at the printer and accept the risk of a second copy.
create or replace function public.retry_print_job(p_job_id uuid, p_confirm_may_have_printed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job     public.print_jobs%rowtype;
  v_status  text;
  v_payment text;
  v_attempt integer;
  v_new_id  uuid;
begin
  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found then
    raise exception 'print job not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_shop_owner(v_job.shop_id) then
    raise exception 'only the shop owner can print again' using errcode = '42501';
  end if;
  if v_job.status not in ('failed', 'needs_check') then
    raise exception 'only a failed or unclear print job can be printed again' using errcode = '22023';
  end if;
  if v_job.status = 'needs_check' and not coalesce(p_confirm_may_have_printed, false) then
    raise exception 'this job may already have printed. Check the printer, then confirm to print again'
      using errcode = '22023';
  end if;

  select status, payment_status into v_status, v_payment from public.orders where id = v_job.order_id;
  if v_status <> 'printing' or v_payment <> 'paid' then
    raise exception 'the order must be printing and paid' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.print_jobs
     where order_item_id = v_job.order_item_id and status in ('queued', 'claimed', 'printing')
  ) then
    raise exception 'this file is already waiting to print' using errcode = '22023';
  end if;
  select coalesce(max(attempt), 0) + 1 into v_attempt
    from public.print_jobs where order_item_id = v_job.order_item_id;

  insert into public.print_jobs (shop_id, order_id, order_item_id, file_id, attempt, settings, created_by)
  values (v_job.shop_id, v_job.order_id, v_job.order_item_id, v_job.file_id, v_attempt, v_job.settings, auth.uid())
  returning id into v_new_id;

  return jsonb_build_object('job_id', v_new_id, 'attempt', v_attempt);
end;
$$;

-- ---------- agent RPCs (called only by the print-agent edge function) ----------

create or replace function public.consume_print_pairing(
  p_code_hash  text,
  p_token_hash text,
  p_name       text,
  p_platform   text,
  p_version    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair      public.print_agent_pairings%rowtype;
  v_agent_id  uuid;
  v_shop_name text;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pairing_code_invalid' using errcode = 'P0001';
  end if;

  select * into v_pair from public.print_agent_pairings
   where code_hash = p_code_hash for update;
  if not found or v_pair.used_at is not null or v_pair.expires_at <= now() then
    raise exception 'pairing_code_invalid' using errcode = 'P0001';
  end if;

  insert into public.print_agents (shop_id, name, platform, agent_version, token_hash, last_seen_at)
  values (v_pair.shop_id, p_name, p_platform, left(p_version, 20), p_token_hash, now())
  returning id into v_agent_id;

  update public.print_agent_pairings set used_at = now() where id = v_pair.id;

  select name into v_shop_name from public.shops where id = v_pair.shop_id;
  return jsonb_build_object('agent_id', v_agent_id, 'shop_id', v_pair.shop_id, 'shop_name', v_shop_name);
end;
$$;

create or replace function public.agent_heartbeat(
  p_token_hash text,
  p_version    text,
  p_printers   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
begin
  v_agent := public.agent_for_token(p_token_hash);
  if p_printers is null or jsonb_typeof(p_printers) <> 'array' or jsonb_array_length(p_printers) > 50 then
    raise exception 'printers_invalid' using errcode = '22023';
  end if;
  -- A missing name gives NULL here, so every test is wrapped in coalesce.
  if exists (
    select 1 from jsonb_array_elements(p_printers) e
     where jsonb_typeof(e) is distinct from 'object'
        or coalesce(jsonb_typeof(e->'name'), '') <> 'string'
        or coalesce(char_length(e->>'name'), 0) not between 1 and 200
  ) then
    raise exception 'printers_invalid' using errcode = '22023';
  end if;

  update public.print_agents
     set last_seen_at = now(),
         agent_version = coalesce(left(p_version, 20), agent_version),
         printers = p_printers
   where id = v_agent.id;

  perform public.recover_expired_print_jobs(v_agent.shop_id);
  return jsonb_build_object('ok', true, 'server_time', now());
end;
$$;

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

-- The agent calls this immediately before it sends the file to the printer.
create or replace function public.agent_mark_printing(p_token_hash text, p_job_id uuid, p_attempt integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
  v_job   public.print_jobs%rowtype;
begin
  v_agent := public.agent_for_token(p_token_hash);
  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found or v_job.agent_id is distinct from v_agent.id or v_job.attempt <> p_attempt
     or v_job.status <> 'claimed' or v_job.lease_until <= now() then
    raise exception 'lease_lost' using errcode = 'P0001';
  end if;
  update public.print_jobs
     set status = 'printing', lease_until = now() + interval '3 minutes', updated_at = now()
   where id = p_job_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Records the outcome. 'sent' means the file was handed to the printer system; it does
-- not prove paper came out. 'failed' is only accepted before the job reached 'printing'
-- or while the job is still being printed, so a failure can never hide a print.
create or replace function public.agent_finish_job(
  p_token_hash    text,
  p_job_id        uuid,
  p_attempt       integer,
  p_outcome       text,
  p_error_code    text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.print_agents%rowtype;
  v_job   public.print_jobs%rowtype;
begin
  v_agent := public.agent_for_token(p_token_hash);
  if p_outcome not in ('sent', 'failed') then
    raise exception 'outcome_invalid' using errcode = '22023';
  end if;

  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found or v_job.agent_id is distinct from v_agent.id or v_job.attempt <> p_attempt then
    raise exception 'lease_lost' using errcode = 'P0001';
  end if;

  if v_job.status = p_outcome then
    return jsonb_build_object('ok', true, 'already_recorded', true);
  end if;

  if p_outcome = 'sent' and v_job.status in ('printing', 'needs_check') then
    update public.print_jobs
       set status = 'sent', lease_until = null, error_code = null, error_message = null,
           finished_at = now(), updated_at = now()
     where id = p_job_id;
  elsif p_outcome = 'failed' and v_job.status in ('claimed', 'printing') then
    update public.print_jobs
       set status = 'failed', lease_until = null,
           error_code = left(coalesce(p_error_code, 'print_failed'), 60),
           error_message = left(p_error_message, 300),
           finished_at = now(), updated_at = now()
     where id = p_job_id;
  else
    raise exception 'lease_lost' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- retention (service role only) ----------

create or replace function public.mark_customer_file_deleted(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customer_files
     set storage_deleted_at = now()
   where id = p_file_id and storage_deleted_at is null;
  return found;
end;
$$;

-- Files that may be removed now:
--   * never linked to an order and past their expiry, or
--   * linked to an order that ended more than 30 days ago.
-- Never a file that a queued, claimed, printing or needs-check job still uses.
create or replace function public.expired_customer_file_paths(p_limit integer default 100)
returns table (id uuid, storage_path text)
language sql
security definer
set search_path = public
as $$
  select f.id, f.storage_path
  from public.customer_files f
  where f.storage_deleted_at is null
    and f.expires_at <= now()
    and not exists (
      select 1 from public.print_jobs j
      where j.file_id = f.id and j.status in ('queued', 'claimed', 'printing', 'needs_check')
    )
    and (
      f.claimed_order_id is null
      or exists (
        select 1 from public.orders o
        where o.id = f.claimed_order_id
          and o.status in ('completed', 'cancelled', 'rejected')
          and coalesce(o.completed_at, o.cancelled_at, o.rejected_at, o.updated_at) < now() - interval '30 days'
      )
    )
  order by f.expires_at
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
$$;

create or replace function public.purge_old_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------- privileges ----------

-- Owner RPCs: signed-in users only.
revoke execute on function public.create_print_agent_pairing(uuid) from public, anon;
revoke execute on function public.owner_print_status(uuid) from public, anon;
revoke execute on function public.revoke_print_agent(uuid) from public, anon;
revoke execute on function public.set_print_agent_printer(uuid, text) from public, anon;
revoke execute on function public.approve_order_for_print(uuid) from public, anon;
revoke execute on function public.retry_print_job(uuid, boolean) from public, anon;
grant execute on function public.create_print_agent_pairing(uuid) to authenticated;
grant execute on function public.owner_print_status(uuid) to authenticated;
grant execute on function public.revoke_print_agent(uuid) to authenticated;
grant execute on function public.set_print_agent_printer(uuid, text) to authenticated;
grant execute on function public.approve_order_for_print(uuid) to authenticated;
grant execute on function public.retry_print_job(uuid, boolean) to authenticated;

-- Helpers: nobody but other database functions.
revoke execute on function public.print_code_hash(text) from public, anon, authenticated;
revoke execute on function public.new_print_pairing_code() from public, anon, authenticated;
revoke execute on function public.request_client_key() from public, anon, authenticated;
revoke execute on function public.agent_for_token(text) from public, anon, authenticated;
revoke execute on function public.recover_expired_print_jobs(uuid) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Agent and cleanup RPCs: the service role (edge functions) only.
revoke execute on function public.consume_print_pairing(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.agent_heartbeat(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.agent_claim_next_job(text) from public, anon, authenticated;
revoke execute on function public.agent_mark_printing(text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.agent_finish_job(text, uuid, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_customer_file_deleted(uuid) from public, anon, authenticated;
revoke execute on function public.expired_customer_file_paths(integer) from public, anon, authenticated;
revoke execute on function public.purge_old_rate_limits() from public, anon, authenticated;
grant execute on function public.consume_print_pairing(text, text, text, text, text) to service_role;
grant execute on function public.agent_heartbeat(text, text, jsonb) to service_role;
grant execute on function public.agent_claim_next_job(text) to service_role;
grant execute on function public.agent_mark_printing(text, uuid, integer) to service_role;
grant execute on function public.agent_finish_job(text, uuid, integer, text, text, text) to service_role;
grant execute on function public.mark_customer_file_deleted(uuid) to service_role;
grant execute on function public.expired_customer_file_paths(integer) to service_role;
grant execute on function public.purge_old_rate_limits() to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
