create or replace function public.shop_licence_status(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_state text;
  v_until timestamptz;
  v_next  timestamptz;
begin
  if auth.uid() is null or p_shop_id is null or not public.is_shop_owner(p_shop_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select s.state, s.access_until, s.next_start
    into v_state, v_until, v_next
    from public.shop_licence_state(p_shop_id, now()) s;

  return jsonb_build_object(
    'ok', true,
    'active', (v_state = 'ACTIVE'),
    'no_expiry', (v_state = 'ACTIVE' and v_until is null),
    'access_end', case when v_state = 'ACTIVE' then v_until end,
    'next_start', case when v_state = 'SCHEDULED' then v_next end
  );
end;
$$;
