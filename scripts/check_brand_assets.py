#!/usr/bin/env python3
"""PostToolUse hook: remind to regenerate brand-derived assets when the logo changes.

When brand/logo.svg is edited, the QR codes and other logo-derived assets are
stale. This hook surfaces a reminder (exit 2) to run the generator. It does not
modify anything itself.
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

if Path(file_path).as_posix().endswith("brand/logo.svg"):
    sys.stderr.write(
        "Le logo Surplasse (brand/logo.svg) a change. Les assets derives sont "
        "peut-etre perimes : regenere-les avec\n"
        "    python3 scripts/generate_brand_assets.py\n"
        "puis verifie brand/qr/ (QR a bords arrondis, logo centre).\n"
    )
    sys.exit(2)

sys.exit(0)
