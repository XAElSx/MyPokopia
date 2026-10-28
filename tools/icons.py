"""Draw the app icons (the header's half-filled circle) as PNGs for manifest.json.

Usage: python tools/icons.py      writes images/icon-192.png and images/icon-512.png
No libraries needed: the PNG is written by hand.
"""
import os, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (0x0E, 0x14, 0x11)
ACCENT = (0x3F, 0xBF, 0x8A)
LIGHT = (0xE5, 0xEE, 0xE8)


def pixel(x, y, n):
    c = (n - 1) / 2
    r = n * 0.36            # circle radius
    ring = n * 0.045        # outline width
    d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
    if d > r:
        return BG
    if d > r - ring:
        return ACCENT
    return ACCENT if y < n * 0.48 else LIGHT


def png(n, path):
    rows = b"".join(b"\x00" + bytes(v for x in range(n) for v in pixel(x, y, n)) for y in range(n))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(rows, 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "images"), exist_ok=True)
    for size in (192, 512):
        png(size, os.path.join(ROOT, "images", f"icon-{size}.png"))
    print("ok")
