#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPOSITORY_ROOT"

if npm run docs:build; then
  exit 0
fi

printf 'Retype a échoué une première fois. Nettoyage de docs-site et nouvelle tentative détaillée.\n' >&2
rm -rf -- "$REPOSITORY_ROOT/docs-site"
npm run docs:build -- --verbose
