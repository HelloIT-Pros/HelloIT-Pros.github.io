"""
Regenerate Homespire 360 app icons: a simple house silhouette on a solid
brand-color background, matching the original LO Life icon's proportions
but in the new purple/gold palette.

Run: python3 make_icons.py
Writes into ../icons/ relative to this file.
"""
import os
from PIL import Image, ImageDraw

BG = (46, 10, 90, 255)     # --navy #2E0A5A
FG = (245, 200, 66, 255)   # --gold #F5C842

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "icons")


def house_polygon(size, scale=1.0, cy_offset=0):
    """House silhouette (roof + walls + door cutout) centered in a size x size canvas."""
    s = size
    c = s / 2
    # Base proportions tuned to match the original icon's silhouette, at scale=1.0
    # filling most of a 512 canvas; scale<1 shrinks for maskable safe zones.
    roof_apex_y = s * 0.117 * scale + (c - c * scale) + cy_offset
    eave_y = s * 0.5 * scale + (c - c * scale) + cy_offset
    wall_bottom_y = s * 0.891 * scale + (c - c * scale) + cy_offset
    apex_x = c
    eave_half = s * 0.384 * scale
    wall_half = s * 0.305 * scale
    door_half = s * 0.078 * scale
    door_top_y = s * 0.656 * scale + (c - c * scale) + cy_offset

    roof = [
        (apex_x, roof_apex_y),
        (apex_x + eave_half, eave_y),
        (apex_x + wall_half, eave_y),
        (apex_x + wall_half, wall_bottom_y),
        (apex_x + door_half, wall_bottom_y),
        (apex_x + door_half, door_top_y),
        (apex_x - door_half, door_top_y),
        (apex_x - door_half, wall_bottom_y),
        (apex_x - wall_half, wall_bottom_y),
        (apex_x - wall_half, eave_y),
        (apex_x - eave_half, eave_y),
    ]
    return roof


def make_icon(size, path, scale=1.0):
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    draw.polygon(house_polygon(size, scale=scale), fill=FG)
    img.save(path)
    print("wrote", path, img.size)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    make_icon(512, os.path.join(OUT, "icon-512.png"), scale=1.0)
    make_icon(192, os.path.join(OUT, "icon-192.png"), scale=1.0)
    make_icon(512, os.path.join(OUT, "icon-maskable-512.png"), scale=0.7)
    make_icon(192, os.path.join(OUT, "icon-maskable-192.png"), scale=0.7)
    make_icon(180, os.path.join(OUT, "apple-touch-icon.png"), scale=1.0)
