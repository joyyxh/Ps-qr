#!/usr/bin/env python3
"""Targeted local tests for the Stage 7D admin read RPCs (migration 0017) and the 2026-11-08 7C corrections.

LOCAL THROWAWAY DATABASE ONLY (stage7c_local). Refuses any other database name, through rpc_tests.py.
Never run this against Supabase or any hosted project. A passing run is local evidence only: it is not
hosted AAL2 verification (O11) and not staging evidence.

It reuses the helpers of rpc_tests.py. It does not repeat the 282-check RPC suite. main() runs only the
targeted functions of that suite that these changes touch (backdate window, owner status, admin authorisation,
denial counters), then the new tests in this file.

Run: supabase/tests/licence_7c/reset_local.sh && python3 supabase/tests/licence_7c/read_api_tests.py
"""
import concurrent.futures
import datetime
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc_tests as R  # noqa: E402  (same helpers and the same local-only guard)
from rpc_tests import (  # noqa: E402
    add_cov, add_member, accepted, actor_counts, call_status, check, global_counts, ist_at, lit,
    new_admin, new_shop, new_uuid, payload, q, rejected, rpc_sql, run, run_async_pair, set_window, ver,
)

HOUR_START = "date_trunc('hour', now())"
DAY = datetime.timedelta(days=1)
HOUR = datetime.timedelta(hours=1)
SEARCH_FNS = ("admin_search_shops", "admin_shop_audit", "admin_shop_licence")


# ---------- helpers ----------

def rread(expr, user, aal="aal2", claims=None, role="authenticated"):
    """Call one admin read RPC as a client. Returns the decoded JSON, or {'__error__': text}."""
    if claims is None and user is not None:
        claims = {"sub": user, "role": "authenticated"}
        if aal is not None:
            claims["aal"] = aal
    ok, out, err = run(f"select public.{expr};", role=role, claims=claims)
    if not ok:
        return {"__error__": err}
    return json.loads(out.splitlines()[-1])


def read_sql(expr, claims):
    """SQL text for one read as an authenticated client (for the two-session tests)."""
    return (f"set role authenticated;\n"
            f"select set_config('request.jwt.claims', {lit(json.dumps(claims))}, false)\\g /dev/null\n"
            f"select public.{expr};\n")


def q_lines(sql):
    """Every output line of a script (for multi-row results)."""
    ok, out, err = run(sql)
    if not ok:
        raise RuntimeError(f"query failed: {err}")
    return [line for line in out.splitlines() if line.strip()]


def denial_totals():
    rows = int(q("select count(*) from public.licence_denials;"))
    out = q("select coalesce(sum(denial_count), 0) || '|' || coalesce(sum(detail_count), 0) "
            "from public.licence_denial_windows;")
    d, dt = out.split("|")
    return rows, int(d), int(dt)


def last_denial(actor):
    out = q(f"select function_name || '|' || denial_reason || '|' || coalesce(request_id::text, 'null') "
            f"from public.licence_denials where actor_user_id = {lit(actor)}::uuid "
            f"order by occurred_at desc, id desc limit 1;")
    return out.split("|")


def denial_rows_in_hour(actor):
    return int(q(f"select count(*) from public.licence_denials where actor_user_id = {lit(actor)}::uuid "
                 f"and occurred_at >= {HOUR_START};"))


def shop_named(name, slug=None, phone=None):
    sid = new_uuid()
    slug_sql = lit(slug) if slug else "('shop-' || replace(gen_random_uuid()::text, '-', ''))"
    phone_sql = lit(phone) if phone else "null"
    q(f"insert into public.shops (id, slug, name, phone) values ({lit(sid)}, {slug_sql}, {lit(name)}, "
      f"{phone_sql}); select 1;")
    return sid


def shop_name_of(sid):
    return q(f"select name from public.shops where id = {lit(sid)}::uuid;")


SEARCH_ANY = "admin_search_shops('ab', 10)"


def shop_expr(sid):
    return f"admin_shop_licence({lit(sid)}::uuid)"


