-- Rollback for 0012_print_eligibility.sql. Restores the 0010 agent functions and the 0010
-- job status list. Run before rolling back 0011 or 0010.
--
-- Cancelled jobs cannot exist under the old status list, so they become 'failed' with their
-- reason kept. Nothing is deleted. A failed job cannot be printed again unless its order is
-- printing and paid, which a refunded or cancelled order never is.

drop trigger if exists orders_cancel_unprintable_jobs on public.orders;
drop function if exists public.cancel_unprintable_jobs();
drop function if exists public.order_is_printable(uuid);

update public.print_jobs
   set status = 'failed', updated_at = now()
 where status = 'cancelled';

alter table public.print_jobs drop constraint if exists print_jobs_status_check;
alter table public.print_jobs
  add constraint print_jobs_status_check
  check (status in ('queued', 'claimed', 'printing', 'sent', 'failed', 'needs_check'));

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
