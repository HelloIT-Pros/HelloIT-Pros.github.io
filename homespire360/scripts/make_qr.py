"""
Generate each LO's QR code from the URL it is supposed to encode.

Why generate rather than store a QR exported from another tool: the image is
derived data. Generating it from the URL in config.json means it can never
drift out of sync with the link, adding an LO costs one command instead of a
manual export, and the result carries the Homespire mark rather than the
branding of whichever tool made it.

Reads data/config.json, finds every link with "kind": "qr", and writes the PNG
named by its "image" field. Every code is decoded again before the script
exits, because a QR that scans to the wrong place is worse than no QR at all.

Run: python3 make_qr.py
"""
import json
import os
import sys

import cv2
import numpy as np
import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CONFIG = os.path.join(ROOT, "data", "config.json")
MARK = os.path.join(ROOT, "brand", "homespire-mark.png")

DARK = (46, 10, 90)      # brand purple, dark enough for reliable scanning
LIGHT = (255, 255, 255)  # a white ground gives the best contrast for a camera
SIZE = 1000              # generous, so it stays crisp held up at arm's length

# Error correction H tolerates ~30% loss, which is what makes a centred logo
# safe. Keep the logo near a fifth of the width and verify by decoding.
LOGO_FRACTION = 0.21


def build_qr(url):
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=DARK, back_color=LIGHT).convert("RGB")
    return img.resize((SIZE, SIZE), Image.NEAREST)  # NEAREST keeps module edges hard


def add_mark(img):
    """Drop the Homespire mark into the middle on a white pad."""
    box = int(SIZE * LOGO_FRACTION)
    pad = int(box * 1.18)

    plate = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
    radius = int(pad * 0.22)
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, pad - 1, pad - 1], radius=radius, fill=LIGHT + (255,))

    mark = Image.open(MARK).convert("RGBA").resize((box, box), Image.LANCZOS)
    offset = (pad - box) // 2
    plate.paste(mark, (offset, offset), mark)

    img.paste(plate, ((SIZE - pad) // 2, (SIZE - pad) // 2), plate)
    return img


def verify(path, expected):
    """Decode the file we just wrote and confirm it points where it should."""
    arr = np.array(Image.open(path).convert("RGB"))[:, :, ::-1]
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(arr)
    return data == expected, data


def qr_links(config):
    for lo in config["los"]:
        for link in lo.get("customLinks", []):
            if link.get("kind") == "qr":
                yield lo, link


if __name__ == "__main__":
    config = json.load(open(CONFIG, encoding="utf-8"))
    found = list(qr_links(config))
    if not found:
        sys.exit('No links with "kind": "qr" in config.json, nothing to generate.')

    failures = []
    for lo, link in found:
        if not link.get("image") or not link.get("url"):
            failures.append(f'{lo["slug"]}: qr link needs both "url" and "image"')
            continue

        path = os.path.join(ROOT, link["image"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        add_mark(build_qr(link["url"])).save(path, optimize=True)

        ok, decoded = verify(path, link["url"])
        size = os.path.getsize(path)
        print(f'{"OK  " if ok else "BAD "} {link["image"]}  {size} bytes  {lo["name"]}')
        if ok:
            print(f'       scans to {decoded}')
        else:
            failures.append(f'{link["image"]} decoded to {decoded!r}, expected {link["url"]!r}')

    if failures:
        print("\nFAILED:")
        for f in failures:
            print("  " + f)
        sys.exit(1)
    print(f"\n{len(found)} QR code(s) generated and verified.")
