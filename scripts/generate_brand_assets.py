#!/usr/bin/env python3
"""Generate Surplasse brand-derived assets (QR codes) from domain profiles.

Surplasse QR rules: rounded modules and the Surplasse mark centered.
Re-run whenever the logo or brand changes. Requires `qrcode[pil]`.

Usage: python3 scripts/generate_brand_assets.py [--check]
"""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory

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

DOMAIN_PROFILES = {
    "production": "qr-demo.png",
    "development": "qr-demo-development.png",
}


def load_domain_config(profile: str) -> dict[str, str]:
    """Read the versioned public domain profile without executing it."""
    path = ROOT / "config" / "domains" / f"{profile}.env"
    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(path.read_text().splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid line {line_number} in {path}")
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

    scheme = values.get("APP_SCHEME")
    base_domain = values.get("APP_BASE_DOMAIN")
    base_url = values.get("APP_BASE_URL")
    if scheme != "https" or not base_domain:
        raise ValueError(f"Invalid domain profile: {path}")
    if base_url != f"{scheme}://{base_domain}":
        raise ValueError(f"APP_BASE_URL is inconsistent in {path}")
    return values


def example_url(profile: str) -> str:
    """Build the sample restaurant URL from the selected public profile."""
    config = load_domain_config(profile)
    return (
        f"{config['APP_SCHEME']}://fiorella.{config['APP_BASE_DOMAIN']}"
        "/?table=demo"
    )


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


def generate(output_directory: Path, *, quiet: bool = False) -> None:
    output_directory.mkdir(parents=True, exist_ok=True)
    center = make_center_mark()
    center.save(output_directory / "center-mark.png")
    for profile, name in DOMAIN_PROFILES.items():
        url = example_url(profile)
        make_qr(url, center).save(output_directory / name)
        if not quiet:
            print(f"wrote brand/qr/{name}  ({url})")
    if not quiet:
        print("wrote brand/qr/center-mark.png")


def images_have_same_pixels(first: Path, second: Path) -> bool:
    """Compare decoded pixels so PNG compression remains platform-independent."""
    if not first.is_file() or not second.is_file():
        return False
    with Image.open(first) as actual, Image.open(second) as generated:
        actual.load()
        generated.load()
        return (
            actual.mode == generated.mode
            and actual.size == generated.size
            and actual.tobytes() == generated.tobytes()
        )


def check_assets() -> None:
    expected_names = ["center-mark.png", *DOMAIN_PROFILES.values()]
    with TemporaryDirectory(prefix="surplasse-brand-") as temporary_directory:
        generated_directory = Path(temporary_directory)
        generate(generated_directory, quiet=True)
        stale = [
            name
            for name in expected_names
            if not images_have_same_pixels(
                OUT / name,
                generated_directory / name,
            )
        ]
    if stale:
        raise SystemExit(
            "Stale brand assets: "
            + ", ".join(stale)
            + ". Run python3 scripts/generate_brand_assets.py."
        )
    print("Brand QR assets match both domain profiles.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_assets()
    else:
        generate(OUT)


if __name__ == "__main__":
    main()
