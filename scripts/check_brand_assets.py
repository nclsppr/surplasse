#!/usr/bin/env python3
"""PostToolUse hook: remind to regenerate assets when a brand source changes.

When a canonical SVG is edited, the QR codes and other logo-derived assets may
be stale. This hook surfaces a reminder (exit 2) to run the generator. It does
not modify anything itself.
"""
import json
import sys
from pathlib import Path

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

file_path = (data.get("tool_input") or {}).get("file_path", "") or ""
if not file_path:
    sys.exit(0)

BRAND_SOURCES = {
    "brand/logo.svg",
    "brand/mark.svg",
    "brand/mark-orange.svg",
    "brand/mark-mono.svg",
}

if any(Path(file_path).as_posix().endswith(path) for path in BRAND_SOURCES):
    sys.stderr.write(
        "Une source du logo Surplasse a change. Les assets derives sont "
        "peut-etre perimes : regenere-les avec\n"
        "    python3 scripts/generate_brand_assets.py\n"
        "puis verifie brand/qr/ (QR a bords arrondis, logo centre).\n"
    )
    sys.exit(2)

sys.exit(0)
