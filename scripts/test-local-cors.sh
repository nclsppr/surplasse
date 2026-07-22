#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"
surplasse_local_load_config "$REPOSITORY_ROOT"

TEST_DIRECTORY="$(mktemp -d)"
CONTAINER_NAME="surplasse-cors-test-${RANDOM}-$$"

# This versioned catalog uses simple Bash-compatible assignments.
# shellcheck disable=SC1091
source "${REPOSITORY_ROOT}/config/deployment/images.env"

cleanup() {
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TEST_DIRECTORY"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj "/CN=${APP_BASE_DOMAIN}" \
  -addext "subjectAltName=DNS:${APP_BASE_DOMAIN},DNS:*.${APP_BASE_DOMAIN}" \
  -keyout "${TEST_DIRECTORY}/key.pem" \
  -out "${TEST_DIRECTORY}/cert.pem" >/dev/null 2>&1

cp "${REPOSITORY_ROOT}/infra/caddy/Caddyfile" "${TEST_DIRECTORY}/Caddyfile"
mkdir -p "${TEST_DIRECTORY}/tls" "${TEST_DIRECTORY}/routes"
printf '%s\n' \
  'tls /test/cert.pem /test/key.pem' >"${TEST_DIRECTORY}/tls/profile.caddy"
printf '%s\n' \
  '# No environment-specific route is required by the CORS test.' >"${TEST_DIRECTORY}/routes/profile.caddy"
printf '%s\n' \
  '' \
  ':8080 {' \
  '  header Access-Control-Allow-Origin {http.request.header.Origin}' \
  '  header Access-Control-Allow-Credentials false' \
  '  respond "ok" 200' \
  '}' >>"${TEST_DIRECTORY}/Caddyfile"

docker run --detach --rm \
  --name "$CONTAINER_NAME" \
  --publish 127.0.0.1::443 \
  --tmpfs /var/run/surplasse-local \
  --env APP_BASE_DOMAIN="$APP_BASE_DOMAIN" \
  --env APP_BASE_URL="$APP_BASE_URL" \
  --env ONBOARDING_URL="$ONBOARDING_URL" \
  --env DASHBOARD_URL="$DASHBOARD_URL" \
  --env BACKEND_UPSTREAM=127.0.0.1:8080 \
  --env ONBOARDING_UPSTREAM=127.0.0.1:8080 \
  --env COMMANDE_UPSTREAM=127.0.0.1:8080 \
  --env DASHBOARD_UPSTREAM=127.0.0.1:8080 \
  --volume "${TEST_DIRECTORY}:/test:ro" \
  --volume "${TEST_DIRECTORY}/tls/profile.caddy:/etc/caddy/tls/profile.caddy:ro" \
  --volume "${TEST_DIRECTORY}/routes/profile.caddy:/etc/caddy/routes/profile.caddy:ro" \
  "$CADDY_IMAGE" \
  caddy run --config /test/Caddyfile --adapter caddyfile >/dev/null

PUBLISHED_ADDRESS="$(docker port "$CONTAINER_NAME" 443/tcp)"
PUBLISHED_PORT="${PUBLISHED_ADDRESS##*:}"
[[ "$PUBLISHED_PORT" =~ ^[0-9]+$ ]] || {
  printf 'Error: Docker returned an invalid Caddy port: %s\n' "$PUBLISHED_ADDRESS" >&2
  exit 1
}

request_headers() {
  local origin="$1"
  curl --silent --show-error --insecure \
    --resolve "${SURPLASSE_API_HOST}:${PUBLISHED_PORT}:127.0.0.1" \
    --header "Origin: ${origin}" \
    --dump-header - \
    --output /dev/null \
    "${API_URL}:${PUBLISHED_PORT}/cors-probe" | tr -d '\r'
}

wait_for_proxy() {
  local attempt
  for attempt in {1..40}; do
    if request_headers "$DASHBOARD_URL" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done
  printf 'Error: the Caddy CORS test proxy did not become ready.\n' >&2
  docker logs "$CONTAINER_NAME" >&2
  exit 1
}

assert_header() {
  local headers="$1"
  local expected="$2"
  grep -Fqi "$expected" <<<"$headers" || {
    printf 'Error: expected response header %s.\n%s\n' "$expected" "$headers" >&2
    exit 1
  }
}

assert_no_credentials() {
  local headers="$1"
  if grep -Fqi 'Access-Control-Allow-Credentials:' <<<"$headers"; then
    printf 'Error: an untrusted origin received CORS credentials.\n%s\n' "$headers" >&2
    exit 1
  fi
}

wait_for_proxy

METRICS_STATUS="$(curl --silent --show-error --insecure \
  --resolve "${SURPLASSE_API_HOST}:${PUBLISHED_PORT}:127.0.0.1" \
  --output /dev/null \
  --write-out '%{http_code}' \
  "${API_URL}:${PUBLISHED_PORT}/q/metrics")"
[[ "$METRICS_STATUS" == 404 ]] || {
  printf 'Error: the public metrics endpoint returned HTTP %s instead of 404.\n' "$METRICS_STATUS" >&2
  exit 1
}

DASHBOARD_HEADERS="$(request_headers "$DASHBOARD_URL")"
assert_header "$DASHBOARD_HEADERS" "Access-Control-Allow-Origin: ${DASHBOARD_URL}"
assert_header "$DASHBOARD_HEADERS" 'Access-Control-Allow-Credentials: true'

ONBOARDING_HEADERS="$(request_headers "$ONBOARDING_URL")"
assert_header "$ONBOARDING_HEADERS" "Access-Control-Allow-Origin: ${ONBOARDING_URL}"
assert_header "$ONBOARDING_HEADERS" 'Access-Control-Allow-Credentials: true'

DEMO_ORIGIN="${APP_SCHEME}://demo.${APP_BASE_DOMAIN}"
PUBLIC_HEADERS="$(request_headers "$DEMO_ORIGIN")"
assert_header "$PUBLIC_HEADERS" "Access-Control-Allow-Origin: ${DEMO_ORIGIN}"
assert_no_credentials "$PUBLIC_HEADERS"

HOSTILE_HEADERS="$(request_headers "https://attacker.example")"
assert_no_credentials "$HOSTILE_HEADERS"

printf 'CORS proxy policy verified for Dashboard, Onboarding, public and foreign origins.\n'
