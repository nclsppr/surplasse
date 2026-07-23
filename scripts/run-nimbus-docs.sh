#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMMAND="${1:-}"
case "$COMMAND" in
  build | check | sync) ;;
  *)
    printf 'Error: usage: scripts/run-nimbus-docs.sh <build|check|sync>\n' >&2
    exit 1
    ;;
esac
shift

[[ -n "${DOCS_URL:-}" ]] || {
  printf 'Error: DOCS_URL must come from a Surplasse domain profile.\n' >&2
  exit 1
}

export NIMBUS_SITE_ORIGIN="${DOCS_URL%/}"
export NIMBUS_BASE_PATH="/_experiments/nimbus-docs"

exec npm --prefix "${REPOSITORY_ROOT}/docs-nimbus" run "$COMMAND" -- "$@"