def audit_expr(sid, after_at=None, after_id=None, limit=None):
    if after_at is None and limit is None:
        return f"admin_shop_audit({lit(sid)}::uuid)"
    parts = [lit(sid) + "::uuid"]
    parts.append(("null::timestamptz" if after_at is None else lit(after_at) + "::timestamptz"))
    parts.append(("null::uuid" if after_id is None else lit(after_id) + "::uuid"))
    parts.append(("25" if limit is None else str(limit)))
    return f"admin_shop_audit({', '.join(parts)})"


def read_denied(name, fn_name, expr, actor, aal="aal2", claims=None, reason=None):
    """A committed forbidden: the global counter moves by one. For an identified actor the actor counter
    and one detail row also move, and the newest denial row names the function and the reason."""
    a0, g0, rows0 = actor_counts(actor), global_counts(), q("select count(*) from public.licence_denials;")
    r = rread(expr, actor, aal=aal, claims=claims)
    a1, g1 = actor_counts(actor), global_counts()
    rows1 = q("select count(*) from public.licence_denials;")
    ok = r == {"ok": False, "code": "forbidden"} and g1[0] == g0[0] + 1
    detail = ""
    if actor is not None:
        ok = ok and a1[0] == a0[0] + 1 and a1[1] == a0[1] + 1 and g1[1] == g0[1] + 1
        ok = ok and int(rows1) == int(rows0) + 1
        fn, rsn, _ = last_denial(actor)
        ok = ok and fn == fn_name and rsn == reason
        detail = f"row={fn}|{rsn}"
    else:
        ok = ok and g1[1] == g0[1] and int(rows1) == int(rows0)
    check(name, ok, f"got={r} a={a0}->{a1} g={g0}->{g1} rows={rows0}->{rows1} {detail}")


ADMIN = None  # set in main(): one platform admin used by the read tests


# ---------- backdate: fail closed, and the window boundaries ----------

