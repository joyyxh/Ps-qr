#!/usr/bin/env python3
"""Generate a shop's permanent QR code, print poster and manifest.

Each shop gets one QR code that encodes its public page URL, for example
    https://<your-domain>/#/s/<slug>

Outputs (in --out, default qr/<slug>/):
    qr.svg          vector code for print shops and designers
    qr.png          raster code, 12 px per module
    poster.pdf      A4 poster with the code, shop name and address
    manifest.json   what was encoded, when, and a self-check result

The script decodes its own PNG before writing anything else. If the decoded
text does not match the URL exactly, it stops with an error.

Requires: opencv-python (cv2) with QR encoder support, Pillow, reportlab.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$")
QUIET_ZONE_MODULES = 4          # QR spec minimum on every side
PNG_PIXELS_PER_MODULE = 12


def build_url(base_url: str, slug: str) -> str:
    if not SLUG_PATTERN.match(slug):
        raise SystemExit(f"Invalid slug '{slug}'. Use lowercase letters, digits and hyphens.")
    base = base_url.rstrip("/")
    if not base.startswith(("https://", "http://localhost", "http://127.0.0.1")):
        raise SystemExit(
            "Base URL must be https:// for a real shop. "
            "http:// is only allowed for localhost testing."
        )
    return f"{base}/#/s/{slug}"


def encode_matrix(url: str) -> np.ndarray:
    """Return a boolean matrix: True = dark module. No quiet zone included."""
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_M
    encoder = cv2.QRCodeEncoder.create(params)
    image = encoder.encode(url)
    if image.ndim != 2:
        raise SystemExit("Unexpected QR encoder output shape.")
    return image < 128


def to_png(matrix: np.ndarray, path: Path) -> None:
    size = matrix.shape[0] + 2 * QUIET_ZONE_MODULES
    canvas_arr = np.full((size, size), 255, dtype=np.uint8)
    body = np.where(matrix, 0, 255).astype(np.uint8)
    canvas_arr[
        QUIET_ZONE_MODULES : QUIET_ZONE_MODULES + matrix.shape[0],
        QUIET_ZONE_MODULES : QUIET_ZONE_MODULES + matrix.shape[1],
    ] = body
    scaled = np.kron(canvas_arr, np.ones((PNG_PIXELS_PER_MODULE, PNG_PIXELS_PER_MODULE), dtype=np.uint8))
    Image.fromarray(scaled, mode="L").save(path, format="PNG", optimize=True)


def to_svg(matrix: np.ndarray, path: Path) -> None:
    n = matrix.shape[0]
    total = n + 2 * QUIET_ZONE_MODULES
    parts = []
    for row in range(n):
        col = 0
        while col < n:
            if matrix[row, col]:
                start = col
                while col < n and matrix[row, col]:
                    col += 1
                x = start + QUIET_ZONE_MODULES
                y = row + QUIET_ZONE_MODULES
                parts.append(f"M{x} {y}h{col - start}v1h-{col - start}z")
            else:
                col += 1
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="{total * 4}mm" height="{total * 4}mm" shape-rendering="crispEdges">'
        f'<rect width="{total}" height="{total}" fill="#ffffff"/>'
        f'<path fill="#000000" d="{"".join(parts)}"/></svg>\n'
    )
    path.write_text(svg, encoding="utf-8")


def self_check(png_path: Path, expected_url: str) -> None:
    image = cv2.imread(str(png_path), cv2.IMREAD_GRAYSCALE)
    decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(image)
    if decoded != expected_url:
        raise SystemExit(
            f"Self-check failed. Expected {expected_url!r} but the code decodes to {decoded!r}. "
            "Nothing was written to the output folder."
        )


def write_poster(matrix: np.ndarray, url: str, name: str, address: str, path: Path) -> None:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawCentredString(width / 2, height - 35 * mm, "Print online. Pick up at the counter.")

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawCentredString(width / 2, height - 48 * mm, name)
    if address:
        pdf.setFont("Helvetica", 12)
        pdf.drawCentredString(width / 2, height - 56 * mm, address)

    # Code area: total modules include the quiet zone on each side.
    total = matrix.shape[0] + 2 * QUIET_ZONE_MODULES
    code_side = 110 * mm
    module = code_side / total
    left = (width - code_side) / 2
    bottom = height - 72 * mm - code_side

    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(left, bottom, code_side, code_side, stroke=0, fill=1)
    pdf.setFillColorRGB(0, 0, 0)
    n = matrix.shape[0]
    for row in range(n):
        for col in range(n):
            if matrix[row, col]:
                x = left + (col + QUIET_ZONE_MODULES) * module
                y = bottom + (n - 1 - row + QUIET_ZONE_MODULES) * module
                pdf.rect(x, y, module, module, stroke=0, fill=1)

    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(width / 2, bottom - 12 * mm, "Scan with your phone camera. No app needed.")
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(width / 2, bottom - 20 * mm, url)

    pdf.setFont("Helvetica", 9)
    # Only state what the product actually does today. Do not add privacy
    # promises here until automatic file deletion (Stage 8) is built and tested.
    pdf.drawCentredString(
        width / 2,
        15 * mm,
        "Prices are shown before you place the order. Pay at the shop counter.",
    )
    pdf.showPage()
    pdf.save()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", required=True, help="shop slug, for example demo-xerox")
    parser.add_argument("--name", required=True, help="shop name shown on the poster")
    parser.add_argument("--address", default="", help="shop address shown on the poster")
    parser.add_argument("--shop-id", default="", help="shop UUID, recorded in the manifest")
    parser.add_argument(
        "--base-url",
        default="http://localhost:5173",
        help="where the customer page is hosted. Use https://your-domain before printing.",
    )
    parser.add_argument("--out", default="", help="output folder (default: qr/<slug>)")
    args = parser.parse_args()

    url = build_url(args.base_url, args.slug)
    out_dir = Path(args.out or f"qr/{args.slug}")
    out_dir.mkdir(parents=True, exist_ok=True)

    matrix = encode_matrix(url)

    # Write the PNG first so it can be decoded and checked before anything else is saved.
    png_path = out_dir / "qr.png"
    to_png(matrix, png_path)
    self_check(png_path, url)

    to_svg(matrix, out_dir / "qr.svg")
    write_poster(matrix, url, args.name, args.address, out_dir / "poster.pdf")

    manifest = {
        "slug": args.slug,
        "shop_id": args.shop_id or None,
        "encodes": url,
        "sha256_of_url": hashlib.sha256(url.encode("utf-8")).hexdigest(),
        "error_correction": "M",
        "modules": int(matrix.shape[0]),
        "quiet_zone_modules": QUIET_ZONE_MODULES,
        "self_check": "passed",
        "created_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "note": "Rename the slug or change the domain and the printed code stops working. Regenerate and reprint.",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Encoded: {url}")
    print(f"Self-check: decodes to the same URL")
    for name in ("qr.svg", "qr.png", "poster.pdf", "manifest.json"):
        print(f"  wrote {out_dir / name}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # keep errors readable for beginners
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
