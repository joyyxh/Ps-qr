#!/usr/bin/env python3
"""Local tests for the Stage 7C admin RPCs (migration 0016) on the throwaway local database.

LOCAL THROWAWAY DATABASE ONLY. Refuses any database name other than stage7c_local. Never run this
against Supabase or the live project. A passing run is local evidence only. It is not hosted Supabase
verification, and it does not verify the real Supabase AAL claim (see the 7C implementation report).

Run: supabase/tests/licence_7c/reset_local.sh && python3 supabase/tests/licence_7c/rpc_tests.py
"""
import datetime
import json
import os
import subprocess
import sys
import time
import uuid

DB = os.environ.get("STAGE7C_DB", "stage7c_local")
SOCK = os.environ.get("STAGE7C_SOCK")
PORT = os.environ.get("STAGE7C_PORT", "55433")

if DB != "stage7c_local":
    raise SystemExit("refusing to run: this harness only uses the local database stage7c_local")
if not SOCK:
    raise SystemExit("set STAGE7C_SOCK to the socket directory of the local throwaway cluster")

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
MISSING = object()
RESULTS = []


def lit(s):
    # Python None must become SQL NULL. str(None) would send the text 'None', which is not a valid uuid
    # (historical run: test_grant_success raised "invalid input syntax for type uuid: \"None\"").
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("PASS" if cond else "FAIL", name, "" if cond else f"| {detail}")


def ist_iso(days):
    """Python-side ISO text (IST offset, microseconds) for now + days, for use as a timestamp input."""
    t = datetime.datetime.now(IST) + datetime.timedelta(days=days)
    return t.isoformat(timespec="microseconds")


# ---------- psql plumbing ----------

def base_cmd():
    return ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", DB,
            "-h", SOCK, "-p", PORT, "-U", "postgres", "-f", "-"]


def script(sql, role=None, claims=None, isolation=None):
    pre = ""
    if isolation:
        pre += f"begin isolation level {isolation};\n"
    if role:
        pre += f"set role {role};\n"
        if claims is not None:
            text = claims if isinstance(claims, str) else json.dumps(claims)
            pre += f"select set_config('request.jwt.claims', {lit(text)}, false)\\g /dev/null\n"
    return pre + sql + "\n"


def run(sql, **kw):
    proc = subprocess.run(base_cmd(), input=script(sql, **kw).encode("utf-8"), capture_output=True)
    return proc.returncode == 0, proc.stdout.decode("utf-8").strip(), proc.stderr.decode("utf-8").strip()


def q(sql):
    """Fixture or read as the postgres superuser. Returns the last output line."""
    ok, out, err = run(sql)
    if not ok:
        raise RuntimeError(f"query failed: {err}\nSQL: {sql[:400]}")
    return out.splitlines()[-1] if out else ""


def require_fresh_database():
    """Refuse to start unless no denial counter window exists yet. The global detail cap is per UTC hour and
    shared by every suite on the database. test_global_cap_provisional fills it, so a later suite in the same
    hour finds the cap already used and its detail-row checks fail for that reason, not for a defect.
    Observed 2026-11-12: read_api_tests run after rpc_tests gave 12 FAILs and one unpacking error. Run
    reset_local.sh before each suite."""
    windows = int(q("select count(*) from public.licence_denial_windows;"))
    if windows:
        raise SystemExit(f"database is not fresh: {windows} denial window rows exist. "
                         "Run reset_local.sh, then start the suite again.")


def call(fn, request_id, payload, user, aal="aal2", claims=None, isolation=None, role="authenticated"):
    """Call one RPC. Returns the decoded JSON, or {'__error__': text} when psql raised."""
    if claims is None and user is not None:
        claims = {"sub": user, "role": "authenticated"}
        if aal is not None:
            claims["aal"] = aal
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    sql = f"select public.{fn}({lit(request_id)}::uuid, {lit(text)}::jsonb);"
    ok, out, err = run(sql, role=role, claims=claims, isolation=isolation)
    if not ok:
        return {"__error__": err}
    return json.loads(out.splitlines()[-1])


def payload(shop, expected, **kw):
    p = {"shop_id": shop, "expected_state_version": expected, "confirm": True,
         "reason": "Test reason"}
    p.update(kw)
    return {k: v for k, v in p.items() if v is not MISSING}


def new_uuid():
    return str(uuid.uuid4())


def new_admin():
    u = new_uuid()
    q(f"insert into auth.users (id) values ({lit(u)}); "
      f"insert into public.platform_admins (user_id) values ({lit(u)}); select 1;")
    return u


def new_shop():
    s = new_uuid()
    q(f"insert into public.shops (id) values ({lit(s)}); select 1;")
    return s


def ver(shop):
    return int(q(f"select coalesce((select state_version from public.shop_licence_meta "
                 f"where shop_id = {lit(shop)}), 0);"))


def cnt(sql):
    return int(q(sql))


def add_cov(shop, kind, starts, ends=None, revoke_at=None):
    """Direct fixture coverage as the superuser. starts, ends and revoke_at are SQL expressions.
    revoke_at is applied with the one permitted revocation update, in a later statement."""
    cid = new_uuid()
    end_sql = ends if ends else "null"
    q(f"select public.licence_lock_shop({lit(shop)}::uuid, 'exclusive');\n"
      f"insert into public.licence_coverages "
      f"(id, shop_id, kind, starts_at, ends_at, reason, created_by, request_id) values "
      f"({lit(cid)}, {lit(shop)}, {lit(kind)}, {starts}, {end_sql}, 'fixture', "
      f"{lit(new_uuid())}, {lit(new_uuid())}); select 1;")
    if revoke_at:
        q(f"update public.licence_coverages set revoked_at = {revoke_at}, "
          f"revoked_by = {lit(new_uuid())}, revoke_reason = 'fixture revoke' "
          f"where id = {lit(cid)}; select 1;")
    return cid


def cov_field(cid, expr):
    return q(f"select {expr} from public.licence_coverages where id = {lit(cid)};")


def cov_end_text(cid):
    """A coverage's end as an IST ISO text with microseconds, usable as a start input."""
    return q(f"select to_char(ends_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD\"T\"HH24:MI:SS.US') "
             f"|| '+05:30' from public.licence_coverages where id = {lit(cid)};")


def ledger_for_shop(shop):
    return cnt(f"select count(*) from public.licence_requests where shop_id = {lit(shop)}::uuid")


def snap(shop):
    return (ver(shop),
            cnt(f"select count(*) from public.licence_requests where shop_id = {lit(shop)}"),
            cnt(f"select count(*) from public.licence_audit_log where shop_id = {lit(shop)}"),
            cnt(f"select count(*) from public.licence_coverages where shop_id = {lit(shop)}"))


def rejected(name, shop, code, fn, pl, user, aal="aal2", claims=None, rid=None):
    """A committed rejection with a specific code. Nothing may change: no version, ledger, audit
    or coverage row."""
    before = snap(shop)
    r = call(fn, rid or new_uuid(), pl, user, aal=aal, claims=claims)
    after = snap(shop)
    ok = r.get("ok") is False and r.get("code") == code and before == after
    check(name, ok, f"got={json.dumps(r, ensure_ascii=False)} before={before} after={after}")
    return r


def accepted(name, shop, fn, pl, user, extra=None, rid=None):
    """A committed success: state_version moves by exactly one and one ledger row is written."""
    before = snap(shop)
    r = call(fn, rid or new_uuid(), pl, user)
    after = snap(shop)
    ok = (r.get("ok") is True and r.get("replay") is False
          and after[0] == before[0] + 1 and after[1] == before[1] + 1)
    if extra is not None:
        ok = ok and extra(r)
    check(name, ok, f"got={json.dumps(r, ensure_ascii=False)} before={before} after={after}")
    return r


# ---------- Grant ----------

def test_grant_success():
    admin = new_admin()
    shop = new_shop()
    g01 = new_uuid()
    r = accepted("G-01 one_month grant from now succeeds with exactly one version step",
                 shop, "licence_admin_grant", payload(shop, 0, grant_kind="one_month"), admin, rid=g01)
    cid = r.get("coverage_id")
    check("G-01 coverage is admin_grant starting now, IST calendar end",
          cov_field(cid, "kind = 'admin_grant' and abs(extract(epoch from (starts_at - now()))) < 300 "
                         "and ends_at = ((starts_at at time zone 'Asia/Kolkata') + interval '1 month') "
                         "at time zone 'Asia/Kolkata'") == "t")
    check("G-01 one audit row for the grant, carrying this request_id",
          cnt(f"select count(*) from public.licence_audit_log where coverage_id = {lit(cid)} "
              f"and action = 'grant' and request_id = {lit(g01)}::uuid") == 1)

    # One_year starts now (the default). A future start is refused (see GF-02).
    shop_y = new_shop()
    r = accepted("G-02 one_year grant with no start succeeds (starts now)", shop_y,
                 "licence_admin_grant", payload(shop_y, 0, grant_kind="one_year"), admin)
    check("G-02 one_year starts now and ends one calendar year later (IST)",
          cov_field(r.get("coverage_id"), "abs(extract(epoch from (starts_at - now()))) < 300 and ends_at = "
                                          "((starts_at at time zone 'Asia/Kolkata') + interval '1 year') "
                                          "at time zone 'Asia/Kolkata'") == "t")

    shop2 = new_shop()
    r = accepted("G-03 custom date-only grant succeeds", shop2, "licence_admin_grant",
                 payload(shop2, 0, grant_kind="custom", start="2030-04-01", end="2030-05-01"), admin)
    check("G-03 date-only start is 00:00 IST and the end is exclusive 00:00 IST",
          cov_field(r.get("coverage_id"), "starts_at = '2030-03-31T18:30:00Z'::timestamptz "
                                          "and ends_at = '2030-04-30T18:30:00Z'::timestamptz") == "t")

    shop3 = new_shop()
    r = accepted("G-04 lifetime grant succeeds with no end", shop3, "licence_admin_grant",
                 payload(shop3, 0, grant_kind="lifetime"), admin)
    check("G-04 lifetime coverage has no end",
          cov_field(r.get("coverage_id"), "kind = 'lifetime_grant' and ends_at is null") == "t")

    shop4 = new_shop()
    bd = ist_iso(-10)  # inside the 31-day staging window (the harness row is written by reset_local.sh)
    r = accepted("G-12 backdate inside the staging window with confirmation succeeds",
                 shop4, "licence_admin_grant",
                 payload(shop4, 0, grant_kind="one_month", start=bd, backdate_confirm=True), admin)
    check("G-12 the backdated one_month starts at the given instant and ends one IST calendar month later",
          cov_field(r.get("coverage_id"), f"starts_at = {lit(bd)}::timestamptz and ends_at = "
                                          "((starts_at at time zone 'Asia/Kolkata') + interval '1 month') "
                                          "at time zone 'Asia/Kolkata'") == "t")

    shop5 = new_shop()
    r = accepted("G-20 future custom start is accepted as scheduled coverage",
                 shop5, "licence_admin_grant",
                 payload(shop5, 0, grant_kind="custom", start=ist_iso(5), end=ist_iso(35)), admin)
    check("G-20 scheduled coverage is SCHEDULED, not ACTIVE",
          q(f"select state from public.shop_licence_state({lit(shop5)}::uuid, now())") == "SCHEDULED")


