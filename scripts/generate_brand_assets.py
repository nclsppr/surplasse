#!/usr/bin/env python3
"""Generate Surplasse brand-derived assets (QR codes) from domain profiles.

Surplasse QR rules: rounded modules and the Surplasse mark centered.
Re-run whenever the logo or brand changes. Requires `qrcode[pil]`.

Usage: python3 scripts/generate_brand_assets.py [--check]
"""
import argparse
import re
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Optional

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brand" / "qr"
SYMBOL_SVG = ROOT / "brand" / "surplasse-symbol.svg"

INK = (24, 24, 24)
PAPER = (250, 247, 242)

SVG_PATH_TOKEN = re.compile(
    r"[MmLlCcZz]|[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?"
)
SVG_NUMBER_TOKEN = re.compile(
    r"[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?"
)
SVG_TRANSFORM_TOKEN = re.compile(r"([A-Za-z]+)\s*\(([^)]*)\)")
IDENTITY_MATRIX = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
CURVE_STEPS = 24

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


def multiply_matrices(
    first: tuple[float, float, float, float, float, float],
    second: tuple[float, float, float, float, float, float],
) -> tuple[float, float, float, float, float, float]:
    """Return the matrix applying second first, then first."""
    first_a, first_b, first_c, first_d, first_e, first_f = first
    second_a, second_b, second_c, second_d, second_e, second_f = second
    return (
        first_a * second_a + first_c * second_b,
        first_b * second_a + first_d * second_b,
        first_a * second_c + first_c * second_d,
        first_b * second_c + first_d * second_d,
        first_a * second_e + first_c * second_f + first_e,
        first_b * second_e + first_d * second_f + first_f,
    )


def apply_matrix(
    matrix: tuple[float, float, float, float, float, float],
    point: tuple[float, float],
) -> tuple[float, float]:
    """Apply an SVG affine matrix to a point."""
    a, b, c, d, e, f = matrix
    x, y = point
    return a * x + c * y + e, b * x + d * y + f


def parse_transform(
    value: Optional[str],
) -> tuple[float, float, float, float, float, float]:
    """Parse the translate, scale and matrix transforms used by brand SVGs."""
    if not value:
        return IDENTITY_MATRIX

    transform = IDENTITY_MATRIX
    for name, raw_arguments in SVG_TRANSFORM_TOKEN.findall(value):
        arguments = [float(item) for item in SVG_NUMBER_TOKEN.findall(raw_arguments)]
        if name == "translate" and len(arguments) in (1, 2):
            dx, dy = arguments[0], arguments[1] if len(arguments) == 2 else 0.0
            local = (1.0, 0.0, 0.0, 1.0, dx, dy)
        elif name == "scale" and len(arguments) in (1, 2):
            sx, sy = arguments[0], arguments[1] if len(arguments) == 2 else arguments[0]
            local = (sx, 0.0, 0.0, sy, 0.0, 0.0)
        elif name == "matrix" and len(arguments) == 6:
            local = tuple(arguments)
        else:
            raise ValueError(f"Unsupported SVG transform: {name}({raw_arguments})")
        transform = multiply_matrices(transform, local)
    return transform


def parse_path(data: str) -> list[list[tuple[float, float]]]:
    """Parse the move, line, cubic and close commands in the supplied symbol."""
    tokens = SVG_PATH_TOKEN.findall(data)
    index = 0
    command: Optional[str] = None
    point = (0.0, 0.0)
    start: Optional[tuple[float, float]] = None
    contour: list[tuple[float, float]] = []
    contours: list[list[tuple[float, float]]] = []

    def read_values(count: int) -> list[float]:
        nonlocal index
        if index + count > len(tokens) or any(
            len(token) == 1 and token.isalpha()
            for token in tokens[index:index + count]
        ):
            raise ValueError("Invalid SVG path data.")
        values = [float(token) for token in tokens[index:index + count]]
        index += count
        return values

    while index < len(tokens):
        token = tokens[index]
        if len(token) == 1 and token.isalpha():
            command = token
            index += 1
        if command is None:
            raise ValueError("SVG path data starts without a command.")

        if command in "Mm":
            x, y = read_values(2)
            if command == "m":
                x += point[0]
                y += point[1]
            if contour:
                contours.append(contour)
            point = (x, y)
            start = point
            contour = [point]
            command = "l" if command == "m" else "L"
        elif command in "Ll":
            x, y = read_values(2)
            if command == "l":
                x += point[0]
                y += point[1]
            point = (x, y)
            contour.append(point)
        elif command in "Cc":
            values = read_values(6)
            control_one = (values[0], values[1])
            control_two = (values[2], values[3])
            end = (values[4], values[5])
            if command == "c":
                control_one = (control_one[0] + point[0], control_one[1] + point[1])
                control_two = (control_two[0] + point[0], control_two[1] + point[1])
                end = (end[0] + point[0], end[1] + point[1])
            start_point = point
            for step in range(1, CURVE_STEPS + 1):
                progress = step / CURVE_STEPS
                inverse_progress = 1 - progress
                contour.append((
                    inverse_progress ** 3 * start_point[0]
                    + 3 * inverse_progress ** 2 * progress * control_one[0]
                    + 3 * inverse_progress * progress ** 2 * control_two[0]
                    + progress ** 3 * end[0],
                    inverse_progress ** 3 * start_point[1]
                    + 3 * inverse_progress ** 2 * progress * control_one[1]
                    + 3 * inverse_progress * progress ** 2 * control_two[1]
                    + progress ** 3 * end[1],
                ))
            point = end
        elif command in "Zz":
            if contour and start is not None:
                if contour[-1] != start:
                    contour.append(start)
                contours.append(contour)
            contour = []
            start = None
            command = None
        else:
            raise ValueError(f"Unsupported SVG path command: {command}")

    if contour:
        contours.append(contour)
    return contours


