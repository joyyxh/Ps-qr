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
