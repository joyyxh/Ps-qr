"""Draws the PrintNest app icons (PNG, standard library only).

Run once from the project root:  python3 tools/make_icons.py
It writes web/icons/icon-192.png and web/icons/icon-512.png.
"""
import struct
import zlib
from pathlib import Path

BLUE = (0x1F, 0x6F, 0xEB)
WHITE = (0xFF, 0xFF, 0xFF)
GREY = (0xDF, 0xE3, 0xEA)


def in_box(x, y, left, top, right, bottom):
    return left <= x < right and top <= y < bottom


def draw(size):
    """A blue square with a white sheet of paper and three printed lines."""
    s = size
    rows = []
    for py in range(s):
        y = (py + 0.5) / s
        row = bytearray([0])  # PNG filter type: none
        for px in range(s):
            x = (px + 0.5) / s
            colour = BLUE
            if in_box(x, y, 0.27, 0.18, 0.73, 0.82):
                colour = WHITE
                for line_y in (0.36, 0.50, 0.64):
                    if in_box(x, y, 0.36, line_y - 0.022, 0.64, line_y + 0.022):
                        colour = BLUE
            if in_box(x, y, 0.22, 0.80, 0.78, 0.86):
                colour = GREY
            row += bytes(colour)
        rows.append(bytes(row))
    return b''.join(rows)


def png(size):
    raw = draw(size)

    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def main():
    out = Path(__file__).resolve().parent.parent / 'web' / 'icons'
    out.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        target = out / f'icon-{size}.png'
        target.write_bytes(png(size))
        print(f'wrote {target} ({target.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