def test_grant_rejections():
    admin = new_admin()
    shop = new_shop()
    g = "licence_admin_grant"
    rejected("G-05 empty reason after trimming is invalid_reason", shop, "invalid_reason", g,
             payload(shop, 0, grant_kind="one_month", reason="   "), admin)
    rejected("G-05 missing reason is invalid_reason", shop, "invalid_reason", g,
             payload(shop, 0, grant_kind="one_month", reason=MISSING), admin)
    rejected("G-07 reason of 501 code points is invalid_reason", shop, "invalid_reason", g,
             payload(shop, 0, grant_kind="one_month", reason="x" * 501), admin)
    rejected("G-08 confirm false is not_confirmed", shop, "not_confirmed", g,
             payload(shop, 0, grant_kind="one_month", confirm=False), admin)
    rejected("G-09 unknown field is rejected, not ignored", shop, "unknown_field", g,
             payload(shop, 0, grant_kind="one_month", payload_hash="00"), admin)
    rejected("G-09 request_id inside the payload is an unknown field", shop, "unknown_field", g,
             payload(shop, 0, grant_kind="one_month", request_id=new_uuid()), admin)
    rejected("G-09 a client-supplied caller UID is an unknown field", shop, "unknown_field", g,
             payload(shop, 0, grant_kind="one_month", caller_uid=admin), admin)
    rejected("G-10 custom without end is end_required", shop, "end_required", g,
             payload(shop, 0, grant_kind="custom", start="2030-04-01"), admin)
    rejected("G-10 custom without start is start_required", shop, "start_required", g,
             payload(shop, 0, grant_kind="custom", end="2030-05-01"), admin)
    rejected("G-10 custom with end equal to start is custom_range_invalid", shop, "custom_range_invalid", g,
             payload(shop, 0, grant_kind="custom", start="2030-05-01", end="2030-05-01"), admin)
    rejected("G-11 one_month with an end is end_not_allowed", shop, "end_not_allowed", g,
             payload(shop, 0, grant_kind="one_month", end="2030-05-01"), admin)
    rejected("G-11 lifetime with an end is end_not_allowed", shop, "end_not_allowed", g,
             payload(shop, 0, grant_kind="lifetime", end="2030-05-01"), admin)
    rejected("G-12 backdate without confirmation is backdate_not_confirmed", shop,
             "backdate_not_confirmed", g,
             payload(shop, 0, grant_kind="one_month", start="2001-01-31T15:00:00+05:30"), admin)
    rejected("G-13 unknown grant kind is invalid_grant_kind", shop, "invalid_grant_kind", g,
             payload(shop, 0, grant_kind="weekly"), admin)
    rejected("G-19 timestamp without an offset is invalid_timestamp", shop, "invalid_timestamp", g,
             payload(shop, 0, grant_kind="custom", start="2030-04-01T00:00:00", end="2030-05-01"), admin)
    rejected("G-19 seven fractional digits is invalid_timestamp", shop, "invalid_timestamp", g,
             payload(shop, 0, grant_kind="custom", start="2030-04-01T00:00:00.1234567+05:30",
                     end="2030-05-01"), admin)
    rejected("G-14 stale expected_state_version is stale_state_version", shop,
             "stale_state_version", g, payload(shop, 5, grant_kind="one_month"), admin)
    rejected("G-14 expected_state_version written as 5.0 is invalid_request", shop,
             "invalid_request", g, payload(shop, 0, grant_kind="one_month") | {"expected_state_version": 5.0},
             admin)
    rejected("G-15 unknown shop is shop_not_found", new_uuid(), "shop_not_found", g,
             payload(new_uuid(), 0, grant_kind="one_month"), admin)


def test_grant_overlap():
    admin = new_admin()
    shop = new_shop()
    r = accepted("O-0 first one_month grant", shop, "licence_admin_grant",
                 payload(shop, 0, grant_kind="one_month"), admin)
    rejected("O-1 overlapping same-kind admin grant is overlap", shop, "overlap", "licence_admin_grant",
             payload(shop, 1, grant_kind="custom", start=ist_iso(10), end=ist_iso(40)), admin)
    accepted("O-2 touching admin grant (starts at the existing end) is allowed", shop,
             "licence_admin_grant",
             payload(shop, 1, grant_kind="custom", start=cov_end_text(r["coverage_id"]),
                     end=ist_iso(3000)), admin)

    shop2 = new_shop()
    accepted("O-3 first lifetime grant succeeds", shop2, "licence_admin_grant",
             payload(shop2, 0, grant_kind="lifetime"), admin)
    rejected("O-3 a second non-revoked lifetime grant is overlap", shop2, "overlap",
             "licence_admin_grant", payload(shop2, 1, grant_kind="lifetime"), admin)
    accepted("O-4 an admin grant over a lifetime grant is allowed (different kind)", shop2,
             "licence_admin_grant", payload(shop2, 1, grant_kind="one_month"), admin)

    shop3 = new_shop()
    add_cov(shop3, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'",
            revoke_at="now()")
    accepted("O-5 a revoked coverage does not block a new same-kind grant", shop3,
             "licence_admin_grant", payload(shop3, 0, grant_kind="one_month"), admin)


# ---------- Extend ----------

