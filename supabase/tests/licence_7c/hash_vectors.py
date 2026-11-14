#!/usr/bin/env python3
"""Byte-exact replay-hash vectors for QRquick Stage 7C (STAGE7 section 12A.17 A).

LOCAL THROWAWAY DATABASE ONLY (stage7c_local). Never run against Supabase or any hosted project.

The encoder here is an independent reference written from the specification, not a copy of the SQL.
Python normalises raw inputs: free text is NFC then space-only trimming; enumerated tokens are NFC
only and never trimmed (S1); date-only input is 00:00 Asia/Kolkata; timestamps become microseconds
since 1970-01-01T00:00:00Z. The same inputs go through the SQL helpers in the local database, and
the bytes must match.

hash_vectors.json is a PINNED ORACLE. A normal run never writes it. It fails if the reference
encoder no longer reproduces the pinned inputs, bytes and digests, and it checks the SQL output
against the pinned values. Regeneration happens only with the explicit --update flag.

Usage (local throwaway database only):
  python3 hash_vectors.py                 normal run: compare with the pinned file, no writes
  python3 hash_vectors.py --update        explicit regeneration of the pinned file, then the same checks
Options: --db (must be stage7c_local), --socket, --port, --pinned.
Exit status 0 means every check passed.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
import uuid

DOMAIN = "qrquick-licence-request-v1"
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
EPOCH = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
PINNED_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hash_vectors.json")

UID = "11111111-1111-4111-8111-111111111111"
SHOP = "22222222-2222-4222-8222-222222222222"
TARGET = "33333333-3333-4333-8333-333333333333"

GRANT_KINDS = ("one_month", "one_year", "custom", "lifetime")
EXTENSION_UNITS = ("month", "year")


# ---------- reference normalisation (A.5) ----------

def norm_text(raw):
    """Free text: NFC, then remove U+0020 at both ends. Nothing else is trimmed."""
    return unicodedata.normalize("NFC", raw).strip(" ")


def norm_enum(raw):
    """Enumerated tokens: NFC only. Never trimmed. The result must equal an allowed token exactly (S1)."""
    return unicodedata.normalize("NFC", raw)


def parse_instant(raw):
    """Date-only or offset timestamp to an aware datetime. None when not accepted (A.5)."""
    if raw is None:
        return None
    if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", raw):
        try:
            d = datetime.date.fromisoformat(raw)
        except ValueError:
            return None
        return datetime.datetime(d.year, d.month, d.day, tzinfo=IST)
    m = re.fullmatch(
        r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})"
        r"(?::([0-9]{2})(?:\.([0-9]{1,6}))?)?(Z|[+-][0-9]{2}:[0-9]{2})",
        raw,
    )
    if not m:
        return None
    year, month, day, hh, mm, ss, frac, zone = m.groups()
    if zone == "Z":
        tz = datetime.timezone.utc
    else:
        sign = 1 if zone[0] == "+" else -1
        oh, om = int(zone[1:3]), int(zone[4:6])
        if oh > 23 or om > 59:
            return None
        tz = datetime.timezone(sign * datetime.timedelta(hours=oh, minutes=om))
    micro = int((frac or "0").ljust(6, "0"))
    try:
        return datetime.datetime(
            int(year), int(month), int(day), int(hh), int(mm), int(ss or 0), micro, tzinfo=tz
        )
    except ValueError:
        return None


# ---------- reference encoder (A.6) ----------

def field(tag, value):
    return bytes([tag]) + len(value).to_bytes(4, "big") + value


def f_null():
    return field(0x00, b"")


def f_bool(v):
    if v is None:
        return f_null()
    return field(0x01, b"\x01" if v else b"\x00")


def f_int(v):
    if v is None:
        return f_null()
    return field(0x02, str(v).encode("ascii"))


def f_text(s):
    if s is None:
        return f_null()
    return field(0x03, s.encode("utf-8"))


def f_uuid(u):
    if u is None:
        return f_null()
    return field(0x04, uuid.UUID(u).bytes)


def f_ts(dt):
    if dt is None:
        return f_null()
    delta = dt - EPOCH
    micros = (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds
    return field(0x05, micros.to_bytes(8, "big", signed=True))


def canonical(action, uid, shop, expected, confirm, reason, kind=None, unit=None,
              target=None, start=None, end=None, backdate=None):
    """Normalised inputs in, canonical bytes out. request_id is not an input (A.2)."""
    out = (f_text(DOMAIN) + f_uuid(uid) + f_uuid(shop) + f_text(action)
           + f_int(expected) + f_bool(confirm) + f_text(reason))
    if action == "grant":
        out += f_text(kind) + f_ts(start) + f_ts(end) + f_bool(backdate)
    elif action == "extend":
        out += f_text(unit)
    elif action == "revoke":
        out += f_uuid(target)
    elif action == "replace":
        out += f_uuid(target) + f_text(kind) + f_ts(start) + f_ts(end) + f_bool(backdate)
    else:
        raise ValueError(action)
    return out


# ---------- vectors: raw inputs, expected bytes from the reference encoder ----------

def vector(name, group, action, **raw):
    """raw keys: uid, shop, expected, confirm, reason, kind, unit, target, start, end, backdate.
    Free text is normalised here (NFC and space trim). Enumerated tokens are NFC only. Instants are
    raw strings, parsed here. The JSON keeps the raw inputs and the normalised enumerated tokens,
    so the SQL run receives exactly what the reference encodes."""
    uid = raw.get("uid", UID)
    shop = raw.get("shop", SHOP)
    expected = raw.get("expected", 0)
    confirm = raw.get("confirm", True)
    reason = norm_text(raw["reason"]) if raw.get("reason") is not None else None
    kind = norm_enum(raw["kind"]) if raw.get("kind") is not None else None
    unit = norm_enum(raw["unit"]) if raw.get("unit") is not None else None
    target = raw.get("target")
    start = parse_instant(raw.get("start"))
    end = parse_instant(raw.get("end"))
    backdate = raw.get("backdate")
    data = canonical(action, uid, shop, expected, confirm, reason, kind, unit,
                     target, start, end, backdate)
    return {
        "name": name,
        "group": group,
        "action": action,
        "raw": {"uid": uid, "shop": shop, "expected": expected, "confirm": confirm,
                "reason": raw.get("reason"), "kind": raw.get("kind"), "unit": raw.get("unit"),
                "target": target, "start": raw.get("start"), "end": raw.get("end"),
                "backdate": backdate},
        "normalised": {"kind": kind, "unit": unit},
        "expected_bytes_hex": data.hex(),
        "expected_sha256_hex": hashlib.sha256(data).hexdigest(),
    }


VECTORS = [
    vector("grant_one_month_defaults", "G1", "grant", kind="one_month",
           reason="Complimentary grant", expected=0),
    vector("grant_one_month_backdate_false", "G3-differs-from-G1", "grant", kind="one_month",
           reason="Complimentary grant", expected=0, backdate=False),
    vector("grant_one_year_backdate_confirmed", "G2", "grant", kind="one_year",
           reason="Backdated promotion", expected=0, start="2026-01-01T00:00:00+05:30",
           backdate=True),
    vector("grant_lifetime", "G4", "grant", kind="lifetime", reason="Partner lifetime",
           expected=1),
    vector("grant_custom_date_only", "G5", "grant", kind="custom", reason="Custom period",
           expected=2, start="2027-04-01", end="2027-05-01"),
    vector("grant_custom_offset_plus0530", "G5", "grant", kind="custom", reason="Custom period",
           expected=2, start="2027-04-01T00:00:00+05:30", end="2027-05-01T00:00:00+05:30"),
    vector("grant_custom_utc_same_instants", "G5", "grant", kind="custom", reason="Custom period",
           expected=2, start="2027-03-31T18:30:00Z", end="2027-04-30T18:30:00Z"),
    vector("grant_custom_one_microsecond_later", "G5-differs", "grant", kind="custom",
           reason="Custom period", expected=2, start="2027-04-01T00:00:00.000001+05:30",
           end="2027-05-01T00:00:00+05:30"),
    vector("grant_reason_nfd_with_trailing_spaces", "N1", "grant", kind="one_month",
           reason="Café promo  ", expected=0),
    vector("grant_reason_nfc_no_spaces", "N1", "grant", kind="one_month",
           reason="Café promo", expected=0),
    vector("extend_month", "X1", "extend", unit="month", reason="Extension", expected=3),
    vector("extend_year", "X2", "extend", unit="year", reason="Extension", expected=3),
    vector("revoke_lowercase_target", "R1", "revoke", target=TARGET, reason="Revoke error",
           expected=4),
    vector("revoke_uppercase_target", "R1", "revoke", target=TARGET.upper(),
           reason="Revoke error", expected=4),
    vector("replace_one_year", "P1", "replace", target=TARGET, kind="one_year",
           reason="Replacement", expected=5),
    vector("replace_custom", "P2", "replace", target=TARGET, kind="custom",
           reason="Replacement", expected=5, start="2027-04-01", end="2027-05-01"),
]

# Pairs that must not share bytes: a change in one hash-affecting field.
DIFFERENT_BYTES = [
    ("grant_one_month_defaults", "grant_one_month_backdate_false"),
    ("grant_custom_date_only", "grant_custom_one_microsecond_later"),
    ("extend_month", "extend_year"),
    ("revoke_lowercase_target", "replace_one_year"),
]


# ---------- normalisation cases checked on both sides ----------

TEXT_CASES = [
    ("Café promo  ", "Café promo"),
    (" one_month ", "one_month"),
    (" x", " x"),  # NBSP is not a space and is kept
    ("\tx", "\tx"),         # tab is not trimmed
    ("   ", ""),            # empty after trimming (rejected by the RPC, length 0)
]

# S1: enumerated tokens are NFC only. Padding is kept, so a padded token is not an allowed token.
ENUM_CASES = [
    (" one_month ", " one_month "),
    ("one_month\t", "one_month\t"),
    ("month ", "month "),
    ("one_month", "one_month"),
]

INSTANT_CASES = [
    "2027-04-01",                         # date-only, 00:00 Asia/Kolkata
    "2027-04-01T00:00:00+05:30",
    "2027-03-31T18:30:00Z",
    "2027-04-01T00:00:00.123456+05:30",
    "2027-04-01T00:00:00.1234567+05:30",  # seven fractional digits: rejected
    "2027-04-01T00:00:00",                # no offset: rejected
    "2027-02-30",                         # impossible date: rejected
    "2027-04-01 00:00:00+05:30",          # space instead of T: rejected
    "",                                   # empty string is not null: rejected
]


# ---------- running the same inputs through SQL ----------

def lit(s):
    return "'" + s.replace("'", "''") + "'"


def sql_text(raw):
    if raw is None:
        return "null::text"
    return f"public.licence_canon_text({lit(raw)})"


def sql_enum(raw):
    """Enumerated tokens are already NFC-normalised by the harness, so they pass through unchanged."""
    if raw is None:
        return "null::text"
    return lit(raw)


def sql_uuid(raw):
    if raw is None:
        return "null::uuid"
    return f"public.licence_try_uuid({lit(raw)})"


def sql_instant(raw):
    if raw is None:
        return "null::timestamptz"
    return f"public.licence_parse_instant({lit(raw)})"


def sql_for_vector(v):
    r = v["raw"]
    n = v["normalised"]
    args = (
        f"{lit(v['action'])}, {lit(r['uid'])}::uuid, {lit(r['shop'])}::uuid, "
        f"{int(r['expected'])}::bigint, {'true' if r['confirm'] else 'false'}::boolean, "
        f"{sql_text(r['reason'])}, {sql_enum(n['kind'])}, {sql_enum(n['unit'])}, "
        f"{sql_uuid(r['target'])}, {sql_instant(r['start'])}, {sql_instant(r['end'])}, "
        + ("null::boolean" if r["backdate"] is None else ("true" if r["backdate"] else "false") + "::boolean")
    )
    return ("select " + lit(v["name"]) + " || '|' || encode(public.licence_admin_canonical_bytes("
            + args + "), 'hex') || '|' || encode(sha256(public.licence_admin_canonical_bytes("
            + args + ")), 'hex');")


def run_psql(args, sql_text_input):
    cmd = ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", args.db,
           "-h", args.socket, "-p", str(args.port), "-U", "postgres", "-f", "-"]
    proc = subprocess.run(cmd, input=sql_text_input.encode("utf-8"), capture_output=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr.decode("utf-8", "replace"))
        raise SystemExit("psql failed")
    return proc.stdout.decode("utf-8")


# ---------- checks ----------

def check_pinned(pinned_doc):
    """The reference encoder must reproduce the pinned file exactly, and each pinned digest must
    match its own bytes. Returns the number of failures."""
    failures = 0
    ok = pinned_doc.get("domain") == DOMAIN
    print(("PASS" if ok else "FAIL"), "pinned domain", pinned_doc.get("domain"))
    failures += 0 if ok else 1

    current = json.loads(json.dumps(VECTORS))
    pinned = pinned_doc.get("vectors", [])
    ok = pinned == current
    print(("PASS" if ok else "FAIL"), "pinned inputs and expected bytes equal the reference",
          f"({len(pinned)} vectors)")
    failures += 0 if ok else 1

    for v in pinned:
        digest_ok = hashlib.sha256(bytes.fromhex(v["expected_bytes_hex"])).hexdigest() == v["expected_sha256_hex"]
        if not digest_ok:
            print("FAIL pinned digest does not match its bytes", v["name"])
            failures += 1
    return failures


def check_enum_reference():
    failures = 0
    for raw, expected in ENUM_CASES:
        ok = norm_enum(raw) == expected
        print(("PASS" if ok else "FAIL"), "enum (NFC only, no trim)", repr(raw))
        failures += 0 if ok else 1
    padded_allowed = any(norm_enum(" one_month ") == k for k in GRANT_KINDS)
    print(("PASS" if not padded_allowed else "FAIL"), "padded token is not an allowed grant kind")
    failures += 1 if padded_allowed else 0
    return failures


def check_vectors(args, vectors):
    failures = 0
    out = run_psql(args, "\n".join(sql_for_vector(v) for v in vectors) + "\n").strip().splitlines()
    got = {}
    for line in out:
        name, hex_bytes, sha = line.split("|")
        got[name] = (hex_bytes, sha)
    expected = {v["name"]: v for v in vectors}
    for v in vectors:
        hex_bytes, sha = got.get(v["name"], (None, None))
        ok = hex_bytes == v["expected_bytes_hex"] and sha == v["expected_sha256_hex"]
        print(("PASS" if ok else "FAIL"), "sql vector", v["name"], v["expected_sha256_hex"][:16])
        failures += 0 if ok else 1
    for a, b in DIFFERENT_BYTES:
        if a not in expected or b not in expected:
            print("FAIL must differ: missing vector", a, b)
            failures += 1
            continue
        ok = expected[a]["expected_sha256_hex"] != expected[b]["expected_sha256_hex"]
        print(("PASS" if ok else "FAIL"), "must differ", a, "/", b)
        failures += 0 if ok else 1
    groups = {}
    for v in vectors:
        groups.setdefault(v["group"], []).append(v)
    for g, items in groups.items():
        if len(items) < 2:
            continue
        ok = len({x["expected_sha256_hex"] for x in items}) == 1
        print(("PASS" if ok else "FAIL"), "must match, group", g, [x["name"] for x in items])
        failures += 0 if ok else 1
    return failures


def check_text_and_instants(args):
    failures = 0
    parts = []
    for raw, expected in TEXT_CASES:
        parts.append(
            f"select {lit(raw)}, public.licence_canon_text({lit(raw)}) = {lit(expected)} "
            f"and char_length(public.licence_canon_text({lit(raw)})) = {len(expected)};"
        )
    for raw in INSTANT_CASES:
        expected = parse_instant(raw)
        if expected is None:
            parts.append(f"select {lit(raw)}, public.licence_parse_instant({lit(raw)}) is null;")
        else:
            micro = int(((expected - EPOCH).days * 86400 + (expected - EPOCH).seconds) * 1_000_000
                        + (expected - EPOCH).microseconds)
            parts.append(
                f"select {lit(raw)}, (extract(epoch from public.licence_parse_instant({lit(raw)})) "
                f"* 1000000)::bigint = {micro}::bigint;"
            )
    out = run_psql(args, "\n".join(parts) + "\n").strip().splitlines()
    for line in out:
        raw, ok = line.rsplit("|", 1)
        print("PASS" if ok == "t" else "FAIL", "normalisation", repr(raw))
        failures += 0 if ok == "t" else 1
    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="stage7c_local")
    ap.add_argument("--socket", default=os.environ.get("STAGE7C_SOCK"),
                    help="socket directory of the local throwaway cluster (or set STAGE7C_SOCK)")
    ap.add_argument("--port", type=int, default=55433)
    ap.add_argument("--pinned", default=PINNED_DEFAULT)
    ap.add_argument("--update", action="store_true",
                    help="explicitly regenerate the pinned file from the reference encoder, then run the checks")
    args = ap.parse_args()
    if not args.socket:
        raise SystemExit("set STAGE7C_SOCK or pass --socket (socket directory of the local throwaway cluster)")

    if args.db != "stage7c_local":
        raise SystemExit("refusing: this harness runs only on the local database stage7c_local")

    if args.update:
        doc = {"domain": DOMAIN, "vectors": json.loads(json.dumps(VECTORS))}
        with open(args.pinned, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        print("UPDATED pinned oracle (explicit --update):", args.pinned)
    else:
        if not os.path.exists(args.pinned):
            print("FAIL pinned oracle missing:", args.pinned, "(regenerate only with --update)")
            return 1
        with open(args.pinned, encoding="utf-8") as fh:
            doc = json.load(fh)

    failures = check_pinned(doc)
    failures += check_enum_reference()
    failures += check_vectors(args, doc["vectors"])
    failures += check_text_and_instants(args)
    print("FAILURES:", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
