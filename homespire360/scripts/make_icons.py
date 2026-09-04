"""
Regenerate Homespire 360 app icons from the Homespire brand mark.

Source of truth: brand/homespire-mark.png, the white house mark on brand purple.
The file is only 343px, so this script does not resize the picture directly.
It lifts the mark into a coverage map (how white each pixel is), scales that,
and repaints it as pure white over pure purple. Colour stays exact at every
size and the diagonal roof edges keep their anti-aliasing instead of
stair-stepping, which is what a hard threshold would do to them.

Two families come out of it:
  any        full bleed, the mark framed the way the brand file frames it
  maskable   the mark scaled down so it survives Android's circular safe zone

Run: python3 make_icons.py
Writes into ../icons/ relative to this file.
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "brand", "homespire-mark.png")
OUT = os.path.join(HERE, "..", "icons")

PURPLE = (80, 40, 129, 255)  # #502881, sampled from the brand mark
WHITE = (255, 255, 255, 255)

# A maskable icon must keep everything important inside the middle 80% circle.
# A roughly square subject centred in that circle can be about 58% of the
# canvas before its corners cross the boundary.
MASKABLE_SUBJECT = 0.58


def load_mark():
    """Return a coverage map of the mark: 0 is pure purple, 255 is pure white."""
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    side = max(w, h)

    # Square the canvas without moving the mark off centre.
    squared = Image.new("RGB", (side, side), PURPLE[:3])
    squared.paste(im, ((side - w) // 2, (side - h) // 2))

    # Rescale luminance so the purple ground reads as 0 and the mark as 255.
    # Edge pixels land in between, which is exactly the anti-aliasing we want
    # to keep as an alpha channel.
    floor = (
        0.299 * PURPLE[0] + 0.587 * PURPLE[1] + 0.114 * PURPLE[2]
    )
    span = 255.0 - floor
    return squared.convert("L").point(
        lambda v: max(0, min(255, round((v - floor) / span * 255))), mode="L"
    )


def compose(coverage, size):
    """Paint a coverage map as white over purple at the given size."""
    alpha = coverage.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), PURPLE)
    canvas.paste(Image.new("RGBA", (size, size), WHITE), (0, 0), alpha)
    return canvas


def compose_maskable(coverage, size):
    """Same, but with the mark shrunk into the safe zone and re-centred."""
    bbox = coverage.point(lambda v: 255 if v > 40 else 0, mode="L").getbbox()
    cropped = coverage.crop(bbox)
    cw, ch = cropped.size

    scale = (size * MASKABLE_SUBJECT) / max(cw, ch)
    new = (max(1, round(cw * scale)), max(1, round(ch * scale)))
    scaled = cropped.resize(new, Image.LANCZOS)

    alpha = Image.new("L", (size, size), 0)
    alpha.paste(scaled, ((size - new[0]) // 2, (size - new[1]) // 2))

    canvas = Image.new("RGBA", (size, size), PURPLE)
    canvas.paste(Image.new("RGBA", (size, size), WHITE), (0, 0), alpha)
    return canvas


def write(img, name):
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print(f"wrote {name} {img.size[0]}x{img.size[1]} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    mark = load_mark()

    write(compose(mark, 512), "icon-512.png")
    write(compose(mark, 192), "icon-192.png")
    write(compose(mark, 180), "apple-touch-icon.png")
    write(compose(mark, 32), "favicon-32.png")

    write(compose_maskable(mark, 512), "icon-maskable-512.png")
    write(compose_maskable(mark, 192), "icon-maskable-192.png")