def test_extend():
    admin = new_admin()
    shop = new_shop()
    existing = add_cov(shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    old_end = cov_field(existing, "ends_at")
    r = accepted("X-01 extend month succeeds", shop, "licence_admin_extend",
                 payload(shop, 0, extension_unit="month"), admin)
    new_cov = r.get("coverage_id")
    check("X-01 extension starts exactly at the old end (no gap, no overlap)",
          cov_field(new_cov, f"starts_at = {lit(old_end)}::timestamptz") == "t")
    check("X-01 extension end is one calendar month after its start (IST)",
          cov_field(new_cov, "ends_at = ((starts_at at time zone 'Asia/Kolkata') + interval '1 month') "
                             "at time zone 'Asia/Kolkata'") == "t")

    shop2 = new_shop()
    r = accepted("X-02 extend with no coverage succeeds", shop2, "licence_admin_extend",
                 payload(shop2, 0, extension_unit="year"), admin)
    check("X-02 extension with no coverage starts now, one calendar year",
          cov_field(r.get("coverage_id"),
                    "abs(extract(epoch from (starts_at - now()))) < 300 and ends_at = "
                    "((starts_at at time zone 'Asia/Kolkata') + interval '1 year') at time zone 'Asia/Kolkata'")
          == "t")

    shop3 = new_shop()
    add_cov(shop3, "lifetime_grant", "now() - interval '1 day'", None)
    rejected("X-04 an active lifetime grant rejects extend", shop3, "extend_blocked_by_lifetime",
             "licence_admin_extend", payload(shop3, 0, extension_unit="month"), admin)

    shop4 = new_shop()
    add_cov(shop4, "lifetime_grant", "now() + interval '30 days'", None)
    rejected("X-05 a scheduled (future) lifetime grant also rejects extend", shop4,
             "extend_blocked_by_lifetime", "licence_admin_extend",
             payload(shop4, 0, extension_unit="month"), admin)

    shop5 = new_shop()
    add_cov(shop5, "lifetime_grant", "now() - interval '1 day'", None, revoke_at="now()")
    accepted("X-06 extend is allowed once every non-revoked lifetime grant is revoked", shop5,
             "licence_admin_extend", payload(shop5, 0, extension_unit="month"), admin)

    shop6 = new_shop()
    add_cov(shop6, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    for label, unit in [("day", "day"), ("week", "week"), ("six months", "six_months"),
                        ("two years", "two_years"), ("empty", ""), ("wrong case", "Month")]:
        rejected(f"X-07 unsupported unit ({label}) is invalid_extension_unit", shop6,
                 "invalid_extension_unit", "licence_admin_extend",
                 payload(shop6, 0, extension_unit=unit), admin)
    rejected("X-08 a start field is an unknown field for extend", shop6, "unknown_field",
             "licence_admin_extend", payload(shop6, 0, extension_unit="month", start=ist_iso(1)), admin)
    rejected("X-09 missing reason is invalid_reason for extend", shop6, "invalid_reason",
             "licence_admin_extend", payload(shop6, 0, extension_unit="month", reason=MISSING), admin)
    rejected("X-10 stale expected version is stale_state_version for extend", shop6,
             "stale_state_version", "licence_admin_extend",
             payload(shop6, 9, extension_unit="month"), admin)


# ---------- Revoke and Replace ----------

def test_revoke():
    admin = new_admin()
    shop = new_shop()
    cid = add_cov(shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    r1 = new_uuid()
    r = accepted("R-01 revoke an active coverage succeeds", shop, "licence_admin_revoke",
                 payload(shop, 0, target_coverage_id=cid), admin, rid=r1)
    check("R-01 the target is revoked now, with the revoker and reason recorded",
          cov_field(cid, "revoked_at is not null and revoked_by is not null "
                         "and revoke_reason = 'Test reason'") == "t")
    check("R-01 one audit row of action revoke, pointing at the target",
          cnt(f"select count(*) from public.licence_audit_log where coverage_id = {lit(cid)} "
              f"and action = 'revoke'") == 1)
    check("R-01 the ledger row for this request carries the target coverage id",
          q(f"select target_coverage_id = {lit(cid)}::uuid from public.licence_requests "
            f"where request_id = {lit(r1)}::uuid;") == "t")
    check("R-01 state is REVOKED after revoking the only period",
          q(f"select state from public.shop_licence_state({lit(shop)}::uuid, now());") == "REVOKED")

    rejected("R-02 revoking an already revoked coverage is coverage_already_revoked", shop,
             "coverage_already_revoked", "licence_admin_revoke",
             payload(shop, 1, target_coverage_id=cid), admin)

    shop2 = new_shop()
    ended = add_cov(shop2, "admin_grant", "now() - interval '10 days'", "now() - interval '1 day'")
    rejected("R-03 revoking at or after the natural end is natural_end_passed (M2)", shop2,
             "natural_end_passed", "licence_admin_revoke",
             payload(shop2, 0, target_coverage_id=ended), admin)

    shop3 = new_shop()
    future = add_cov(shop3, "admin_grant", "now() + interval '2 days'", "now() + interval '30 days'")
    accepted("R-04 cancelling a future period is allowed", shop3, "licence_admin_revoke",
             payload(shop3, 0, target_coverage_id=future), admin)
    check("R-04 the cancelled period has no effect: state is NONE",
          q(f"select state from public.shop_licence_state({lit(shop3)}::uuid, now());") == "NONE")

    shop4 = new_shop()
    other_shop = new_shop()
    other_cov = add_cov(other_shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rejected("R-05 a target in another shop is coverage_not_found", shop4, "coverage_not_found",
             "licence_admin_revoke", payload(shop4, 0, target_coverage_id=other_cov), admin)
    check("R-05 the other shop's coverage is untouched",
          cov_field(other_cov, "revoked_at is null") == "t")
    rejected("R-06 an unknown target is coverage_not_found", shop4, "coverage_not_found",
             "licence_admin_revoke", payload(shop4, 0, target_coverage_id=new_uuid()), admin)
    rejected("R-08 missing reason for revoke is invalid_reason", shop, "invalid_reason",
             "licence_admin_revoke", payload(shop, 1, target_coverage_id=cid, reason=MISSING), admin)

    shop5 = new_shop()
    life = add_cov(shop5, "lifetime_grant", "now() - interval '1 day'", None)
    accepted("R-07 revoking a lifetime grant succeeds", shop5, "licence_admin_revoke",
             payload(shop5, 0, target_coverage_id=life), admin)


def test_replace():
    admin = new_admin()
    shop = new_shop()
    target = add_cov(shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    r = accepted("P-01 replace succeeds with one version step", shop, "licence_admin_replace",
                 payload(shop, 0, target_coverage_id=target, grant_kind="one_year"), admin)
    new_cov = r.get("coverage_id")
    check("P-01 the target is revoked and the new coverage starts now with a one-year end",
          cov_field(target, "revoked_at is not null") == "t" and
          cov_field(new_cov, "kind = 'admin_grant' and abs(extract(epoch from (starts_at - now()))) < 300 "
                             "and ends_at = ((starts_at at time zone 'Asia/Kolkata') + interval '1 year') "
                             "at time zone 'Asia/Kolkata'") == "t")
    check("P-01 two audit rows of action replace share one request_id",
          q(f"select count(*) = 2 and count(distinct request_id) = 1 from public.licence_audit_log "
            f"where shop_id = {lit(shop)}::uuid and action = 'replace';") == "t")
    check("P-01 the ledger target is the revoked coverage",
          q(f"select count(*) from public.licence_requests where shop_id = {lit(shop)}::uuid "
            f"and target_coverage_id = {lit(target)}::uuid;") == "1")

    shop2 = new_shop()
    other_shop = new_shop()
    other_cov = add_cov(other_shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rejected("P-02 replace with a target in another shop is coverage_not_found", shop2,
             "coverage_not_found", "licence_admin_replace",
             payload(shop2, 0, target_coverage_id=other_cov, grant_kind="one_month"), admin)
    check("P-02 the other shop's coverage is untouched",
          cov_field(other_cov, "revoked_at is null") == "t")

    shop3 = new_shop()
    ended = add_cov(shop3, "admin_grant", "now() - interval '10 days'", "now() - interval '1 day'")
    rejected("P-03 replace of a naturally ended coverage is natural_end_passed", shop3,
             "natural_end_passed", "licence_admin_replace",
             payload(shop3, 0, target_coverage_id=ended, grant_kind="one_month"), admin)

    shop4 = new_shop()
    t4 = add_cov(shop4, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    add_cov(shop4, "admin_grant", "now() + interval '20 days'", "now() + interval '30 days'")
    rejected("P-04 replacement overlapping another same-kind coverage is overlap", shop4, "overlap",
             "licence_admin_replace",
             payload(shop4, 0, target_coverage_id=t4, grant_kind="custom",
                     start=ist_iso(5), end=ist_iso(25)), admin)
    check("P-04 a rejected replace leaves the target active (atomic)",
          cov_field(t4, "revoked_at is null") == "t")

    shop5 = new_shop()
    t5 = add_cov(shop5, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rejected("P-06 replacement custom without a start is start_required", shop5, "start_required",
             "licence_admin_replace",
             payload(shop5, 0, target_coverage_id=t5, grant_kind="custom", end=ist_iso(20)), admin)
    check("P-06 the target stays active after the rejected replace",
          cov_field(t5, "revoked_at is null") == "t")

    shop6 = new_shop()
    t6 = add_cov(shop6, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    # H3 (correction pass): the revoked target does not block its replacement, even where the new
    # backdated period overlaps the target's past. Revoked coverage is excluded from the overlap test.
    r6 = accepted("P-07 a backdated replacement overlapping the revoked target's past is accepted", shop6,
                  "licence_admin_replace",
                  payload(shop6, 0, target_coverage_id=t6, grant_kind="one_month", start=ist_iso(-2),
                          backdate_confirm=True), admin)
    check("P-07 the target is revoked and the replacement starts two days back",
          cov_field(t6, "revoked_at is not null") == "t" and
          cov_field(r6.get("coverage_id"), "starts_at between now() - interval '3 days' "
                                           "and now() - interval '1 day'") == "t")

    shop7 = new_shop()
    life = add_cov(shop7, "lifetime_grant", "now() - interval '1 day'", None)
    accepted("P-05 replacing a lifetime grant with a one-month grant succeeds", shop7,
             "licence_admin_replace", payload(shop7, 0, target_coverage_id=life, grant_kind="one_month"),
             admin)


# ---------- denial counters ----------

HOUR = "date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC'"


def actor_counts(actor):
    if actor is None:
        return (0, 0)
    out = q(f"select coalesce(sum(denial_count), 0) || '|' || coalesce(sum(detail_count), 0) "
            f"from public.licence_denial_windows where scope = 'actor' "
            f"and actor_user_id = {lit(actor)}::uuid and window_start = {HOUR};")
    d, dt = out.split("|")
    return (int(d), int(dt))


def global_counts():
    out = q(f"select coalesce(sum(denial_count), 0) || '|' || coalesce(sum(detail_count), 0) "
            f"from public.licence_denial_windows where scope = 'global' and window_start = {HOUR};")
    d, dt = out.split("|")
    return (int(d), int(dt))


def denial_rows(actor):
    if actor is None:
        return 0
    return cnt(f"select count(*) from public.licence_denials where actor_user_id = {lit(actor)}::uuid")


def denied(name, shop, fn, pl, actor, claims=None, aal=None, expect_detail=True):
    """A committed forbidden. Counters move. A detail row is written only when the caps allow it.
    No version, ledger, audit or coverage row changes."""
    before = snap(shop)
    a0, g0, rows0 = actor_counts(actor), global_counts(), denial_rows(actor)
    rid = new_uuid()
    if claims is None and actor is not None:
        claims = {"sub": actor, "role": "authenticated"}
        if aal is not None:
            claims["aal"] = aal
    r = call(fn, rid, pl, None, claims=claims)
    after = snap(shop)
    a1, g1, rows1 = actor_counts(actor), global_counts(), denial_rows(actor)
    ok = (r.get("ok") is False and r.get("code") == "forbidden" and before == after)
    ok = ok and g1[0] == g0[0] + 1
    if actor is not None:
        ok = ok and a1[0] == a0[0] + 1
        if expect_detail:
            ok = ok and a1[1] == a0[1] + 1 and rows1 == rows0 + 1 and g1[1] == g0[1] + 1
    check(name, ok, f"got={r} before={before} after={after} a0={a0} a1={a1} g0={g0} g1={g1} rows={rows0}->{rows1}")
    return r


# ---------- AAL2 and authorisation ----------

def test_authorisation():
    admin = new_admin()
    shop = new_shop()
    accepted("A-00 aal2 admin success path", shop, "licence_admin_grant",
             payload(shop, 0, grant_kind="one_month"), admin)
    shop2 = new_shop()
    denied("A-01 admin with no aal claim is forbidden", shop2, "licence_admin_grant",
           payload(shop2, 0, grant_kind="one_month"), admin, aal=None)
    check("A-01 no coverage, audit or ledger row was written for the denied call",
          snap(shop2) == (0, 0, 0, 0), str(snap(shop2)))
    denied("A-02 aal1 is insufficient and forbidden", shop2, "licence_admin_grant",
           payload(shop2, 0, grant_kind="one_month"), admin, aal="aal1")
    denied("A-03 aal is compared exactly (AAL2 in capitals is forbidden)", shop2, "licence_admin_grant",
           payload(shop2, 0, grant_kind="one_month"), admin, aal="AAL2")
    denied("A-09 denied extend writes nothing", shop2, "licence_admin_extend",
           payload(shop2, 0, extension_unit="month"), admin, aal="aal1")

    non_admin = new_uuid()
    q(f"insert into auth.users (id) values ({lit(non_admin)}); select 1;")
    denied("A-05 a signed-in user who is not a platform admin is forbidden", shop2, "licence_admin_grant",
           payload(shop2, 0, grant_kind="one_month"), non_admin, aal="aal2")

    disabled = new_admin()
    q(f"update public.platform_admins set disabled_at = now() where user_id = {lit(disabled)}; select 1;")
    denied("A-06 a disabled admin is forbidden", shop2, "licence_admin_grant",
           payload(shop2, 0, grant_kind="one_month"), disabled, aal="aal2")

    # Unreadable claims: auth.uid() cannot be read, so there is no actor. Only the global counter moves.
    g0 = global_counts()
    before = snap(shop2)
    r = call("licence_admin_grant", new_uuid(), payload(shop2, 0, grant_kind="one_month"), None,
             claims="{not json")
    g1 = global_counts()
    check("A-04 unreadable claims are forbidden, global counter only, nothing written",
          r.get("ok") is False and r.get("code") == "forbidden" and g1[0] == g0[0] + 1
          and snap(shop2) == before, json.dumps(r))

    g0 = global_counts()
    before = snap(shop2)
    r = call("licence_admin_grant", new_uuid(), payload(shop2, 0, grant_kind="one_month"), None, claims=None)
    g1 = global_counts()
    check("A-08 no claims at all (no caller UID) is forbidden with the global counter only",
          r.get("ok") is False and r.get("code") == "forbidden" and g1[0] == g0[0] + 1
          and snap(shop2) == before, json.dumps(r))

    r = call("licence_admin_grant", new_uuid(), payload(shop2, 0, grant_kind="one_month"), None,
             claims=None, role="anon")
    check("A-07 anon has no EXECUTE, so the call is refused by privilege, not by a row",
          "__error__" in r and "permission denied" in r["__error__"], json.dumps(r))


# ---------- replay and conflict ----------

def test_replay_and_conflicts():
    admin = new_admin()
    shop = new_shop()
    rid = new_uuid()
    first = accepted("RP-00 original grant commits", shop, "licence_admin_grant",
                     payload(shop, 0, grant_kind="custom", start="2030-04-01", end="2030-05-01"),
                     admin, rid=rid)
    before = snap(shop)
    again = call("licence_admin_grant", rid,
                 payload(shop, 0, grant_kind="custom", start="2030-04-01", end="2030-05-01"), admin)
    check("RP-01 same request_id and same hash replays the stored result",
          again.get("ok") is True and again.get("replay") is True
          and again.get("coverage_id") == first.get("coverage_id")
          and again.get("state_version_after") == first.get("state_version_after")
          and snap(shop) == before, json.dumps(again))

    base = dict(grant_kind="custom", start="2030-04-01", end="2030-05-01")
    rejected("RP-02 same request_id with a different reason is request_conflict", shop, "request_conflict",
             "licence_admin_grant", payload(shop, 0, **{**base, "reason": "Other reason"}), admin, rid=rid)
    rejected("RP-04 same request_id with a different expected version is request_conflict", shop,
             "request_conflict", "licence_admin_grant", payload(shop, 1, **base), admin, rid=rid)
    rejected("RP-05 same request_id with a different grant kind is request_conflict", shop,
             "request_conflict", "licence_admin_grant",
             payload(shop, 0, **{**base, "grant_kind": "one_month"}), admin, rid=rid)
    rejected("RP-06 same request_id with a different end is request_conflict", shop, "request_conflict",
             "licence_admin_grant", payload(shop, 0, **{**base, "end": "2030-06-01"}), admin, rid=rid)
    rejected("RP-06 same request_id with a different start is request_conflict", shop, "request_conflict",
             "licence_admin_grant", payload(shop, 0, **{**base, "start": "2030-04-02"}), admin, rid=rid)
    rejected("RP-07 adding backdate_confirm changes the hash, so request_conflict", shop, "request_conflict",
             "licence_admin_grant", payload(shop, 0, **{**base, "backdate_confirm": True}), admin, rid=rid)

    other_admin = new_admin()
    rejected("RP-08 the same request_id from another admin is request_conflict (UID is hashed)", shop,
             "request_conflict", "licence_admin_grant", payload(shop, 0, **base), other_admin, rid=rid)

    shop2 = new_shop()
    rejected("RP-03 the same request_id on another shop is request_conflict", shop2, "request_conflict",
             "licence_admin_grant", payload(shop2, 0, **base), admin, rid=rid)

    r = call("licence_admin_grant", rid,
             payload(shop, 0, grant_kind="custom", start="2030-04-01T00:00:00+05:30",
                     end="2030-05-01T00:00:00+05:30"), admin)
    check("RP-12 date-only and offset forms of the same instant replay (same hash)",
          r.get("replay") is True, json.dumps(r))

    r = call("licence_admin_grant", rid, payload(shop, 0, grant_kind="custom", start="2030-04-01",
                                                  end="2030-05-01", reason="Test reason  "), admin)
    check("RP-11 trailing spaces in the reason are trimmed before hashing, so it replays",
          r.get("replay") is True, json.dumps(r))

    shop3 = new_shop()
    rid3 = new_uuid()
    nfc = "Caf\u00e9 promo"
    first = accepted("RP-11 original with NFC reason commits", shop3, "licence_admin_grant",
                     payload(shop3, 0, grant_kind="one_month", reason=nfc), admin, rid=rid3)
    r = call("licence_admin_grant", rid3,
             payload(shop3, 0, grant_kind="one_month", reason="Cafe\u0301 promo  "), admin)
    check("RP-11 the NFD form with trailing spaces replays the NFC original",
          r.get("replay") is True and r.get("coverage_id") == first.get("coverage_id"), json.dumps(r))

    # Revoke and replace replays return the target, and replace returns the new coverage.
    shop4 = new_shop()
    target = add_cov(shop4, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rid4 = new_uuid()
    rv = accepted("RP-09 revoke commits", shop4, "licence_admin_revoke",
                  payload(shop4, 0, target_coverage_id=target), admin, rid=rid4)
    rr = call("licence_admin_revoke", rid4, payload(shop4, 0, target_coverage_id=target), admin)
    check("RP-09 revoke replay returns the target id and no coverage id",
          rr.get("replay") is True and rr.get("target_coverage_id") == target
          and rr.get("coverage_id") is None, json.dumps(rr))

    shop5 = new_shop()
    t5 = add_cov(shop5, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rid5 = new_uuid()
    rp = accepted("RP-10 replace commits", shop5, "licence_admin_replace",
                  payload(shop5, 0, target_coverage_id=t5, grant_kind="one_month"), admin, rid=rid5)
    rr = call("licence_admin_replace", rid5, payload(shop5, 0, target_coverage_id=t5, grant_kind="one_month"),
              admin)
    check("RP-10 replace replay returns the new coverage and the target",
          rr.get("replay") is True and rr.get("coverage_id") == rp.get("coverage_id")
          and rr.get("target_coverage_id") == t5, json.dumps(rr))

    shop6 = new_shop()
    accepted("RP-13 setup: the first grant moves the version from 0 to 1", shop6,
             "licence_admin_grant", payload(shop6, 0, grant_kind="one_month"), admin)
    rejected("RP-13 a NEW request_id that quotes the old version 0 is stale_state_version, not a replay",
             shop6, "stale_state_version", "licence_admin_grant",
             payload(shop6, 0, grant_kind="one_month"), admin)


# ---------- counters, atomicity and caps ----------

def test_counters():
    admin = new_admin()
    shop = new_shop()
    denied("C-01 a denial moves the actor and global counters and writes one detail row", shop,
           "licence_admin_grant", payload(shop, 0, grant_kind="one_month"), admin, aal="aal1")

    # Actor cap: 20 detail rows per actor per UTC hour. The 21st denial is counted, not detailed.
    actor = new_admin()
    for i in range(20):
        call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None,
             claims={"sub": actor, "role": "authenticated", "aal": "aal1"})
    a_before = actor_counts(actor)
    r = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None,
             claims={"sub": actor, "role": "authenticated", "aal": "aal1"})
    a_after = actor_counts(actor)
    check("C-02 the 21st denial is counted and its detail is omitted (denial 21, detail 20)",
          r.get("code") == "forbidden" and a_after == (a_before[0] + 1, a_before[1])
          and a_after[1] == 20 and denial_rows(actor) == 20,
          f"before={a_before} after={a_after} rows={denial_rows(actor)}")

    # Unexpected counter failures roll back everything and raise. None of them returns forbidden.
    fail_actor = new_admin()
    q("create or replace function public.test_fail_counter() returns trigger language plpgsql as $$ "
      "begin raise exception 'injected counter failure'; end; $$;")

    def inject(scope_clause, label, table_name):
        q(f"drop trigger if exists test_fail on public.{table_name};\n"
          f"create trigger test_fail before insert or update on public.{table_name} "
          f"for each row when ({scope_clause}) execute function public.test_fail_counter();\n select 1;")
        before_a, before_g = actor_counts(fail_actor), global_counts()
        before_rows = denial_rows(fail_actor)
        r = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None,
                 claims={"sub": fail_actor, "role": "authenticated", "aal": "aal1"})
        q(f"drop trigger if exists test_fail on public.{table_name}; select 1;")
        after_a, after_g = actor_counts(fail_actor), global_counts()
        ok = ("__error__" in r and "injected counter failure" in r["__error__"]
              and before_a == after_a and before_g == after_g and denial_rows(fail_actor) == before_rows)
        check(label, ok, json.dumps(r)[:300] + f" a={before_a}->{after_a} g={before_g}->{after_g}")

    inject("new.scope = 'actor'", "C-04 an actor counter write failure raises and rolls back; no forbidden",
           "licence_denial_windows")
    inject("new.scope = 'global'", "C-05 a global counter write failure raises and rolls back the actor row too",
           "licence_denial_windows")
    inject("true", "C-06 a required detail write failure raises and rolls back both counters", "licence_denials")

    # A denial with no caller UID counts globally, creates no actor row and writes no detail row.
    g0 = global_counts()
    r = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None, claims=None)
    check("C-07 no-UID denial moves the global counter only",
          r.get("code") == "forbidden" and global_counts()[0] == g0[0] + 1)

    # Isolation: a session that is not READ COMMITTED is refused before anything else.
    rep = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), admin,
               isolation="repeatable read")
    check("I-01 a REPEATABLE READ session raises the isolation check",
          "__error__" in rep and "READ COMMITTED" in rep["__error__"], json.dumps(rep)[:300])


def test_privileges():
    rows = {
        ("authenticated", "licence_admin_grant(uuid,jsonb)"): True,
        ("authenticated", "licence_admin_extend(uuid,jsonb)"): True,
        ("authenticated", "licence_admin_revoke(uuid,jsonb)"): True,
        ("authenticated", "licence_admin_replace(uuid,jsonb)"): True,
        ("anon", "licence_admin_grant(uuid,jsonb)"): False,
        ("service_role", "licence_admin_grant(uuid,jsonb)"): False,
        ("authenticated", "licence_admin_core(text,uuid,jsonb)"): False,
        ("authenticated", "licence_admin_deny(text,text,uuid,uuid)"): False,
        ("authenticated", "licence_admin_canonical_bytes(text,uuid,uuid,bigint,boolean,text,text,text,uuid,timestamptz,timestamptz,boolean)"): False,
        ("authenticated", "licence_lock_shop(uuid,text)"): False,
        ("service_role", "licence_admin_core(text,uuid,jsonb)"): False,
        ("anon", "licence_admin_core(text,uuid,jsonb)"): False,
    }
    for (role, sig), expected in rows.items():
        got = q(f"select has_function_privilege({lit(role)}, 'public.{sig}', 'EXECUTE');")
        check(f"PR-01 {role} EXECUTE on {sig} is {expected}", got == ("t" if expected else "f"), got)
    ok, out, err = run("select count(*) from public.licence_requests;", role="authenticated",
                       claims={"sub": new_uuid(), "role": "authenticated", "aal": "aal2"})
    check("PR-02 authenticated cannot read the replay ledger (permission denied, or zero rows)",
          (not ok and "permission denied" in err) or (ok and out == "0"), f"ok={ok} out={out} err={err}")


# ---------- concurrency (two local sessions) ----------

def rpc_sql(fn, rid, pl, claims):
    text = json.dumps(pl, ensure_ascii=False)
    return (f"set role authenticated;\n"
            f"select set_config('request.jwt.claims', {lit(json.dumps(claims))}, false)\\g /dev/null\n"
            f"select public.{fn}({lit(rid)}::uuid, {lit(text)}::jsonb);\n")


def run_async_pair(a_sql, b_sql, b_delay=1.0):
    """Session A holds its transaction open for a while. Session B starts after b_delay seconds."""
    a = subprocess.Popen(base_cmd(), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    a.stdin.write(("begin;\n" + a_sql + "select pg_sleep(3);\ncommit;\n").encode("utf-8"))
    a.stdin.close()
    time.sleep(b_delay)
    b = subprocess.run(base_cmd(), input=("begin;\n" + b_sql + "commit;\n").encode("utf-8"),
                       capture_output=True)
    a_out, a_err = a.communicate(timeout=60)
    return (a.returncode, a_out.decode(), a_err.decode()), (b.returncode, b.stdout.decode(), b.stderr.decode())


def test_concurrency():
    admin = new_admin()
    shop = new_shop()
    claims = {"sub": admin, "role": "authenticated", "aal": "aal2"}
    a_sql = rpc_sql("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), claims)
    b_sql = rpc_sql("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), claims)
    a_res, b_res = run_async_pair(a_sql, b_sql)
    last = b_res[1].strip().splitlines()
    b_json = json.loads(last[-2]) if last and last[-1] == "COMMIT" else None
    if b_json is None:
        b_json = json.loads([l for l in last if l.startswith("{")][-1])
    check("CC-01 second writer waits on the shop lock, then is refused as stale",
          a_res[0] == 0 and b_res[0] == 0 and b_json.get("code") == "stale_state_version"
          and ver(shop) == 1 and ledger_for_shop(shop) == 1, f"a={a_res} b={b_res[1][-300:]} ver={ver(shop)}")

    shop1, shop2 = new_shop(), new_shop()
    shared = new_uuid()
    a_sql = rpc_sql("licence_admin_grant", shared, payload(shop1, 0, grant_kind="one_month"), claims)
    b_sql = rpc_sql("licence_admin_grant", shared, payload(shop2, 0, grant_kind="one_month"), claims)
    a_res, b_res = run_async_pair(a_sql, b_sql)
    b_lines = [l for l in b_res[1].splitlines() if l.startswith("{")]
    b_json = json.loads(b_lines[-1]) if b_lines else {"raw": b_res[2]}
    check("CC-02 the same request_id on two shops: the loser gets request_conflict via re-read, never a raw error",
          a_res[0] == 0 and b_res[0] == 0 and b_json.get("code") == "request_conflict"
          and ledger_for_shop(shop2) == 0 and ver(shop2) == 0, f"b={b_res[1][-300:]} {b_res[2][-300:]}")


# ---------- hash fields not covered above ----------

def test_hash_fields():
    admin = new_admin()
    shop = new_shop()
    add_cov(shop, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rid = new_uuid()
    accepted("H-00 extend commits with unit month", shop, "licence_admin_extend",
             payload(shop, 0, extension_unit="month"), admin, rid=rid)
    rejected("H-01 same request_id with a different extension unit is request_conflict", shop,
             "request_conflict", "licence_admin_extend", payload(shop, 1, extension_unit="year"), admin, rid=rid)

    shop2 = new_shop()
    t_a = add_cov(shop2, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    t_b = add_cov(shop2, "admin_grant", "now() + interval '20 days'", "now() + interval '30 days'")
    rid2 = new_uuid()
    accepted("H-02 revoke of the future period commits", shop2, "licence_admin_revoke",
             payload(shop2, 0, target_coverage_id=t_b), admin, rid=rid2)
    rejected("H-02 same request_id with a different target is request_conflict", shop2,
             "request_conflict", "licence_admin_revoke", payload(shop2, 1, target_coverage_id=t_a), admin, rid=rid2)

    shop3 = new_shop()
    t3 = add_cov(shop3, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rid3 = new_uuid()
    accepted("H-03 replace commits as one_month", shop3, "licence_admin_replace",
             payload(shop3, 0, target_coverage_id=t3, grant_kind="one_month"), admin, rid=rid3)
    rejected("H-03 same request_id with a different grant kind is request_conflict", shop3,
             "request_conflict", "licence_admin_replace",
             payload(shop3, 1, target_coverage_id=t3, grant_kind="one_year"), admin, rid=rid3)
    rejected("H-03 same request_id with a different reason is request_conflict", shop3,
             "request_conflict", "licence_admin_replace",
             payload(shop3, 1, target_coverage_id=t3, grant_kind="one_month", reason="Other reason"),
             admin, rid=rid3)


# ---------- provisional global cap (run last) ----------

def test_global_cap_provisional():
    """PROVISIONAL: the global detail cap of 1,000 per UTC hour is a staging and engineering default.
    The production value is OPEN. The denial-window guard only lets counts rise, so this fixture is
    not undone afterwards. It runs last, on the throwaway database."""
    actor = new_admin()
    shop = new_shop()
    denied("GC-00 a denial creates this hour's global window row", shop, "licence_admin_grant",
           payload(shop, 0, grant_kind="one_month"), actor, aal="aal1")
    # The table requires detail_count <= denial_count, so both rise together. 999 leaves room for one.
    q(f"update public.licence_denial_windows "
      f"set denial_count = greatest(denial_count, 999), detail_count = 999 "
      f"where scope = 'global' and window_start = {HOUR}; select 1;")
    a0, g0, rows0 = actor_counts(actor), global_counts(), denial_rows(actor)
    r = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None,
             claims={"sub": actor, "role": "authenticated", "aal": "aal1"})
    a1, g1, rows1 = actor_counts(actor), global_counts(), denial_rows(actor)
    check("GC-01 just below the provisional cap (999 global details) the denial writes its detail row",
          r.get("code") == "forbidden" and a1 == (a0[0] + 1, a0[1] + 1)
          and g1 == (g0[0] + 1, g0[1] + 1) and rows1 == rows0 + 1,
          f"a={a0}->{a1} g={g0}->{g1} rows={rows0}->{rows1}")
    a0, g0, rows0 = actor_counts(actor), global_counts(), denial_rows(actor)
    r = call("licence_admin_grant", new_uuid(), payload(shop, 0, grant_kind="one_month"), None,
             claims={"sub": actor, "role": "authenticated", "aal": "aal1"})
    a1, g1, rows1 = actor_counts(actor), global_counts(), denial_rows(actor)
    check("GC-02 at the provisional cap (1,000 global details) the denial is counted but writes no detail row",
          r.get("code") == "forbidden" and a1 == (a0[0] + 1, a0[1]) and g1 == (g0[0] + 1, g0[1])
          and rows1 == rows0, f"a={a0}->{a1} g={g0}->{g1} rows={rows0}->{rows1}")


# ---------- staging window (H2), configuration, future starts, tokens, JSON types, reason length ----------

def ist_at(delta):
    """IST timestamp text (microseconds) for now + delta, as a timestamp input."""
    return (datetime.datetime.now(IST) + delta).isoformat(timespec="microseconds")


def set_window(value):
    """LOCAL HARNESS ONLY. Stands in for the staging operator. None removes the row (no window)."""
    if value is None:
        q("delete from public.licence_config where key = 'staging_backdate_window_days'; select 1;")
    else:
        q("insert into public.licence_config (key, value) values ('staging_backdate_window_days', "
          f"{lit(value)}) on conflict (key) do update set value = excluded.value; select 1;")


def test_backdate_window():
    admin = new_admin()
    day31 = datetime.timedelta(days=31)
    hour = datetime.timedelta(hours=1)
    try:
        set_window("31")
        s1 = new_shop()
        accepted("BW-01 a backdate of 31 days minus one hour (inside the window) is accepted", s1,
                 "licence_admin_grant",
                 payload(s1, 0, grant_kind="one_month", start=ist_at(-(day31 - hour)), backdate_confirm=True),
                 admin)
        s2 = new_shop()
        rejected("BW-02 a backdate of 31 days plus one hour (outside the window) is backdate_window_exceeded",
                 s2, "backdate_window_exceeded", "licence_admin_grant",
                 payload(s2, 0, grant_kind="one_month", start=ist_at(-(day31 + hour)), backdate_confirm=True),
                 admin)
        s3 = new_shop()
        t3 = add_cov(s3, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
        rejected("BW-03 replace is held to the same window", s3, "backdate_window_exceeded",
                 "licence_admin_replace",
                 payload(s3, 0, target_coverage_id=t3, grant_kind="one_month",
                         start=ist_at(-(day31 + hour)), backdate_confirm=True), admin)
        set_window("2")
        s4 = new_shop()
        rejected("BW-04 the window is read from licence_config: 2 days refuses a 3-day backdate", s4,
                 "backdate_window_exceeded", "licence_admin_grant",
                 payload(s4, 0, grant_kind="one_month", start=ist_at(-datetime.timedelta(days=3)),
                         backdate_confirm=True), admin)
        set_window(None)
        s5 = new_shop()
        # Fail closed (2026-11-08): with no row (production state, decision 5 OPEN) no window is
        # configured, so every backdate is refused with the existing window code. Nothing is written.
        rejected("BW-05 with no row (production state, OPEN) every backdate fails closed: a 31-day-plus-one-hour backdate is backdate_window_exceeded",
                 s5, "backdate_window_exceeded", "licence_admin_grant",
                 payload(s5, 0, grant_kind="one_month", start=ist_at(-(day31 + hour)), backdate_confirm=True),
                 admin)
        set_window("0")
        s6 = new_shop()
        r = call("licence_admin_grant", new_uuid(),
                 payload(s6, 0, grant_kind="one_month", start=ist_at(-hour), backdate_confirm=True), admin)
        check("BW-06 a non-positive configured window raises (fails closed)",
              "__error__" in r and "must be a positive integer" in r["__error__"], json.dumps(r)[:200])
    finally:
        set_window("31")


def test_config_and_inputs_cannot_set_window():
    admin = new_admin()
    shop = new_shop()
    claims = {"sub": admin, "role": "authenticated", "aal": "aal2"}
    for role, cl in (("authenticated", claims), ("anon", None), ("service_role", None)):
        ok, out, err = run("select * from public.licence_config;", role=role, claims=cl)
        check(f"CFG-01 {role} cannot read licence_config", (not ok) and "permission denied" in err, out + err)
        ok, out, err = run("insert into public.licence_config (key, value) values ('x', '1');",
                           role=role, claims=cl)
        check(f"CFG-01 {role} cannot write licence_config", (not ok) and "permission denied" in err, out + err)
    rejected("CFG-02 a window field in the payload is an unknown field", shop, "unknown_field",
             "licence_admin_grant",
             {**payload(shop, 0, grant_kind="one_month"), "staging_backdate_window_days": 9999}, admin)

    set_window("31")
    s3 = new_shop()
    rid = new_uuid()
    pl = payload(s3, 0, grant_kind="one_month", start=ist_at(-datetime.timedelta(days=40)), backdate_confirm=True)
    sql = ("select set_config('app.staging_backdate_window_days', '9999', false)\\g /dev/null\n"
           f"select public.licence_admin_grant({lit(rid)}::uuid, {lit(json.dumps(pl))}::jsonb);")
    ok, out, err = run(sql, role="authenticated", claims=claims)
    got = json.loads(out.splitlines()[-1]) if ok and out else {"__error__": err}
    check("CFG-03 a client-settable GUC does not widen the window (40-day backdate is still refused)",
          got.get("code") == "backdate_window_exceeded", json.dumps(got)[:200])


def test_future_calendar_grants():
    admin = new_admin()
    five = datetime.timedelta(days=5)
    s1 = new_shop()
    rejected("GF-01 grant one_month with a future start is future_start_not_allowed", s1,
             "future_start_not_allowed", "licence_admin_grant",
             payload(s1, 0, grant_kind="one_month", start=ist_at(five)), admin)
    s2 = new_shop()
    rejected("GF-02 grant one_year with a future start is future_start_not_allowed", s2,
             "future_start_not_allowed", "licence_admin_grant",
             payload(s2, 0, grant_kind="one_year", start=ist_at(five)), admin)
    s3 = new_shop()
    t3 = add_cov(s3, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    rejected("GF-03 replace to one_month with a future start is future_start_not_allowed", s3,
             "future_start_not_allowed", "licence_admin_replace",
             payload(s3, 0, target_coverage_id=t3, grant_kind="one_month", start=ist_at(five)), admin)
    rejected("GF-03 replace to one_year with a future start is future_start_not_allowed", s3,
             "future_start_not_allowed", "licence_admin_replace",
             payload(s3, 0, target_coverage_id=t3, grant_kind="one_year", start=ist_at(five)), admin)
    check("GF-03 the target stays active after the refused replacements", cov_field(t3, "revoked_at is null") == "t")
    s4 = new_shop()
    accepted("GF-04 lifetime with a future start is accepted (future scheduling approved for lifetime)", s4,
             "licence_admin_grant", payload(s4, 0, grant_kind="lifetime", start=ist_at(five)), admin)
    check("GF-04 the scheduled lifetime period is SCHEDULED",
          q(f"select state from public.shop_licence_state({lit(s4)}::uuid, now());") == "SCHEDULED")
    s5 = new_shop()
    t5 = add_cov(s5, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    accepted("GF-05 replace to custom with a future start is accepted (future scheduling approved for custom)",
             s5, "licence_admin_replace",
             payload(s5, 0, target_coverage_id=t5, grant_kind="custom",
                     start=ist_at(datetime.timedelta(days=20)), end=ist_at(datetime.timedelta(days=30))), admin)


def test_enumerated_tokens_exact():
    admin = new_admin()
    for label, kind in [("space-padded", " one_month "), ("trailing tab", "one_month\t"),
                        ("NBSP-padded", "one_month "), ("wrong case", "One_Month"), ("empty", "")]:
        s = new_shop()
        rejected(f"S1-01 grant_kind {label} is refused (exact token after NFC, no trim)", s,
                 "invalid_grant_kind", "licence_admin_grant", payload(s, 0, grant_kind=kind), admin)
    for label, unit in [("space-padded", " month"), ("NBSP-padded", "month "), ("wrong case", "Month")]:
        s = new_shop()
        rejected(f"S1-02 extension_unit {label} is refused", s, "invalid_extension_unit",
                 "licence_admin_extend", payload(s, 0, extension_unit=unit), admin)
    s = new_shop()
    rejected("S1-03 a padded grant_kind on replace is refused", s, "invalid_grant_kind",
             "licence_admin_replace",
             payload(s, 0, target_coverage_id=new_uuid(), grant_kind=" one_year "), admin)


def test_numeric_notation():
    admin = new_admin()
    s = new_shop()
    base = json.dumps(payload(s, 0, grant_kind="one_month"))
    as_1e3 = base.replace('"expected_state_version": 0', '"expected_state_version": 1e3')
    rejected("L1-01 expected_state_version written 1e3 is read as 1000: integer, accepted, stale against 0",
             s, "stale_state_version", "licence_admin_grant", as_1e3, admin)
    as_5_0 = base.replace('"expected_state_version": 0', '"expected_state_version": 5.0')
    rejected("L1-02 expected_state_version written 5.0 is invalid_request", s, "invalid_request",
             "licence_admin_grant", as_5_0, admin)


def test_invalid_json_types():
    admin = new_admin()
    cases = [
        ("shop_id as a number", {"shop_id": 123}, "invalid_request"),
        ("shop_id not a UUID", {"shop_id": "not-a-uuid"}, "invalid_request"),
        ("expected_state_version as a string", {"expected_state_version": "0"}, "invalid_request"),
        ("expected_state_version negative", {"expected_state_version": -1}, "invalid_request"),
        ("confirm as the string true", {"confirm": "true"}, "invalid_request"),
        ("confirm null", {"confirm": None}, "invalid_request"),
        ("reason as a number", {"reason": 5}, "invalid_reason"),
        ("reason null", {"reason": None}, "invalid_reason"),
        ("grant_kind as a number", {"grant_kind": 5}, "invalid_grant_kind"),
        ("backdate_confirm as a string", {"backdate_confirm": "yes"}, "invalid_request"),
        ("start as a number", {"start": 5}, "invalid_timestamp"),
    ]
    for label, override, code in cases:
        s = new_shop()
        pl = {**payload(s, 0, grant_kind="one_month"), **override}
        rejected(f"IJ-01 {label} is {code}", s, code, "licence_admin_grant", pl, admin)
    s = new_shop()
    rejected("IJ-02 a payload that is a JSON array is invalid_request", s, "invalid_request",
             "licence_admin_grant", "[]", admin)
    rejected("IJ-02 a payload that is JSON null is invalid_request", s, "invalid_request",
             "licence_admin_grant", "null", admin)
    s2 = new_shop()
    accepted("IJ-03 start written as JSON null is treated as not supplied (starts now)", s2,
             "licence_admin_grant", payload(s2, 0, grant_kind="one_month", start=None), admin)
    sql = (f"select public.licence_admin_grant(null::uuid, "
           f"{lit(json.dumps(payload(s2, 1, grant_kind='one_month')))}::jsonb);")
    ok, out, err = run(sql, role="authenticated", claims={"sub": admin, "role": "authenticated", "aal": "aal2"})
    got = json.loads(out.splitlines()[-1]) if ok and out else {"__error__": err}
    check("IJ-04 a null request_id is invalid_request", got.get("code") == "invalid_request", json.dumps(got)[:200])


def test_reason_length_boundaries():
    admin = new_admin()
    cases = [
        ("of one character is accepted", "x", True),
        ("of 500 code points after trimming is accepted", " " + "x" * 500 + " ", True),
        ("of 300 letters given as NFD (600 code points) is accepted: length is counted after NFC",
         "é" * 300, True),
        ("of 501 letters given as NFD is refused: 501 after NFC", "é" * 501, False),
    ]
    for label, reason, ok_expected in cases:
        s = new_shop()
        pl = payload(s, 0, grant_kind="one_month", reason=reason)
        if ok_expected:
            accepted(f"RB-01 reason {label}", s, "licence_admin_grant", pl, admin)
        else:
            rejected(f"RB-01 reason {label}", s, "invalid_reason", "licence_admin_grant", pl, admin)


# ---------- boundaries, calendar, revoked overlap, atomicity, re-read, status, privileges, guards ----------

def state_at(shop, ts_sql):
    return q(f"select state from public.shop_licence_state({lit(shop)}::uuid, {ts_sql});")


def test_half_open_boundaries():
    admin = new_admin()
    us = "interval '1 microsecond'"
    start = "'2030-05-01T00:00:00+05:30'::timestamptz"
    end = "'2030-06-01T00:00:00+05:30'::timestamptz"
    s = new_shop()
    add_cov(s, "admin_grant", start, end)
    check("HB-01 at the exact end the period is no longer active (EXPIRED)",
          state_at(s, end) == "EXPIRED", state_at(s, end))
    check("HB-01 one microsecond before the end it is still ACTIVE",
          state_at(s, f"{end} - {us}") == "ACTIVE", state_at(s, f"{end} - {us}"))
    check("HB-02 at the exact start it is ACTIVE", state_at(s, start) == "ACTIVE", state_at(s, start))
    check("HB-02 one microsecond before the start it is SCHEDULED",
          state_at(s, f"{start} - {us}") == "SCHEDULED", state_at(s, f"{start} - {us}"))
    accepted("HB-03 a custom grant starting exactly at the existing end is accepted", s,
             "licence_admin_grant",
             payload(s, ver(s), grant_kind="custom",
                     start="2030-06-01T00:00:00+05:30", end="2030-07-01T00:00:00+05:30"), admin)
    s2 = new_shop()
    add_cov(s2, "admin_grant", start, end)
    accepted("HB-03 a custom grant ending exactly at the existing start is accepted", s2,
             "licence_admin_grant",
             payload(s2, ver(s2), grant_kind="custom",
                     start="2030-04-01T00:00:00+05:30", end="2030-05-01T00:00:00+05:30"), admin)

    s3 = new_shop()
    c3 = add_cov(s3, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    accepted("HB-04 revoke succeeds", s3, "licence_admin_revoke",
             payload(s3, 0, target_coverage_id=c3), admin)
    check("HB-04 at the exact revocation instant the period is REVOKED, not active",
          q(f"select (select state from public.shop_licence_state({lit(s3)}::uuid, r.revoked_at)) = 'REVOKED' "
            f"from public.licence_coverages r where r.id = {lit(c3)}::uuid;") == "t")
    check("HB-04 one microsecond before the revocation the period was still ACTIVE",
          q(f"select (select state from public.shop_licence_state({lit(s3)}::uuid, "
            f"r.revoked_at - interval '1 microsecond')) = 'ACTIVE' "
            f"from public.licence_coverages r where r.id = {lit(c3)}::uuid;") == "t")

    s4 = new_shop()
    c4 = add_cov(s4, "admin_grant", "now() - interval '1 day'", "now() + interval '1 hour'")
    accepted("HB-05 revoking one hour before the natural end is accepted", s4, "licence_admin_revoke",
             payload(s4, 0, target_coverage_id=c4), admin)
    s5 = new_shop()
    c5 = add_cov(s5, "admin_grant", "now() - interval '1 day'", "now() - interval '1 microsecond'")
    rejected("HB-05 revoking one microsecond after the natural end is natural_end_passed", s5,
             "natural_end_passed", "licence_admin_revoke", payload(s5, 0, target_coverage_id=c5), admin)


def test_calendar_and_extend():
    admin = new_admin()
    s = new_shop()
    add_cov(s, "admin_grant", "now() - interval '10 days'", "now() - interval '1 day'")
    check("EX-01 an ended admin grant with nothing later is EXPIRED", state_at(s, "now()") == "EXPIRED",
          state_at(s, "now()"))
    r = accepted("X-03 extend after natural expiry is accepted", s, "licence_admin_extend",
                 payload(s, 0, extension_unit="month"), admin)
    check("X-03 the extension starts now (within five minutes), not in the past, and ends one IST month later",
          cov_field(r.get("coverage_id"),
                    "abs(extract(epoch from (starts_at - now()))) < 300 and ends_at = "
                    "((starts_at at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata'")
          == "t")
    cases = [
        ("2027-01-31T15:00:00+05:30", "month", "2027-02-28T15:00:00+05:30"),
        ("2028-01-31T15:00:00+05:30", "month", "2028-02-29T15:00:00+05:30"),
        ("2028-02-29T10:00:00+05:30", "year", "2029-02-28T10:00:00+05:30"),
        ("2027-03-31T00:00:00+05:30", "month", "2027-04-30T00:00:00+05:30"),
        ("2027-01-31T23:00:00Z", "month", "2027-02-28T23:00:00Z"),
    ]
    for start, unit, expected in cases:
        got = q(f"select public.licence_calendar_end({lit(start)}::timestamptz, {lit(unit)}) "
                f"= {lit(expected)}::timestamptz;")
        check(f"MC-01 licence_calendar_end({start}, {unit}) is {expected}", got == "t", got)


def test_revoked_overlap():
    admin = new_admin()
    s = new_shop()
    c = add_cov(s, "admin_grant", "now() - interval '5 days'", "now() + interval '20 days'")
    accepted("RC-01 setup: revoke the long period", s, "licence_admin_revoke",
             payload(s, 0, target_coverage_id=c), admin)
    accepted("RC-01 a same-kind custom grant overlapping the revoked period's stored dates is accepted", s,
             "licence_admin_grant",
             payload(s, ver(s), grant_kind="custom", start=ist_at(datetime.timedelta(days=1)),
                     end=ist_at(datetime.timedelta(days=2))), admin)
    s2 = new_shop()
    c2 = add_cov(s2, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    accepted("RC-02 setup: revoke the first coverage", s2, "licence_admin_revoke",
             payload(s2, 0, target_coverage_id=c2), admin)
    add_cov(s2, "admin_grant", "now() + interval '5 days'", "now() + interval '15 days'")
    rejected("RC-02 a non-revoked same-kind coverage still blocks an overlapping grant", s2, "overlap",
             "licence_admin_grant",
             payload(s2, ver(s2), grant_kind="custom", start=ist_at(datetime.timedelta(days=6)),
                     end=ist_at(datetime.timedelta(days=7))), admin)


def test_replace_atomicity():
    admin = new_admin()
    s = new_shop()
    target = add_cov(s, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    before = snap(s)
    q("create or replace function public.test_fail_cov() returns trigger language plpgsql as $$ "
      "begin if new.reason = 'FAIL-INJECT' then raise exception 'injected replace failure'; end if; "
      "return new; end; $$;\n"
      "drop trigger if exists test_fail_cov on public.licence_coverages;\n"
      "create trigger test_fail_cov before insert on public.licence_coverages for each row "
      "execute function public.test_fail_cov();\n select 1;")
    try:
        r = call("licence_admin_replace", new_uuid(),
                 payload(s, 0, target_coverage_id=target, grant_kind="one_month", reason="FAIL-INJECT"), admin)
    finally:
        q("drop trigger if exists test_fail_cov on public.licence_coverages; select 1;")
    check("RA-01 an injected failure after the revoke step raises",
          "__error__" in r and "injected replace failure" in r["__error__"], json.dumps(r)[:300])
    check("RA-01 the target is still active", cov_field(target, "revoked_at is null") == "t")
    check("RA-01 no version step, ledger, audit or coverage row was written", snap(s) == before,
          f"{snap(s)} vs {before}")

    s2 = new_shop()
    t2 = add_cov(s2, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    r2 = accepted("RA-02 replace succeeds", s2, "licence_admin_replace",
                  payload(s2, 0, target_coverage_id=t2, grant_kind="one_month"), admin)
    check("RA-02 exactly two audit rows, both action 'replace': the revocation (before and after) and the new coverage",
          q(f"select count(*) = 2 "
            f"and count(*) filter (where action = 'replace' and coverage_id = {lit(t2)}::uuid "
            f"and before_state is not null and after_state is not null) = 1 "
            f"and count(*) filter (where action = 'replace' and coverage_id = {lit(r2.get('coverage_id'))}::uuid "
            f"and before_state is null and after_state is not null) = 1 "
            f"and count(*) filter (where action = 'revoke') = 0 "
            f"from public.licence_audit_log where shop_id = {lit(s2)}::uuid;") == "t")


def test_conflict_reread_empty():
    admin = new_admin()
    s = new_shop()
    before = snap(s)
    q("create or replace function public.test_skip_ledger() returns trigger language plpgsql as $$ "
      "begin return null; end; $$;\n"
      "drop trigger if exists test_skip_ledger on public.licence_requests;\n"
      "create trigger test_skip_ledger before insert on public.licence_requests for each row "
      "execute function public.test_skip_ledger();\n select 1;")
    try:
        r = call("licence_admin_grant", new_uuid(), payload(s, 0, grant_kind="one_month"), admin)
    finally:
        q("drop trigger if exists test_skip_ledger on public.licence_requests; select 1;")
    check("CR-01 when the insert reports no row and the re-read finds none, the call raises and writes nothing",
          "__error__" in r and "could not be re-read" in r["__error__"] and snap(s) == before,
          json.dumps(r)[:300])


def call_status(shop, user, role="authenticated", claims="auto"):
    if claims == "auto":
        claims = {"sub": user, "role": "authenticated"} if user else None
    ok, out, err = run(f"select public.shop_licence_status({lit(shop)}::uuid);", role=role, claims=claims)
    if not ok:
        return {"__error__": err}
    return json.loads(out.splitlines()[-1])


def add_member(shop, user, role):
    q(f"insert into auth.users (id) values ({lit(user)}) on conflict do nothing; "
      f"insert into public.shop_memberships (shop_id, user_id, role) "
      f"values ({lit(shop)}, {lit(user)}, {lit(role)}); select 1;")


def test_shop_licence_status():
    admin = new_admin()
    owner, staff, outsider = new_uuid(), new_uuid(), new_uuid()
    q(f"insert into auth.users (id) values ({lit(owner)}), ({lit(staff)}), ({lit(outsider)}); select 1;")
    s = new_shop()
    add_member(s, owner, "owner")
    add_member(s, staff, "staff")
    add_cov(s, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    r = call_status(s, owner)
    check("SL-01 owner gets active, an access end and no next start",
          r.get("ok") is True and r.get("active") is True and r.get("no_expiry") is False
          and r.get("access_end") is not None and r.get("next_start") is None, json.dumps(r))
    check("SL-02 the response has exactly the decision D keys",
          set(r.keys()) == {"ok", "active", "no_expiry", "access_end", "next_start"}, str(sorted(r.keys())))
    check("SL-03 staff are denied with no fields", call_status(s, staff) == {"ok": False, "code": "forbidden"})
    check("SL-04 a non-member is denied", call_status(s, outsider) == {"ok": False, "code": "forbidden"})
    check("SL-04 a non-member asking about an unknown shop is denied",
          call_status(new_uuid(), outsider) == {"ok": False, "code": "forbidden"})
    for role in ("anon", "service_role"):
        r = call_status(s, None, role=role, claims=None)
        check(f"SL-05 {role} has no EXECUTE on shop_licence_status",
              "__error__" in r and "permission denied" in r["__error__"], json.dumps(r)[:200])

    s2 = new_shop()
    add_member(s2, owner, "owner")
    add_cov(s2, "lifetime_grant", "now() - interval '1 day'", None)
    r2 = call_status(s2, owner)
    check("SL-06 lifetime: active, no expiry, no access end",
          r2.get("active") is True and r2.get("no_expiry") is True and r2.get("access_end") is None, json.dumps(r2))

    s3 = new_shop()
    add_member(s3, owner, "owner")
    add_cov(s3, "admin_grant", "now() + interval '2 days'", "now() + interval '30 days'")
    r3 = call_status(s3, owner)
    check("SL-07 SCHEDULED: inactive, next start shown, no access end",
          r3.get("active") is False and r3.get("next_start") is not None and r3.get("access_end") is None,
          json.dumps(r3))

    inactive = {"ok": True, "active": False, "no_expiry": False, "access_end": None, "next_start": None}
    s4 = new_shop()
    add_member(s4, owner, "owner")
    add_cov(s4, "admin_grant", "now() - interval '10 days'", "now() - interval '1 day'")
    r4 = call_status(s4, owner)
    check("SL-08 EXPIRED: the inactive shape with no next start", r4 == inactive, json.dumps(r4))
    check("SL-08 the state is EXPIRED", state_at(s4, "now()") == "EXPIRED")

    s5 = new_shop()
    add_member(s5, owner, "owner")
    c5 = add_cov(s5, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    accepted("SL-09 setup: revoke the period", s5, "licence_admin_revoke",
             payload(s5, 0, target_coverage_id=c5), admin)
    r5 = call_status(s5, owner)
    check("SL-09 REVOKED has the same shape as EXPIRED (the two are not distinguished)", r5 == inactive,
          json.dumps(r5))
    check("SL-09 the state is REVOKED", state_at(s5, "now()") == "REVOKED")

    privileges = {}
    for sig in ("licence_admin_grant(uuid,jsonb)", "licence_admin_extend(uuid,jsonb)",
                "licence_admin_revoke(uuid,jsonb)", "licence_admin_replace(uuid,jsonb)",
                "shop_licence_status(uuid)"):
        privileges[sig] = {role: q(f"select has_function_privilege({lit(role)}, 'public.{sig}', 'EXECUTE');")
                           for role in ("anon", "service_role")}
    for sig, got in privileges.items():
        for role, value in got.items():
            check(f"PR-03 {role} has no EXECUTE on {sig}", value == "f", value)
    check("PR-03 authenticated has EXECUTE on shop_licence_status",
          q("select has_function_privilege('authenticated', 'public.shop_licence_status(uuid)', 'EXECUTE');") == "t")


def test_execute_denied_by_privilege():
    s = new_shop()
    calls = [
        f"select public.licence_admin_grant({lit(new_uuid())}::uuid, '{{}}'::jsonb);",
        f"select public.licence_admin_replace({lit(new_uuid())}::uuid, '{{}}'::jsonb);",
        f"select public.licence_admin_extend({lit(new_uuid())}::uuid, '{{}}'::jsonb);",
        f"select public.licence_admin_revoke({lit(new_uuid())}::uuid, '{{}}'::jsonb);",
        f"select public.shop_licence_status({lit(s)}::uuid);",
    ]
    for role in ("anon", "service_role"):
        for sql in calls:
            name = sql.split("(")[0].replace("select ", "")
            ok, out, err = run(sql, role=role)
            check(f"PR-04 {role} calling {name} is refused by privilege", (not ok) and "permission denied" in err,
                  err[:200])


def sql_fails(label, sql, needle):
    """Superuser statement that the 0015 guard must refuse. The refusal text must contain needle."""
    ok, out, err = run(sql)
    check(label, (not ok) and needle in err, (out + err)[:300])


def test_guard_protections():
    admin = new_admin()
    s = new_shop()
    cid = add_cov(s, "admin_grant", "now() - interval '1 day'", "now() + interval '10 days'")
    sql_fails("GD-01 a coverage start cannot be changed",
              f"update public.licence_coverages set starts_at = starts_at - interval '1 day' "
              f"where id = {lit(cid)}::uuid;", "the only permitted update sets revoked_at")
    sql_fails("GD-02 a coverage cannot be deleted",
              f"delete from public.licence_coverages where id = {lit(cid)}::uuid;", "append-only")
    sql_fails("GD-03 a coverage cannot be inserted already revoked",
              "insert into public.licence_coverages (id, shop_id, kind, starts_at, ends_at, reason, created_by, "
              f"request_id, revoked_at, revoked_by, revoke_reason) values (gen_random_uuid(), {lit(s)}::uuid, "
              "'admin_grant', now(), now() + interval '10 days', 'x', "
              f"{lit(new_uuid())}::uuid, {lit(new_uuid())}::uuid, now(), {lit(new_uuid())}::uuid, 'x');",
              "already revoked")
    s4 = new_shop()
    c4 = add_cov(s4, "admin_grant", "now() - interval '1 day'", "now()")
    sql_fails("GD-04 a revocation at or after the natural end is refused by the guard",
              f"update public.licence_coverages set revoked_at = clock_timestamp(), "
              f"revoked_by = {lit(admin)}::uuid, revoke_reason = 'x' where id = {lit(c4)}::uuid;",
              "at or after its natural end")
    sql_fails("GD-05 the state version must increase by exactly one",
              f"update public.shop_licence_meta set state_version = state_version + 2 "
              f"where shop_id = {lit(s)}::uuid;", "must increase by exactly 1")
    sql_fails("GD-06 the meta row cannot be deleted",
              f"delete from public.shop_licence_meta where shop_id = {lit(s)}::uuid;", "not deletable")
    sql_fails("GD-07 the meta shop_id cannot change",
              f"update public.shop_licence_meta set shop_id = gen_random_uuid() where shop_id = {lit(s)}::uuid;",
              "shop_id cannot change")

    s6 = new_shop()
    accepted("GD setup: a lifetime grant writes one ledger row and one audit row", s6,
             "licence_admin_grant", payload(s6, 0, grant_kind="lifetime"), admin)
    denied("GD setup: one denial writes a detail row", s6, "licence_admin_grant",
           payload(s6, 0, grant_kind="one_month"), new_admin(), aal="aal1")
    sql_fails("GD-08 ledger rows cannot be updated",
              f"update public.licence_requests set action = 'x' where shop_id = {lit(s6)}::uuid;", "append-only")
    sql_fails("GD-08 ledger rows cannot be deleted",
              f"delete from public.licence_requests where shop_id = {lit(s6)}::uuid;", "append-only")
    sql_fails("GD-09 audit rows cannot be updated",
              f"update public.licence_audit_log set reason = 'x' where shop_id = {lit(s6)}::uuid;", "append-only")
    sql_fails("GD-09 audit rows cannot be deleted",
              f"delete from public.licence_audit_log where shop_id = {lit(s6)}::uuid;", "append-only")
    sql_fails("GD-10 denial detail rows cannot be deleted", "delete from public.licence_denials;", "append-only")
    sql_fails("GD-11 denial counts cannot decrease",
              "update public.licence_denial_windows set denial_count = denial_count - 1 where scope = 'global';",
              "cannot decrease")
    sql_fails("GD-12 the audit log cannot be truncated (rolled back if refused)",
              "begin;\ntruncate public.licence_audit_log;\nrollback;", "append-only")


def test_concurrent_denial_counters():
    actor = new_admin()
    s = new_shop()
    a0, g0 = actor_counts(actor), global_counts()
    claims = {"sub": actor, "role": "authenticated", "aal": "aal1"}
    a_sql = rpc_sql("licence_admin_grant", new_uuid(), payload(s, 0, grant_kind="one_month"), claims)
    b_sql = rpc_sql("licence_admin_grant", new_uuid(), payload(s, 0, grant_kind="one_month"), claims)
    a_res, b_res = run_async_pair(a_sql, b_sql)
    a1, g1 = actor_counts(actor), global_counts()
    check("CD-01 two concurrent denials for one actor both count: actor denial +2, detail +2, global +2",
          a_res[0] == 0 and b_res[0] == 0 and a1 == (a0[0] + 2, a0[1] + 2) and g1 == (g0[0] + 2, g0[1] + 2),
          f"a={a0}->{a1} g={g0}->{g1} b={b_res[1][-200:]} {b_res[2][-200:]}")


def test_confirm_before_replay():
    admin = new_admin()
    s = new_shop()
    rid = new_uuid()
    accepted("H1-00 setup: a confirmed grant commits under this request_id", s, "licence_admin_grant",
             payload(s, 0, grant_kind="one_month"), admin, rid=rid)
    rejected("H1-01 confirm=false on an existing request_id is not_confirmed (checked before replay; no ledger row)",
             s, "not_confirmed", "licence_admin_grant",
             payload(s, 0, grant_kind="one_month", confirm=False), admin, rid=rid)


# ---------- main ----------

def main():
    require_fresh_database()
    tests = [
        test_grant_success, test_grant_rejections, test_grant_overlap, test_extend,
        test_revoke, test_replace, test_authorisation, test_replay_and_conflicts,
        test_hash_fields, test_privileges, test_concurrency,
        # Counter caps and injected counter failures change global state for this hour. Keep them last.
        test_backdate_window, test_config_and_inputs_cannot_set_window,
        test_future_calendar_grants, test_enumerated_tokens_exact, test_numeric_notation,
        test_invalid_json_types, test_reason_length_boundaries,
        test_half_open_boundaries, test_calendar_and_extend, test_revoked_overlap,
        test_replace_atomicity, test_conflict_reread_empty, test_shop_licence_status,
        test_execute_denied_by_privilege, test_guard_protections, test_concurrent_denial_counters,
        test_confirm_before_replay,
        test_counters, test_global_cap_provisional,
    ]
    for t in tests:
        print(f"--- {t.__name__}")
        try:
            t()
        except Exception as exc:  # a harness or setup error counts as a failure, never a pass
            check(f"{t.__name__} raised {type(exc).__name__}", False, str(exc)[:500])
    failed = [n for n, ok in RESULTS if not ok]
    print(f"SUMMARY: {len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print("  FAILED:", n)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
