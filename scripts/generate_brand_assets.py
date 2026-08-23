#!/usr/bin/env python3
"""Generate Surplasse QR codes from domain profiles and the raster center mark.

Surplasse QR rules: rounded modules and the Surplasse mark centered.
Replace `brand/qr/center-mark.png` when the mark changes, then regenerate.
Requires `qrcode[pil]`.

Usage: npm run brand:generate, or npm run brand:check
"""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brand" / "qr"
CENTER_MARK = OUT / "center-mark.png"

INK = (24, 24, 24)
PAPER = (250, 247, 242)

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
    if scheme != "https" or not base_domain:
        raise ValueError(f"Invalid domain profile: {path}")
    if any(key.endswith("_URL") and key != "PROBLEM_TYPE_BASE" for key in values):
        raise ValueError(f"Derived application URLs must not be duplicated in {path}")
    return values


def example_url(profile: str) -> str:
    """Build the sample restaurant URL from the selected public profile."""
    config = load_domain_config(profile)
    return (
        f"{config['APP_SCHEME']}://fiorella.{config['APP_BASE_DOMAIN']}"
        "/?table=demo"
    )


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
    with Image.open(CENTER_MARK) as source:
        center = source.convert("RGBA")
    for profile, name in DOMAIN_PROFILES.items():
        url = example_url(profile)
        make_qr(url, center).save(output_directory / name)
        if not quiet:
            print(f"wrote brand/qr/{name}  ({url})")


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
    expected_names = list(DOMAIN_PROFILES.values())
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
            + ". Run npm run brand:generate."
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
