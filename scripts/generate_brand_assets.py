#!/usr/bin/env python3
"""Generate Surplasse QR codes and the product social card.

Surplasse QR rules: rounded modules and the Surplasse mark centered.
Replace `brand/qr/center-mark.png` when the mark changes, then regenerate.
The social card keeps the contractual horizontal logo intact and renders the
editable SVG source with a local Chromium browser before optimizing the PNG.
Requires `qrcode[pil]` and Pillow.

Usage: npm run brand:generate, or npm run brand:check
"""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image, PngImagePlugin

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brand" / "qr"
CENTER_MARK = OUT / "center-mark.png"
SOCIAL_CARD_SOURCE = ROOT / "brand" / "surplasse-social-card.svg"
SOCIAL_CARD_RASTER = ROOT / "brand" / "surplasse-social-card.png"
SOCIAL_CARD_SIZE = (1200, 630)
SOCIAL_CARD_DIGEST_KEY = "surplasse_social_card_source_sha256"
SOCIAL_CARD_URL_KEY = "surplasse_social_card_url"
SOCIAL_CARD_URL = "https://surplasse.com/brand/surplasse-social-card.png"
SOCIAL_CARD_INPUTS = (
    SOCIAL_CARD_SOURCE,
    ROOT / "brand" / "surplasse-logo-horizontal.svg",
    ROOT / "brand" / "illustrations" / "service-line.svg",
    ROOT / "brand" / "fonts" / "archivo-400_900-latin.woff2",
    ROOT / "brand" / "fonts" / "spacemono-400-latin.woff2",
    ROOT / "brand" / "fonts" / "spacemono-700-latin.woff2",
)

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


def generate_qr_assets(output_directory: Path, *, quiet: bool = False) -> None:
    output_directory.mkdir(parents=True, exist_ok=True)
    with Image.open(CENTER_MARK) as source:
        center = source.convert("RGBA")
    for profile, name in DOMAIN_PROFILES.items():
        url = example_url(profile)
        make_qr(url, center).save(output_directory / name)
        if not quiet:
            print(f"wrote brand/qr/{name}  ({url})")