def test_backdate_fail_closed_and_boundaries():
    admin = new_admin()
    try:
        set_window(None)
        s = new_shop()
        rejected("BW-07 no window: an unconfirmed backdate is backdate_not_confirmed (the order is kept)", s,
                 "backdate_not_confirmed", "licence_admin_grant",
                 payload(s, 0, grant_kind="one_month", start=ist_at(-HOUR), backdate_confirm=False), admin)
        s = new_shop()
        rejected("BW-08 no window: a confirmed custom backdate is backdate_window_exceeded", s,
                 "backdate_window_exceeded", "licence_admin_grant",
                 payload(s, 0, grant_kind="custom", start=ist_at(-DAY), end=ist_at(DAY),
                         backdate_confirm=True), admin)
        s = new_shop()
        rejected("BW-09 no window: a confirmed lifetime backdate is backdate_window_exceeded", s,
                 "backdate_window_exceeded", "licence_admin_grant",
                 payload(s, 0, grant_kind="lifetime", start=ist_at(-HOUR), backdate_confirm=True), admin)
        s = new_shop()
        t = add_cov(s, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
        rejected("BW-10 no window: a replace with a confirmed backdate is backdate_window_exceeded", s,
                 "backdate_window_exceeded", "licence_admin_replace",
                 payload(s, 0, target_coverage_id=t, grant_kind="one_month", start=ist_at(-HOUR),
                         backdate_confirm=True), admin)
        s = new_shop()
        accepted("BW-11 no window: a grant with no start is not a backdate and is accepted", s,
                 "licence_admin_grant", payload(s, 0, grant_kind="one_month"), admin)
        s = new_shop()
        accepted("BW-12 no window: a future custom start (scheduled) is accepted", s,
                 "licence_admin_grant",
                 payload(s, 0, grant_kind="custom", start=ist_at(2 * DAY), end=ist_at(3 * DAY)), admin)

        set_window("2")
        s = new_shop()
        accepted("BW-13 window 2 days: a backdate of 2 days minus one hour is accepted (inside the boundary)", s,
                 "licence_admin_grant",
                 payload(s, 0, grant_kind="one_month", start=ist_at(-(2 * DAY - HOUR)), backdate_confirm=True),
                 admin)
        s = new_shop()
        rejected("BW-14 window 2 days: a backdate of 2 days plus one hour is backdate_window_exceeded", s,
                 "backdate_window_exceeded", "licence_admin_grant",
                 payload(s, 0, grant_kind="one_month", start=ist_at(-(2 * DAY + HOUR)), backdate_confirm=True),
                 admin)
    finally:
        set_window("31")


# ---------- H4: the owner status read stays unlogged ----------

def test_h4_owner_status_unlogged():
    owner, staff, outsider = new_uuid(), new_uuid(), new_uuid()
    s = new_shop()
    add_member(s, owner, "owner")
    add_member(s, staff, "staff")
    volatility = q("select provolatile from pg_proc where proname = 'shop_licence_status';")
    check("H4-01 shop_licence_status stays STABLE (provolatile 's'): this change does not alter it",
          volatility == "s", volatility)
    before = denial_totals()
    ok_owner = call_status(s, owner)
    denied_staff = call_status(s, staff)
    denied_outsider = call_status(s, outsider)
    denied_unknown = call_status(new_uuid(), owner)
    after = denial_totals()
    check("H4-02 the owner gets the decision D shape (ok true)",
          ok_owner.get("ok") is True and set(ok_owner) == {"ok", "active", "no_expiry", "access_end", "next_start"},
          json.dumps(ok_owner))
    check("H4-03 staff, an outsider and an unknown shop are committed forbidden",
          denied_staff == denied_outsider == denied_unknown == {"ok": False, "code": "forbidden"},
          f"{denied_staff} {denied_outsider} {denied_unknown}")
    check("H4-04 the denials write NO denial row and move NO counter (H4 exception to A4)",
          before == after, f"before={before} after={after}")


# ---------- admin reads: privileges, authorisation, AAL2 ----------

def test_admin_read_privileges():
    for role in ("anon", "service_role"):
        for fn in SEARCH_FNS:
            expr = {"admin_search_shops": SEARCH_ANY,
                    "admin_shop_licence": shop_expr(new_uuid()),
                    "admin_shop_audit": audit_expr(new_uuid())}[fn]
            ok, out, err = run(f"select public.{expr};", role=role, claims=None)
            check(f"AR-01 {role} has no EXECUTE on {fn}", (not ok) and "permission denied" in err, err[:160])
    ok, out, err = run("select public.licence_admin_read_gate('admin_search_shops');",
                       role="authenticated", claims={"sub": new_uuid(), "role": "authenticated", "aal": "aal2"})
    check("AR-02 the gate helper is not callable by authenticated clients", (not ok) and "permission denied" in err,
          err[:160])
    check("AR-03 authenticated has EXECUTE on the three read RPCs",
          q("select has_function_privilege('authenticated', 'public.admin_search_shops(text,integer)', 'EXECUTE') "
            "and has_function_privilege('authenticated', 'public.admin_shop_licence(uuid)', 'EXECUTE') "
            "and has_function_privilege('authenticated', "
            "'public.admin_shop_audit(uuid,timestamptz,uuid,integer)', 'EXECUTE');") == "t")
    vol_ok, vols, vol_err = run("select proname || '|' || provolatile::text from pg_proc where proname in "
                                "('admin_search_shops','admin_shop_licence','admin_shop_audit');")
    vols = vols if vol_ok else vol_err
    check("AR-04 the read RPCs are VOLATILE, so a denial can write its counters",
          sorted(vols.split()) == sorted(["admin_search_shops|v", "admin_shop_licence|v", "admin_shop_audit|v"]),
          vols or "query returned no rows: functions missing or harness returned no output (historical run1)")


def test_admin_read_authorisation():
    admin = new_admin()
    s = new_shop()
    read_denied("AR-05 an authenticated non-admin is denied (not_platform_admin)", "admin_search_shops",
                SEARCH_ANY, new_uuid(), aal="aal2", reason="not_platform_admin")
    read_denied("AR-06 an admin on aal1 is denied (aal_not_aal2)", "admin_shop_licence",
                shop_expr(s), admin, aal="aal1", reason="aal_not_aal2")
    read_denied("AR-07 an admin with no aal claim is denied (aal_not_aal2)", "admin_shop_audit",
                audit_expr(s), admin, aal=None, reason="aal_not_aal2")
    disabled = new_admin()
    q(f"update public.platform_admins set disabled_at = now() where user_id = {lit(disabled)}::uuid; select 1;")
    read_denied("AR-08 a disabled admin on aal2 is denied (not_platform_admin)", "admin_shop_licence",
                shop_expr(s), disabled, aal="aal2", reason="not_platform_admin")
    read_denied("AR-09 no readable UID: forbidden, global counter only, no detail row", "admin_search_shops",
                SEARCH_ANY, None, claims={"role": "authenticated"})
    r = rread(SEARCH_ANY, admin, aal="aal2")
    check("AR-10 an aal2 admin passes the gate", r.get("ok") is True and set(r) == {"ok", "shops", "has_more"},
          json.dumps(r)[:200])


# ---------- search: validation, matching, limits, output ----------

def test_search_validation_and_matching():
    tok = "zq" + uuid.uuid4().hex[:8]
    for label, expr in [
        ("SR-01 a 1-character query is invalid_request", "admin_search_shops('a', 10)"),
        ("SR-01 an 81-character query is invalid_request", f"admin_search_shops({lit('a' * 81)}, 10)"),
        ("SR-02 limit 0 is invalid_request", f"admin_search_shops({lit(tok)}, 0)"),
        ("SR-02 limit 26 is invalid_request", f"admin_search_shops({lit(tok)}, 26)"),
        ("SR-02 a null limit is invalid_request", f"admin_search_shops({lit(tok)}, null)"),
    ]:
        r = rread(expr, ADMIN)
        check(label, r == {"ok": False, "code": "invalid_request"}, json.dumps(r))
    r = rread(f"admin_search_shops({lit('  ' + 'a' * 80 + '  ')}, 10)", ADMIN)
    check("SR-01 an 80-character query after trimming is accepted", r.get("ok") is True, json.dumps(r)[:120])

    # LIKE metacharacters are literal. Without escaping, "p_" would match "pX" and "100%" would match "100x".
    a = shop_named(f"p_{tok} one")
    b = shop_named(f"pX{tok} two")
    c = shop_named(f"100% {tok}")
    d = shop_named(f"100x {tok}")
    ids = {x["shop_id"] for x in rread(f"admin_search_shops({lit('p_' + tok)}, 10)", ADMIN)["shops"]}
    check("SR-03 an underscore in the query is literal", ids == {a}, f"{ids} expected {{{a}}} (b={b})")
    ids = {x["shop_id"] for x in rread(f"admin_search_shops({lit('100% ' + tok)}, 10)", ADMIN)["shops"]}
    check("SR-03 a percent sign in the query is literal", ids == {c}, f"{ids} expected {{{c}}} (d={d})")

    # Prefix only: the token sits inside the name, not at its start.
    check("SR-04 a match in the middle of a name is not returned",
          rread(f"admin_search_shops({lit(tok)}, 10)", ADMIN)["shops"] == [],
          json.dumps(rread(f"admin_search_shops({lit(tok)}, 10)", ADMIN)))
    e = shop_named(f"Quick {tok}")
    check("SR-04 a name prefix is matched, case-insensitively",
          any(x["shop_id"] == e for x in rread(f"admin_search_shops({lit('QUICK ' + tok[:4])}, 10)", ADMIN)["shops"]))

    # Exact UUID and slug prefix.
    f = shop_named(f"Alpha {tok}", slug=f"sr-{tok}-a")
    by_uuid = rread(f"admin_search_shops({lit(f)}, 10)", ADMIN)["shops"]
    check("SR-05 an exact shop UUID matches that shop", [x["shop_id"] for x in by_uuid] == [f], json.dumps(by_uuid))
    by_slug = rread(f"admin_search_shops({lit('sr-' + tok)}, 10)", ADMIN)["shops"]
    check("SR-05 a slug prefix matches", [x["shop_id"] for x in by_slug] == [f], json.dumps(by_slug))

    # Output shape: only shop_id, slug and name. Phone is never returned to admins here.
    secret = "0" + tok
    g = shop_named(f"Phone {tok}", phone=secret)
    raw = json.dumps(rread(f"admin_search_shops({lit('phone ' + tok)}, 10)", ADMIN))
    check("SR-06 search output has exactly the top-level keys and item keys, and no phone",
          secret not in raw and set(json.loads(raw)) == {"ok", "shops", "has_more"}, raw[:200])
    item = json.loads(raw)["shops"][0]
    check("SR-06 each item has exactly shop_id, slug and name", set(item) == {"shop_id", "slug", "name"}, str(item))

    empty = rread(f"admin_search_shops({lit('zz' + uuid.uuid4().hex)}, 10)", ADMIN)
    check("SR-07 no match gives an empty list and has_more false",
          empty == {"ok": True, "shops": [], "has_more": False}, json.dumps(empty))


def test_search_limits_and_order():
    tok = "bk" + uuid.uuid4().hex[:8]
    for i in range(1, 27):
        shop_named(f"Bulk {tok} {i:02d}")
    r = rread(f"admin_search_shops({lit('bulk ' + tok)}, 25)", ADMIN)
    names = [x["name"] for x in r["shops"]]
    check("SR-08 a limit of 25 returns 25 shops and has_more true when 26 match",
          len(names) == 25 and r["has_more"] is True, f"len={len(names)} has_more={r['has_more']}")
    check("SR-08 results are ordered by name", names == sorted(names), str(names[:3]))

    tok2 = "ex" + uuid.uuid4().hex[:8]
    for i in range(1, 26):
        shop_named(f"Exact {tok2} {i:02d}")
    r2 = rread(f"admin_search_shops({lit('exact ' + tok2)}, 25)", ADMIN)
    check("SR-08 exactly 25 matches at limit 25: has_more is false",
          len(r2["shops"]) == 25 and r2["has_more"] is False, f"len={len(r2['shops'])} has_more={r2['has_more']}")
    r3 = rread(f"admin_search_shops({lit('exact ' + tok2)}, 1)", ADMIN)
    check("SR-08 a smaller limit returns one shop and has_more true",
          len(r3["shops"]) == 1 and r3["has_more"] is True, json.dumps(r3)[:160])


# ---------- admin shop licence: version, state, coverages ----------

def test_shop_licence_view():
    admin = new_admin()
    missing = rread(shop_expr(new_uuid()), admin)
    check("SL-A1 an unknown shop is shop_not_found", missing == {"ok": False, "code": "shop_not_found"}, json.dumps(missing))
    check("SL-A1 an unknown shop writes no denial row (not an authorisation failure)",
          denial_rows_in_hour(admin) == 0, str(denial_rows_in_hour(admin)))
    check("SL-A2 a null shop id is invalid_request",
          rread("admin_shop_licence(null::uuid)", admin) == {"ok": False, "code": "invalid_request"})

    s = new_shop()
    empty = rread(shop_expr(s), admin)
    check("SL-A3 a shop with no meta row has state_version 0, state NONE and no coverages",
          empty.get("state_version") == 0 and empty["state"]["state"] == "NONE" and empty["coverages"] == []
          and empty["coverages_truncated"] is False, json.dumps(empty)[:200])
    check("SL-A4 the response has exactly the expected keys",
          set(empty) == {"ok", "shop", "state_version", "state", "coverages", "coverages_truncated"}
          and set(empty["shop"]) == {"shop_id", "slug", "name"}
          and set(empty["state"]) == {"state", "basis", "access_until", "next_start"}, json.dumps(empty)[:300])

    grant = accepted("SL-A5 setup: a confirmed grant", s, "licence_admin_grant",
                     payload(s, 0, grant_kind="one_month"), admin)
    view = rread(shop_expr(s), admin)
    cov = view["coverages"][0] if view["coverages"] else {}
    check("SL-A5 after the grant: state_version is 1 and the coverage ID is the one the write returned",
          view["state_version"] == 1 and len(view["coverages"]) == 1 and cov.get("coverage_id") == grant["coverage_id"],
          json.dumps(view)[:300])
    check("SL-A5 the coverage has exactly the expected keys and no actor or request field",
          set(cov) == {"coverage_id", "kind", "status", "starts_at", "ends_at", "reason"}
          and cov["status"] == "current" and cov["kind"] == "admin_grant" and cov["reason"] == "Test reason",
          json.dumps(cov))
    raw = json.dumps(view)
    check("SL-A6 no actor, request, revocation or phone field appears anywhere in the response",
          not any(k in raw for k in ("created_by", "revoked_by", "request_id", "revoke_reason",
                                     "actor_user_id", "phone", "address")), raw[:200])
    check("SL-A7 the state matches shop_licence_state and the version matches shop_licence_meta",
          view["state"]["state"] == q(f"select state from public.shop_licence_state({lit(s)}::uuid, now());")
          and view["state_version"] == ver(s), json.dumps(view["state"]))


def test_coverage_filtering():
    admin = new_admin()
    s = new_shop()
    current = add_cov(s, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    scheduled = add_cov(s, "admin_grant", "now() + interval '20 days'", "now() + interval '30 days'")
    expired = add_cov(s, "admin_grant", "now() - interval '30 days'", "now() - interval '10 days'")
    revoked = add_cov(s, "admin_grant", "now() - interval '2 days'", "now() + interval '5 days'",
                      revoke_at="now()")
    view = rread(shop_expr(s), admin)
    ids = [c["coverage_id"] for c in view["coverages"]]
    statuses = {c["coverage_id"]: c["status"] for c in view["coverages"]}
    check("CF-01 only live and scheduled coverages are listed (expired and revoked are excluded)",
          set(ids) == {current, scheduled} and expired not in ids and revoked not in ids, f"{ids}")
    check("CF-01 statuses are current and scheduled",
          statuses.get(current) == "current" and statuses.get(scheduled) == "scheduled", json.dumps(statuses))
    check("CF-01 the state is ACTIVE (a current coverage covers now), with an access end and no next start",
          view["state"]["state"] == "ACTIVE" and view["state"]["access_until"] is not None
          and view["state"]["next_start"] is None, json.dumps(view["state"]))

    t = new_shop()
    q(f"select public.licence_lock_shop({lit(t)}::uuid, 'exclusive');\n"
      f"insert into public.licence_coverages (shop_id, kind, starts_at, ends_at, reason, created_by, request_id) "
      f"select {lit(t)}::uuid, 'admin_grant', now() + make_interval(days => g), "
      f"now() + make_interval(days => g + 1), 'fixture', gen_random_uuid(), gen_random_uuid() "
      f"from generate_series(10, 60) g; select 1;")
    capped = rread(shop_expr(t), admin)
    starts = [c["starts_at"] for c in capped["coverages"]]
    check("CF-02 the list is capped at 50 and coverages_truncated is true",
          len(capped["coverages"]) == 50 and capped["coverages_truncated"] is True, f"n={len(capped['coverages'])}")
    check("CF-02 the first 50 by start are returned, in ascending start order, and the state is SCHEDULED",
          starts == sorted(starts) and capped["state"]["state"] == "SCHEDULED",
          json.dumps(capped["state"]))
    check("CF-02 the next start equals the earliest listed start",
          capped["state"]["next_start"] == starts[0], f"{capped['state']['next_start']} vs {starts[0]}")


def test_licence_state_consistency_under_concurrency():
    admin = new_admin()
    s = new_shop()
    claims = {"sub": admin, "role": "authenticated", "aal": "aal2"}
    a_sql = rpc_sql("licence_admin_grant", new_uuid(), payload(s, 0, grant_kind="one_month"), claims)
    b_sql = read_sql(shop_expr(s), claims)
    a_res, b_res = run_async_pair(a_sql, b_sql, b_delay=1.0)
    lines = [l for l in b_res[1].splitlines() if l.startswith("{")]
    b_json = json.loads(lines[-1]) if lines else {"__raw__": b_res[2][-300:]}
    check("SC-01 a read during an uncommitted grant sees the old version with the old coverage list, never a mix",
          a_res[0] == 0 and b_res[0] == 0 and b_json.get("state_version") == 0 and b_json.get("coverages") == []
          and b_json.get("state", {}).get("state") == "NONE", f"a={a_res[0]} b={b_res[0]} {json.dumps(b_json)[:200]}")
    after = rread(shop_expr(s), admin)
    check("SC-02 after the commit the read sees version 1 and one coverage together",
          after.get("state_version") == 1 and len(after.get("coverages", [])) == 1, json.dumps(after)[:200])


# ---------- audit history: keyset pagination ----------

def audit_fixture(shop, actor):
    """Ten rows: seven share one created_at (a replace writes rows with one now()), three are later."""
    q(f"insert into public.licence_audit_log (created_at, actor_user_id, shop_id, action, reason, "
      f"after_state, request_id) "
      f"select case when g <= 7 then timestamptz '2026-11-01 10:00:00.123456+00' "
      f"else timestamptz '2026-11-02 09:30:00.654321+00' end, {lit(actor)}::uuid, {lit(shop)}::uuid, "
      f"'grant', 'fixture', jsonb_build_object('n', g), gen_random_uuid() "
      f"from generate_series(1, 10) g; select 1;")


def test_audit_pagination():
    admin = new_admin()
    s = new_shop()
    audit_fixture(s, admin)
    expected = [l for l in run(f"select id from public.licence_audit_log where shop_id = {lit(s)}::uuid "
                               f"order by created_at desc, id desc;")[1].splitlines() if l and l != "COMMIT"]
    expected = [x for x in expected if len(x) == 36]
    pages, cursor_at, cursor_id = [], None, None
    for _ in range(10):
        r = rread(audit_expr(s, cursor_at, cursor_id, limit=3), admin)
        pages.append(r)
        if r.get("next") is None:
            break
        cursor_at, cursor_id = r["next"]["created_at"], r["next"]["entry_id"]
    got = [e["entry_id"] for p in pages for e in p["entries"]]
    check("AU-01 pages of 3 return every entry once, in (created_at, id) descending order",
          got == expected and len(set(got)) == 10, f"got={len(got)} expected={len(expected)}")
    check("AU-01 the pages are 3, 3, 3, 1 and only the last has next null",
          [len(p["entries"]) for p in pages] == [3, 3, 3, 1] and pages[-1]["next"] is None
          and all(p["next"] is not None for p in pages[:-1]), str([len(p["entries"]) for p in pages]))
    same_ts = set(q_lines(f"select id from public.licence_audit_log where shop_id = {lit(s)}::uuid "
                          f"and created_at = timestamptz '2026-11-01 10:00:00.123456+00';"))
    check("AU-02 the seven equal-timestamp rows are each returned exactly once across the pages",
          len(same_ts) == 7 and same_ts <= set(got) and len(got) == len(set(got)) == 10,
          f"equal={len(same_ts)} got={len(got)}")
    first = pages[0]["entries"][0]
    check("AU-03 each entry has exactly the expected keys",
          set(first) == {"entry_id", "created_at", "action", "coverage_id", "reason", "licence_start",
                         "licence_end", "actor_user_id", "before_state", "after_state"}, json.dumps(first)[:200])
    check("AU-03 the microsecond timestamp survives the cursor round trip",
          "654321" in pages[0]["next"]["created_at"], pages[0]["next"]["created_at"])
    default = rread(audit_expr(s), admin)
    check("AU-04 the default page size is 25 and returns all 10 with next null",
          len(default["entries"]) == 10 and default["next"] is None, str(len(default["entries"])))
    check("AU-05 limit 0 and limit 101 are invalid_request",
          rread(audit_expr(s, limit=0), admin) == {"ok": False, "code": "invalid_request"}
          and rread(audit_expr(s, limit=101), admin) == {"ok": False, "code": "invalid_request"})
    check("AU-05 a cursor with only created_at, or only entry_id, is invalid_request",
          rread(f"admin_shop_audit({lit(s)}::uuid, {lit('2026-11-01T10:00:00+00')}::timestamptz, null::uuid, 3)",
                admin) == {"ok": False, "code": "invalid_request"}
          and rread(f"admin_shop_audit({lit(s)}::uuid, null::timestamptz, {lit(expected[0])}::uuid, 3)", admin)
          == {"ok": False, "code": "invalid_request"})
    check("AU-06 an unknown shop is shop_not_found",
          rread(audit_expr(new_uuid()), admin) == {"ok": False, "code": "shop_not_found"})


def test_audit_index_is_usable():
    out = run("set enable_seqscan = off;\n"
              f"explain select id from public.licence_audit_log where shop_id = {lit(new_uuid())}::uuid "
              "order by created_at desc, id desc limit 4;")[1]
    check("IX-01 the audit keyset query can use licence_audit_log_shop_created_id_idx",
          "licence_audit_log_shop_created_id_idx" in out, out[-200:])
    out2 = run("set enable_seqscan = off;\n"
               "explain select id from public.shops where lower(name) like 'x%';")[1]
    check("IX-02 the name prefix search can use shops_name_pattern_idx",
          "shops_name_pattern_idx" in out2, out2[-200:])


# ---------- denial counters: caps, atomicity, concurrency ----------

def test_denial_cap_and_invariants():
    actor = new_uuid()
    s = new_shop()
    a0, g0 = actor_counts(actor), global_counts()
    for _ in range(21):
        rread(audit_expr(s), actor, aal="aal2")
    a1, g1 = actor_counts(actor), global_counts()
    check("DN-01 21 sequential denials: actor denial +21, actor detail +20 (the cap), global denial +21",
          a1 == (a0[0] + 21, a0[1] + 20) and g1[0] == g0[0] + 21 and g1[1] == g0[1] + 20,
          f"a={a0}->{a1} g={g0}->{g1}")
    check("DN-02 the detail rows in the hour equal the actor's detail_count (no orphan, no missing row)",
          denial_rows_in_hour(actor) == a1[1], f"rows={denial_rows_in_hour(actor)} detail={a1[1]}")


def test_denial_concurrency():
    actor = new_uuid()
    s = new_shop()
    a0 = actor_counts(actor)
    jobs = [(audit_expr(s), actor, "aal2")] * 8
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda j: rread(j[0], j[1], aal=j[2]), jobs))
    a1 = actor_counts(actor)
    check("DC-01 eight concurrent denials for one actor all return forbidden and all count (+8, detail +8)",
          all(r == {"ok": False, "code": "forbidden"} for r in res) and a1 == (a0[0] + 8, a0[1] + 8),
          f"a={a0}->{a1} results={set(json.dumps(r) for r in res)}")

    actor2 = new_uuid()
    a0 = actor_counts(actor2)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        res = list(ex.map(lambda _: rread(audit_expr(s), actor2, aal="aal2"), range(30)))
    a1 = actor_counts(actor2)
    check("DC-02 thirty concurrent denials: the cap is exact under contention (denial +30, detail +20, no overshoot)",
          all(r == {"ok": False, "code": "forbidden"} for r in res) and a1 == (a0[0] + 30, a0[1] + 20),
          f"a={a0}->{a1}")
    check("DC-02 the detail rows for that actor equal its detail_count",
          denial_rows_in_hour(actor2) == a1[1], f"rows={denial_rows_in_hour(actor2)} detail={a1[1]}")

    admin = new_admin()
    actor3 = new_uuid()
    a0 = actor_counts(actor3)
    jobs = [(audit_expr(s), actor3, "aal2")] * 5 + [(SEARCH_ANY, admin, "aal2")] * 5
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        res = list(ex.map(lambda j: rread(j[0], j[1], aal=j[2]), jobs))
    a1 = actor_counts(actor3)
    check("DC-03 five denials and five admin reads at once: the denials count exactly, the reads never count",
          res[:5] == [{"ok": False, "code": "forbidden"}] * 5 and all(r.get("ok") is True for r in res[5:])
          and a1 == (a0[0] + 5, a0[1] + 5), f"a={a0}->{a1}")

    check("DC-04 invariant: 0 <= detail_count <= denial_count on every counter row",
          q("select count(*) from public.licence_denial_windows where detail_count < 0 "
            "or detail_count > denial_count;") == "0")


# ---------- runner ----------

def main():
    global ADMIN
    R.require_fresh_database()
    ADMIN = new_admin()
    suites = [
        # Targeted functions of the 7C suite that these changes touch (not the whole 282-check suite).
        R.test_backdate_window,
        R.test_shop_licence_status,
        R.test_authorisation,
        R.test_concurrent_denial_counters,
        # New in this change.
        test_backdate_fail_closed_and_boundaries,
        test_h4_owner_status_unlogged,
        test_admin_read_privileges,
        test_admin_read_authorisation,
        test_search_validation_and_matching,
        test_search_limits_and_order,
        test_shop_licence_view,
        test_coverage_filtering,
        test_licence_state_consistency_under_concurrency,
        test_audit_pagination,
        test_audit_index_is_usable,
        test_denial_cap_and_invariants,
        test_denial_concurrency,
    ]
    for t in suites:
        print(f"--- {t.__name__}")
        try:
            t()
        except Exception as exc:  # a harness or setup error counts as a failure, never a pass
            check(f"{t.__name__} raised {type(exc).__name__}", False, str(exc)[:500])
    results = R.RESULTS
    failed = [n for n, ok in results if not ok]
    print(f"SUMMARY: {len(results) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print("  FAILED:", n)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
