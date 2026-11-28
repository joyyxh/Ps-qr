#!/usr/bin/env python3
"""Checks the result rows that a base SQL suite prints as CSV (name, ok, detail).

Usage: check_results.py <results.csv> <suite-name> <minimum-checks>

Exit 0 only when the header is name,ok,detail, there are at least <minimum-checks> rows, and every
row has ok = t. It never edits a check and never reads the detail text as a pass or fail.
The minimum is the number of checks the suite had when this harness was written, so a deleted check
is reported as a failure.
"""
import csv
import sys


def main() -> int:
    path, name, minimum = sys.argv[1], sys.argv[2], int(sys.argv[3])
    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    if not rows or rows[0] != ["name", "ok", "detail"]:
        print(f"{name}: unexpected output header {rows[0] if rows else None}")
        return 1
    data = [row for row in rows[1:] if row]
    not_ok = [row for row in data if len(row) < 3 or row[1] != "t"]
    print(f"{name}: {len(data)} checks, {len(data) - len(not_ok)} ok, {len(not_ok)} not ok "
          f"(minimum {minimum})")
    for row in not_ok:
        detail = row[2] if len(row) > 2 else ""
        print(f"  NOT OK: {row[0]} | {detail}")
    if len(data) < minimum:
        print(f"  FEWER CHECKS THAN EXPECTED: {len(data)} < {minimum}")
        return 1
    return 1 if not_ok else 0


if __name__ == "__main__":
    sys.exit(main())