def parse_color(value: Optional[str]) -> Optional[tuple[int, int, int]]:
    """Return a supported hexadecimal SVG fill color."""
    if not value or value == "none":
        return None
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        return tuple(int(value[position:position + 2], 16) for position in (1, 3, 5))
    raise ValueError(f"Unsupported SVG fill color: {value}")


def render_path(
    canvas: Image.Image,
    data: str,
    matrix: tuple[float, float, float, float, float, float],
    color: tuple[int, int, int],
    fill_rule: str,
) -> None:
    """Rasterize one filled SVG path onto the high-resolution canvas."""
    mask = Image.new("1", canvas.size, 0)
    for contour in parse_path(data):
        transformed = [apply_matrix(matrix, point) for point in contour]
        contour_mask = Image.new("1", canvas.size, 0)
        ImageDraw.Draw(contour_mask).polygon(transformed, fill=1)
        if fill_rule == "evenodd":
            mask = ImageChops.logical_xor(mask, contour_mask)
        else:
            mask = ImageChops.logical_or(mask, contour_mask)
    canvas.paste((*color, 255), (0, 0), mask)


def local_name(element: ElementTree.Element) -> str:
    """Remove the namespace prefix from an XML tag."""
    return element.tag.rsplit("}", maxsplit=1)[-1]


def render_symbol_element(
    canvas: Image.Image,
    element: ElementTree.Element,
    matrix: tuple[float, float, float, float, float, float],
    inherited_fill: Optional[str] = None,
) -> None:
    """Render the supported subset of the canonical Surplasse symbol SVG."""
    transform = multiply_matrices(matrix, parse_transform(element.get("transform")))
    fill = element.get("fill", inherited_fill)
    if local_name(element) == "path":
        color = parse_color(fill)
        if color is not None:
            data = element.get("d")
            if not data:
                raise ValueError("SVG path is missing data.")
            render_path(
                canvas,
                data,
                transform,
                color,
                element.get("fill-rule", "nonzero"),
            )
    for child in element:
        render_symbol_element(canvas, child, transform, fill)


def render_symbol(size: int) -> Image.Image:
    """Rasterize the supplied vector symbol with deterministic Pillow output."""
    root = ElementTree.parse(SYMBOL_SVG).getroot()
    raw_view_box = root.get("viewBox")
    if not raw_view_box:
        raise ValueError(f"Missing viewBox in {SYMBOL_SVG}.")
    view_box = [float(value) for value in SVG_NUMBER_TOKEN.findall(raw_view_box)]
    if len(view_box) != 4:
        raise ValueError(f"Invalid viewBox in {SYMBOL_SVG}.")
    left, top, width, height = view_box
    render_size = size * 4
    scale = min(render_size / width, render_size / height)
    matrix = (
        scale,
        0.0,
        0.0,
        scale,
        (render_size - width * scale) / 2 - left * scale,
        (render_size - height * scale) / 2 - top * scale,
    )
    canvas = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    render_symbol_element(canvas, root, matrix, root.get("fill"))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def make_center_mark(size: int = 280) -> Image.Image:
    """Render the canonical compact Surplasse symbol for QR centers."""
    render_size = size * 4
    img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    inset = round(render_size * 0.035)
    d.rounded_rectangle(
        [inset, inset, render_size - inset, render_size - inset],
        radius=round(render_size * 0.19),
        fill=PAPER,
    )
    symbol = render_symbol(round(render_size * 0.68))
    offset = ((render_size - symbol.width) // 2, (render_size - symbol.height) // 2)
    img.alpha_composite(symbol, offset)
    return img.resize((size, size), Image.Resampling.LANCZOS)


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
