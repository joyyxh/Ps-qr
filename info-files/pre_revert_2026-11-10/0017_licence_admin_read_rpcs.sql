-- 0017: admin read RPCs (Stage 7D backend). FILE ONLY. NOT APPLIED. NOT RUN ON ANY SUPABASE PROJECT.
--
-- Renamed from 0013 to 0017 on 2026-11-10 under the owner-authorised D-MIG default (comments only changed).
-- Previously provisional (2026-11-08). Hosted migration history is not verified.
-- Depends on: 0001 (shops, is_shop_owner), 0015 (platform_admins, is_platform_admin, shop_licence_meta,
-- shop_licence_state, licence_coverages, licence_audit_log) and 0016 (licence_admin_deny,
-- licence_admin_reject). It changes no existing function and no existing table.
--
-- Adds (all SECURITY DEFINER, fixed search_path, schema-qualified, VOLATILE so that a denial can write
-- its counters; STABLE would make the denial write fail):
--   admin_search_shops(p_query text, p_limit integer default 10)           EXECUTE: authenticated only
--   admin_shop_licence(p_shop_id uuid)                                     EXECUTE: authenticated only
--   admin_shop_audit(p_shop_id uuid, p_after_created_at timestamptz default null,
--                    p_after_id uuid default null, p_limit integer default 25)
--                                                                          EXECUTE: authenticated only
--   licence_admin_read_gate(p_function_name text)                          internal, no client EXECUTE
--   indexes: shops_slug_pattern_idx, shops_name_pattern_idx (both on shops, a Stage 1 table: owner
--   approval needed), licence_audit_log_shop_created_id_idx (keyset order with the id tie-break).
--
-- Authorisation follows licence_admin_core step 2 in the same order: caller UID, is_platform_admin(),
-- aal2. A failure is a committed {ok:false, code:'forbidden'} after the denial counters (and any allowed
-- detail row) are written, with the same denial reasons as the write RPCs. A missing shop is a committed
-- shop_not_found with no denial row (it is not an authorisation failure). Bad input is invalid_request.
--
-- Isolation: the write RPCs require READ COMMITTED. These reads do not check it. Each read is a single
-- statement, so its snapshot is consistent in either isolation level.

-- ---------- gate ----------

