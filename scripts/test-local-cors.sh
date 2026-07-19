#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_DIRECTORY="$(mktemp -d)"
CONTAINER_NAME="surplasse-cors-test-${RANDOM}-$$"

cleanup() {
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TEST_DIRECTORY"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj "/CN=surplasse.test" \
  -addext "subjectAltName=DNS:surplasse.test,DNS:*.surplasse.test" \
  -keyout "${TEST_DIRECTORY}/key.pem" \
  -out "${TEST_DIRECTORY}/cert.pem" >/dev/null 2>&1

sed 's/^\tbind 127\.0\.0\.1$/\tbind 0.0.0.0/' \
  "${REPOSITORY_ROOT}/infra/local/Caddyfile" >"${TEST_DIRECTORY}/Caddyfile"
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
  --env APP_BASE_DOMAIN=surplasse.test \
  --env APP_BASE_URL=https://surplasse.test \
  --env ONBOARDING_URL=https://surplasse.test \
  --env DASHBOARD_URL=https://dashboard.surplasse.test \
  --env SURPLASSE_LOCAL_CERT_FILE=/test/cert.pem \
  --env SURPLASSE_LOCAL_KEY_FILE=/test/key.pem \
  --env SURPLASSE_DASHBOARD_HOST=dashboard.surplasse.test \
  --env SURPLASSE_API_HOST=api.surplasse.test \
  --env SURPLASSE_LOCAL_CONTROL_HOST=local.surplasse.test \
  --env SURPLASSE_DOCS_HOST=docs.surplasse.test \
  --env SURPLASSE_MAILPIT_HOST=mail.surplasse.test \
  --volume "${TEST_DIRECTORY}:/test:ro" \
  caddy:2.10.2 \
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
    --resolve "api.surplasse.test:${PUBLISHED_PORT}:127.0.0.1" \
    --header "Origin: ${origin}" \
    --dump-header - \
    --output /dev/null \
    "https://api.surplasse.test:${PUBLISHED_PORT}/cors-probe" | tr -d '\r'
}

wait_for_proxy() {
  local attempt
  for attempt in {1..40}; do
    if request_headers "https://dashboard.surplasse.test" >/dev/null 2>&1; then
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

DASHBOARD_HEADERS="$(request_headers "https://dashboard.surplasse.test")"
assert_header "$DASHBOARD_HEADERS" 'Access-Control-Allow-Origin: https://dashboard.surplasse.test'
assert_header "$DASHBOARD_HEADERS" 'Access-Control-Allow-Credentials: true'

ONBOARDING_HEADERS="$(request_headers "https://surplasse.test")"
assert_header "$ONBOARDING_HEADERS" 'Access-Control-Allow-Origin: https://surplasse.test'
assert_header "$ONBOARDING_HEADERS" 'Access-Control-Allow-Credentials: true'

PUBLIC_HEADERS="$(request_headers "https://demo.surplasse.test")"
assert_header "$PUBLIC_HEADERS" 'Access-Control-Allow-Origin: https://demo.surplasse.test'
assert_no_credentials "$PUBLIC_HEADERS"

HOSTILE_HEADERS="$(request_headers "https://attacker.example")"
assert_no_credentials "$HOSTILE_HEADERS"

printf 'CORS proxy policy verified for Dashboard, Onboarding, public and foreign origins.\n'