def social_card_source_digest() -> str:
    """Hash every file that changes the rendered social card."""
    digest = hashlib.sha256()
    digest.update(b"surplasse-social-card-v1\0")
    for path in SOCIAL_CARD_INPUTS:
        digest.update(path.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def chromium_binary() -> Path:
    """Find a local Chromium-family browser without downloading one."""
    configured = os.environ.get("SURPLASSE_CHROMIUM_PATH")
    candidates = [
        configured,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        shutil.which("google-chrome-stable"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("microsoft-edge"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise SystemExit(
        "Cannot generate the social card: install Chromium or set "
        "SURPLASSE_CHROMIUM_PATH."
    )


def generate_social_card(output_path: Path, *, quiet: bool = False) -> None:
    """Render the editable SVG in Chromium and write an optimized tagged PNG."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="surplasse-social-card-") as temporary_directory:
        temporary_root = Path(temporary_directory)
        screenshot = temporary_root / "screenshot.png"
        command = [
            str(chromium_binary()),
            "--headless",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-gpu",
            "--disable-sync",
            "--force-color-profile=srgb",
            "--force-device-scale-factor=1",
            "--force-prefers-reduced-motion=reduce",
            "--hide-scrollbars",
            "--incognito",
            "--metrics-recording-only",
            "--no-first-run",
            "--run-all-compositor-stages-before-draw",
            "--window-size=1200,630",
            f"--screenshot={screenshot}",
            SOCIAL_CARD_SOURCE.as_uri(),
        ]
        try:
            result = subprocess.run(
                command,
                check=False,
                stderr=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                timeout=60,
            )
        except subprocess.TimeoutExpired:
            raise SystemExit("Chromium social-card render timed out.") from None
        if result.returncode != 0 or not screenshot.is_file():
            raise SystemExit("Chromium social-card render failed.")

        with Image.open(screenshot) as rendered:
            rendered.load()
            if rendered.size != SOCIAL_CARD_SIZE:
                raise SystemExit(
                    f"Invalid social-card render size: {rendered.size}, "
                    f"expected {SOCIAL_CARD_SIZE}."
                )
            optimized = rendered.convert("RGB")
            metadata = PngImagePlugin.PngInfo()
            metadata.add_text(SOCIAL_CARD_DIGEST_KEY, social_card_source_digest())
            metadata.add_text(SOCIAL_CARD_URL_KEY, SOCIAL_CARD_URL)
            optimized.save(
                output_path,
                format="PNG",
                optimize=True,
                compress_level=9,
                pnginfo=metadata,
            )
    if not quiet:
        relative_output = output_path.relative_to(ROOT)
        print(f"wrote {relative_output}  ({SOCIAL_CARD_SIZE[0]}x{SOCIAL_CARD_SIZE[1]})")


def validate_social_card_source() -> list[str]:
    """Validate the editable source contract without needing a browser."""
    errors: list[str] = []
    try:
        root = ET.parse(SOCIAL_CARD_SOURCE).getroot()
    except (ET.ParseError, OSError) as error:
        return [f"invalid SVG source: {error}"]

    expected_root = {
        "width": str(SOCIAL_CARD_SIZE[0]),
        "height": str(SOCIAL_CARD_SIZE[1]),
        "viewBox": f"0 0 {SOCIAL_CARD_SIZE[0]} {SOCIAL_CARD_SIZE[1]}",
    }
    for name, expected in expected_root.items():
        if root.attrib.get(name) != expected:
            errors.append(f"SVG {name} must be {expected}")

    svg_namespace = "{http://www.w3.org/2000/svg}"
    images = root.findall(f".//{svg_namespace}image")
    image_references = {image.attrib.get("href", "") for image in images}
    required_references = {
        "surplasse-logo-horizontal.svg",
        "illustrations/service-line.svg",
    }
    if image_references != required_references or len(images) != len(required_references):
        errors.append("SVG must reuse only the canonical logo and product-flow illustration")
    logo = next(
        (image for image in images if image.attrib.get("href") == "surplasse-logo-horizontal.svg"),
        None,
    )
    if logo is not None and logo.attrib.get("preserveAspectRatio") != "xMinYMid meet":
        errors.append("SVG must preserve the canonical horizontal logo proportions")
    if any("://" in reference or reference.startswith("//") for reference in image_references):
        errors.append("SVG image references must remain local")

    forbidden_elements = ("filter", "foreignObject", "linearGradient", "radialGradient", "script")
    for element in forbidden_elements:
        if root.find(f".//{svg_namespace}{element}") is not None:
            errors.append(f"SVG must not contain {element}")
    return errors


def validate_social_card_raster() -> list[str]:
    """Validate dimensions, source coupling, canonical URL and file budget."""
    errors: list[str] = []
    if not SOCIAL_CARD_RASTER.is_file():
        return ["missing brand/surplasse-social-card.png"]
    try:
        with Image.open(SOCIAL_CARD_RASTER) as image:
            image.load()
            if image.format != "PNG":
                errors.append("social card must be a PNG")
            if image.size != SOCIAL_CARD_SIZE:
                errors.append(
                    f"social card must be {SOCIAL_CARD_SIZE[0]}x{SOCIAL_CARD_SIZE[1]}"
                )
            if image.info.get(SOCIAL_CARD_DIGEST_KEY) != social_card_source_digest():
                errors.append("social card is stale against its editable sources")
            if image.info.get(SOCIAL_CARD_URL_KEY) != SOCIAL_CARD_URL:
                errors.append("social card has an invalid canonical URL marker")
    except OSError as error:
        errors.append(f"invalid social-card PNG: {error}")
    if SOCIAL_CARD_RASTER.stat().st_size > 500_000:
        errors.append("social card exceeds the 500 kB budget")
    return errors


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
        generate_qr_assets(generated_directory, quiet=True)
        stale = [
            name
            for name in expected_names
            if not images_have_same_pixels(
                OUT / name,
                generated_directory / name,
            )
        ]
    social_card_errors = validate_social_card_source() + validate_social_card_raster()
    if stale or social_card_errors:
        details = [*(f"stale {name}" for name in stale), *social_card_errors]
        raise SystemExit(
            "Stale brand assets: "
            + ", ".join(details)
            + ". Run npm run brand:generate."
        )
    print("Brand QR assets and product social card match their sources.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_assets()
    else:
        generate_qr_assets(OUT)
        generate_social_card(SOCIAL_CARD_RASTER)


if __name__ == "__main__":
    main()
