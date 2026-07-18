#!/usr/bin/env python3
"""Generate Surplasse brand-derived assets (QR codes) from the logo font.

Surplasse QR rules: rounded modules and the Surplasse mark centered.
Re-run whenever the logo or brand changes. Requires `qrcode[pil]`.

Usage: python3 scripts/generate_brand_assets.py
"""
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "brand" / "fonts" / "Parisienne-Regular.ttf"
OUT = ROOT / "brand" / "qr"

INK = (43, 33, 24)       # --fg-1 espresso
IVORY = (246, 239, 224)  # --bg-1
ACCENT = (232, 72, 28)   # --accent orange
PAPER = (255, 254, 248)  # --bg-3

# Example destinations. In production the URL carries the establishment slug
# and an opaque table token: https://{slug}.surplasse.com/?table={token}
EXAMPLES = [
    ("qr-demo.png", "https://fiorella.surplasse.com/?table=demo"),
]


def make_center_mark(size: int = 280) -> Image.Image:
    """A compact round knockout holding the Parisienne 'S' in accent orange."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ring = max(6, size // 22)
    d.ellipse([ring // 2, ring // 2, size - ring // 2, size - ring // 2],
              fill=PAPER, outline=ACCENT, width=ring)
    font = ImageFont.truetype(str(FONT), int(size * 0.66))
    box = d.textbbox((0, 0), "S", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), "S",
           font=font, fill=ACCENT)
    return img


def make_qr(url: str, center: Image.Image) -> Image.Image:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=16, border=3)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(back_color=PAPER, front_color=INK),
        embeded_image=center,
    ).get_image()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    center = make_center_mark()
    center.save(OUT / "center-mark.png")
    for name, url in EXAMPLES:
        make_qr(url, center).save(OUT / name)
        print(f"wrote brand/qr/{name}  ({url})")
    print("wrote brand/qr/center-mark.png")


if __name__ == "__main__":
    main()
