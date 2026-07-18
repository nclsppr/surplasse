#!/usr/bin/env bash
# Breaking-change check of the contract against its last pushed version
# (docs/developpement/conventions-api.md). Uses oasdiff, a Go binary absent
# from npm: the pinned release is downloaded once into node_modules/.cache.
# CI runs the same check through the official oasdiff GitHub action.
set -euo pipefail

OASDIFF_VERSION="1.23.0"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE_DIR="$ROOT/node_modules/.cache/surplasse/oasdiff-$OASDIFF_VERSION"
BIN="$CACHE_DIR/oasdiff"

if ! [ -x "$BIN" ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-*) ASSET="oasdiff_${OASDIFF_VERSION}_darwin_all.tar.gz" ;;
    Linux-aarch64) ASSET="oasdiff_${OASDIFF_VERSION}_linux_arm64.tar.gz" ;;
    Linux-x86_64) ASSET="oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz" ;;
    *) echo "Unsupported platform $(uname -s)-$(uname -m); install oasdiff manually." >&2; exit 1 ;;
  esac
  mkdir -p "$CACHE_DIR"
  curl -sSfL "https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/${ASSET}" \
    | tar -xz -C "$CACHE_DIR" oasdiff
fi

# Local runs compare against origin/main; CI passes OASDIFF_BASE_REF=HEAD^
# (on main, origin/main is already the pushed commit).
BASE_REF="${OASDIFF_BASE_REF:-origin/main}"
git -C "$ROOT" rev-parse --verify --quiet "$BASE_REF" >/dev/null || BASE_REF="HEAD"
BASE_FILE="$(mktemp)"
HEAD_FILE="$(mktemp)"
trap 'rm -f "$BASE_FILE" "$HEAD_FILE"' EXIT
git -C "$ROOT" show "$BASE_REF:api/openapi.yaml" > "$BASE_FILE" 2>/dev/null || {
  echo "No previous version of api/openapi.yaml on $BASE_REF; nothing to compare."
  exit 0
}

# x-draft blocks are ignored by the compatibility check (conventions-api.md):
# both sides are filtered before diffing.
node "$ROOT/scripts/api/filter.mjs" "$BASE_FILE" "$BASE_FILE"
node "$ROOT/scripts/api/filter.mjs" "$ROOT/api/openapi.yaml" "$HEAD_FILE"

"$BIN" breaking --fail-on WARN "$BASE_FILE" "$HEAD_FILE"
echo "No breaking change against $BASE_REF (drafts excluded)."
