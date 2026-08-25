#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SMOKE_PORT="18787"
SMOKE_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/surplasse-cloudflare-smoke.XXXXXX")"
WORKER_PID=""

cleanup() {
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
  case "$SMOKE_TEMP_DIR" in
    */surplasse-cloudflare-smoke.*) rm -r -- "$SMOKE_TEMP_DIR" ;;
    *) printf 'Refusing to remove unexpected smoke directory: %s\n' "$SMOKE_TEMP_DIR" >&2 ;;
  esac
}
trap cleanup EXIT

"${CLOUDFLARE_ROOT}/node_modules/.bin/wrangler" dev \
  --ip 127.0.0.1 \
  --port "$SMOKE_PORT" \
  --local-protocol https \
  --log-level error \
  >"${SMOKE_TEMP_DIR}/wrangler.log" 2>&1 &
WORKER_PID="$!"

for _ in {1..40}; do
  if curl --insecure --fail --silent \
    --resolve "surplasse.com:${SMOKE_PORT}:127.0.0.1" \
    "https://surplasse.com:${SMOKE_PORT}/.well-known/surplasse-edge" \
    >/dev/null; then
    break
  fi
  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    cat "${SMOKE_TEMP_DIR}/wrangler.log" >&2
    exit 1
  fi
  sleep 0.25
done

probe() {
  local hostname="$1"
  local route_path="$2"
  local expected_status="$3"
  local label="$4"
  local actual_status

  actual_status="$(curl --insecure --silent --show-error \
    --output "${SMOKE_TEMP_DIR}/${label}.body" \
    --dump-header "${SMOKE_TEMP_DIR}/${label}.headers" \
    --write-out '%{http_code}' \
    --resolve "${hostname}:${SMOKE_PORT}:127.0.0.1" \
    "https://${hostname}:${SMOKE_PORT}${route_path}")"

  if [[ "$actual_status" != "$expected_status" ]]; then
    printf '%s returned %s, expected %s\n' "$label" "$actual_status" "$expected_status" >&2
    cat "${SMOKE_TEMP_DIR}/${label}.headers" >&2
    cat "${SMOKE_TEMP_DIR}/${label}.body" >&2
    exit 1
  fi
}

probe "surplasse.com" "/" "200" "apex"
probe "surplasse.com" "/brand/surplasse-symbol.svg" "200" "onboarding-brand"
probe "surplasse.com" "/brand/fonts/README.md" "404" "onboarding-unlisted"
probe "www.surplasse.com" "/test?source=smoke" "308" "www"
probe "dashboard.surplasse.com" "/route-interne" "200" "dashboard"
probe "docs.surplasse.com" "/architecture" "200" "docs"
probe "bistrot-test.surplasse.com" "/route-interne" "200" "tenant"
probe "reports.surplasse.com" "/" "503" "reserved"
probe "api.surplasse.com" "/q%252Fhealth" "404" "management"
probe "surplasse.com" "/.well-known/surplasse-manifest.json" "200" "manifest"

grep -Fqi "cache-control: no-store" "${SMOKE_TEMP_DIR}/manifest.headers"
grep -Fqi "content-security-policy:" "${SMOKE_TEMP_DIR}/dashboard.headers"
grep -Fqi "https://js.stripe.com" "${SMOKE_TEMP_DIR}/tenant.headers"
grep -Fqi "permissions-policy: camera=(), microphone=(), geolocation=()" \
  "${SMOKE_TEMP_DIR}/apex.headers"

printf 'Cloudflare local runtime smoke passed.\n'