-- Returns null when the caller passes. Otherwise it writes the denial records and returns the committed
-- forbidden result. A caller with no readable UID is counted in the global counter only (as in 0016).
create or replace function public.licence_admin_read_gate(p_function_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid;
  v_aal text;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  if v_uid is null then
    return public.licence_admin_deny(p_function_name, 'no_actor', null, null);
  end if;

  if not public.is_platform_admin() then
    return public.licence_admin_deny(p_function_name, 'not_platform_admin', null, v_uid);
  end if;

  -- Missing, unreadable or insufficient aal fails closed.
  begin
    v_aal := auth.jwt() ->> 'aal';
  exception when others then
    v_aal := null;
  end;

  if v_aal is distinct from 'aal2' then
    return public.licence_admin_deny(p_function_name, 'aal_not_aal2', null, v_uid);
  end if;

  return null;
end;
$$;

-- ---------- search ----------

-- Shop search for platform admins. The query is trimmed and lower-cased. It matches an exact shop UUID,
-- or a prefix of the slug or of the name. LIKE metacharacters are escaped, so the query is literal text.
-- Output is capped at p_limit (1 to 25); has_more says whether another match exists. There is no cursor:
-- the admin refines the query. Returns only shop_id, slug and name (shops also has phone, address and
-- is_open; those are not returned to admins here).
create or replace function public.admin_search_shops(p_query text, p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate  jsonb;
  v_q     text;
  v_pat   text;
  v_items jsonb;
  v_more  boolean;
begin
  v_gate := public.licence_admin_read_gate('admin_search_shops');
  if v_gate is not null then
    return v_gate;
  end if;

  v_q := lower(btrim(coalesce(p_query, '')));
  if char_length(v_q) < 2 or char_length(v_q) > 80 then
    return public.licence_admin_reject('invalid_request');
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 25 then
    return public.licence_admin_reject('invalid_request');
  end if;

  v_pat := replace(replace(replace(v_q, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'),
                   '_', chr(92) || '_') || '%';

  select coalesce(jsonb_agg(jsonb_build_object('shop_id', h.id, 'slug', h.slug, 'name', h.name)
                            order by h.rn) filter (where h.rn <= p_limit), '[]'::jsonb),
         coalesce(max(h.rn), 0) > p_limit
    into v_items, v_more
    from (
      select s.id, s.slug, s.name,
             row_number() over (order by s.name, s.id) as rn
        from public.shops s
       where s.id::text = v_q
          or s.slug like v_pat escape '\'
          or lower(s.name) like v_pat escape '\'
       order by s.name, s.id
       limit p_limit + 1
    ) h;

  return jsonb_build_object('ok', true, 'shops', v_items, 'has_more', v_more);
end;
$$;

-- ---------- shop licence view ----------

-- One shop's licence view for the admin: its state_version (the value the write RPCs need as
-- expected_state_version), its state at now(), and its live coverages (the target_coverage_id
-- candidates). Live means not revoked and not yet ended. Scheduled coverages (not yet started) are
-- included with status 'scheduled'. Expired and revoked coverages are excluded. At most 50 are returned,
-- ordered by start; coverages_truncated says whether more exist. Coverage rows carry no actor IDs.
--
-- The version, the state and the coverage list come from one statement, so they come from one snapshot.
-- A version can still be stale by the time the admin submits it: the write RPC re-checks it under lock.
create or replace function public.admin_shop_licence(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate jsonb;
  v_doc  jsonb;
begin
  v_gate := public.licence_admin_read_gate('admin_shop_licence');
  if v_gate is not null then
    return v_gate;
  end if;

  if p_shop_id is null then
    return public.licence_admin_reject('invalid_request');
  end if;

  select jsonb_build_object(
           'ok', true,
           'shop', jsonb_build_object('shop_id', s.id, 'slug', s.slug, 'name', s.name),
           'state_version', coalesce(m.state_version, 0),
           'state', jsonb_build_object(
                      'state', st.state,
                      'basis', st.basis,
                      'access_until', st.access_until,
                      'next_start', st.next_start),
           'coverages', cov.items,
           'coverages_truncated', cov.more)
    into v_doc
    from public.shops s
    left join public.shop_licence_meta m on m.shop_id = s.id
    cross join lateral public.shop_licence_state(s.id, now()) st
    cross join lateral (
      select coalesce(jsonb_agg(x.item order by x.starts_at, x.coverage_id)
                        filter (where x.rn <= 50), '[]'::jsonb) as items,
             coalesce(max(x.rn), 0) > 50 as more
        from (
          select c.id as coverage_id,
                 c.starts_at,
                 jsonb_build_object(
                   'coverage_id', c.id,
                   'kind', c.kind,
                   'status', case when c.starts_at <= now() then 'current' else 'scheduled' end,
                   'starts_at', c.starts_at,
                   'ends_at', c.ends_at,
                   'reason', c.reason) as item,
                 row_number() over (order by c.starts_at, c.id) as rn
            from public.licence_coverages c
           where c.shop_id = s.id
             and c.revoked_at is null
             and (c.ends_at is null or c.ends_at > now())
           order by c.starts_at, c.id
           limit 51
        ) x
    ) cov
   where s.id = p_shop_id;

  if v_doc is null then
    return public.licence_admin_reject('shop_not_found');
  end if;

  return v_doc;
end;
$$;

-- ---------- audit history ----------

-- Audit entries for one shop, newest first, 1 to 100 per page (default 25). Keyset pagination on
-- (created_at, id), so a replace's two rows (same now()) are ordered by id and neither is skipped. Pass
-- both cursor fields from the previous page's next object, or neither for the first page. The audit log
-- is append-only, so newer entries never shift an older page.
create or replace function public.admin_shop_audit(
  p_shop_id           uuid,
  p_after_created_at  timestamptz default null,
  p_after_id          uuid default null,
  p_limit             integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate    jsonb;
  v_rows    jsonb;
  v_more    boolean;
  v_next_at timestamptz;
  v_next_id uuid;
begin
  v_gate := public.licence_admin_read_gate('admin_shop_audit');
  if v_gate is not null then
    return v_gate;
  end if;

  if p_shop_id is null or p_limit is null or p_limit < 1 or p_limit > 100
     or (p_after_created_at is null) <> (p_after_id is null) then
    return public.licence_admin_reject('invalid_request');
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id) then
    return public.licence_admin_reject('shop_not_found');
  end if;

  -- The probe row (rn = p_limit + 1) only tells whether another page exists. The cursor is the last
  -- returned row (rn = p_limit).
  select coalesce(jsonb_agg(jsonb_build_object(
                     'entry_id', p.id,
                     'created_at', p.created_at,
                     'action', p.action,
                     'coverage_id', p.coverage_id,
                     'reason', p.reason,
                     'licence_start', p.licence_start,
                     'licence_end', p.licence_end,
                     'actor_user_id', p.actor_user_id,
                     'before_state', p.before_state,
                     'after_state', p.after_state)
                   order by p.rn) filter (where p.rn <= p_limit), '[]'::jsonb),
         coalesce(max(p.rn), 0) > p_limit,
         (array_agg(p.created_at order by p.rn))[p_limit],
         (array_agg(p.id order by p.rn))[p_limit]
    into v_rows, v_more, v_next_at, v_next_id
    from (
      select a.id, a.created_at, a.action, a.coverage_id, a.reason,
             a.licence_start, a.licence_end, a.actor_user_id, a.before_state, a.after_state,
             row_number() over (order by a.created_at desc, a.id desc) as rn
        from public.licence_audit_log a
       where a.shop_id = p_shop_id
         and (p_after_created_at is null
              or (a.created_at, a.id) < (p_after_created_at, p_after_id))
       order by a.created_at desc, a.id desc
       limit p_limit + 1
    ) p;

  return jsonb_build_object(
    'ok', true,
    'entries', v_rows,
    'next', case when v_more
                 then jsonb_build_object('created_at', v_next_at, 'entry_id', v_next_id)
            end);
end;
$$;

-- ---------- indexes ----------

-- Prefix search needs pattern operator classes unless the database collation is C.
create index shops_slug_pattern_idx on public.shops (slug text_pattern_ops);
create index shops_name_pattern_idx on public.shops (lower(name) text_pattern_ops);

-- Keyset order for admin_shop_audit. The 0015 index (shop_id, created_at) is kept unchanged.
create index licence_audit_log_shop_created_id_idx
  on public.licence_audit_log (shop_id, created_at desc, id desc);

-- ---------- privileges ----------

revoke all on function public.licence_admin_read_gate(text)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.admin_search_shops(text, integer),
  public.admin_shop_licence(uuid),
  public.admin_shop_audit(uuid, timestamptz, uuid, integer)
  from public, anon, service_role;

grant execute on function
  public.admin_search_shops(text, integer),
  public.admin_shop_licence(uuid),
  public.admin_shop_audit(uuid, timestamptz, uuid, integer)
  to authenticated;

-- End of 0017 (Stage 7D admin read RPCs). Not applied. Not run on any Supabase project.
