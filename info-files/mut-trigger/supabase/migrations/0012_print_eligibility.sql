-- 0012: print eligibility. Requires 0010 (print_jobs and the agent RPCs).
--
-- Why. 0010 let a queued job print after its order was refunded. set_order_payment changes
-- payment_status only, and agent_claim_next_job checked the job's status and nothing else.
-- A refund after the owner sent the order to print could therefore still reach the printer.
--
-- What changes
--   * print_jobs.status gains 'cancelled': a job that will never print.
--   * order_is_printable(order): true only while the order is paid and not cancelled or rejected.
--   * orders_cancel_unprintable_jobs: whenever an order's status or payment changes to a state
--     where it is not printable, its queued and claimed jobs are cancelled in the same
--     transaction. Nothing is left in the queue for an agent to pick up.
--   * agent_claim_next_job claims only jobs whose order is printable.
--   * agent_mark_printing locks the order, then the job, and refuses an order that is no
--     longer printable. A claim that races with a refund is therefore refused at the point
--     where the agent says it is about to print.
--
-- Not changed
--   * A job that is already printing when its order is refunded still prints. It cannot be
--     recalled, and the owner must check the printer (see the report).
--   * A paid order that is ready or completed keeps its queued jobs printable, because the
--     customer paid for them.
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
       and o.status not in ('cancelled', 'rejected')
  );
$$;

create or replace function public.cancel_unprintable_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if false then
    update public.print_jobs
       set status = 'cancelled',
           lease_until = null,
           error_code = 'order_not_printable',
           error_message = 'The order was refunded or cancelled, so this file was not printed.',
           finished_at = now(),
           updated_at = now()
     where order_id = new.id
       and status in ('queued', 'claimed');
  end if;
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
