#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPOSITORY_ROOT
# shellcheck disable=SC1091
source "$REPOSITORY_ROOT/config/deployment/images.env"
: "${CADDY_IMAGE:?CADDY_IMAGE is required}"

readonly TEST_ID="$$-${RANDOM}"
readonly APP_NETWORK="surplasse-pilot-app-${TEST_ID}"
readonly DB_NETWORK="surplasse-pilot-db-${TEST_ID}"
readonly TARGET_CONTAINER="surplasse-pilot-egress-${TEST_ID}"
WORK_DIRECTORY="$(mktemp -d)"
readonly WORK_DIRECTORY
readonly OVERRIDE_FILE="$WORK_DIRECTORY/compose.override.yaml"
readonly MANIFEST_FILE="$WORK_DIRECTORY/pilot-bootstrap.json"
readonly DATABASE_FILE="$WORK_DIRECTORY/database-password"
readonly STRIPE_FILE="$WORK_DIRECTORY/stripe-key"

cleanup() {
  local command_exit=$?
  docker container rm --force -- "$TARGET_CONTAINER" >/dev/null 2>&1 || true
  docker network rm -- "$DB_NETWORK" >/dev/null 2>&1 || true
  docker network rm -- "$APP_NETWORK" >/dev/null 2>&1 || true
  rm -f -- "$OVERRIDE_FILE" "$MANIFEST_FILE" "$DATABASE_FILE" "$STRIPE_FILE"
  rmdir -- "$WORK_DIRECTORY" 2>/dev/null || true
  exit "$command_exit"
}
trap cleanup EXIT HUP INT TERM

printf '{}\n' >"$MANIFEST_FILE"
printf 'not-used\n' >"$DATABASE_FILE"
printf 'not-used\n' >"$STRIPE_FILE"
chmod 0444 "$MANIFEST_FILE" "$DATABASE_FILE" "$STRIPE_FILE"

cat >"$OVERRIDE_FILE" <<'YAML'
services:
  pilot-bootstrap:
    image: ${CADDY_IMAGE}
    user: "0:0"
    entrypoint:
      - /bin/sh
      - -eu
      - -c
    command:
      - |
        response="$$(wget --quiet --output-document=- "http://host.docker.internal:$${PILOT_TEST_HTTP_PORT}/")"
        test "$$response" = pilot-egress-ok
        printf '%s\n' "$$response"
    environment:
      PILOT_TEST_HTTP_PORT: ${PILOT_TEST_HTTP_PORT}
    extra_hosts:
      - host.docker.internal:host-gateway
    volumes:
      - type: bind
        source: ${PILOT_TEST_MANIFEST_FILE}
        target: /run/surplasse/pilot-bootstrap.json
        read_only: true
        bind:
          create_host_path: false
networks:
  app_surplasse:
    external: true
    name: ${PILOT_TEST_APP_NETWORK}
  db_surplasse:
    external: true
    name: ${PILOT_TEST_DB_NETWORK}
secrets:
  surplasse_postgres_runtime_password:
    file: ${PILOT_TEST_DATABASE_FILE}
  surplasse_stripe_secret_key:
    file: ${PILOT_TEST_STRIPE_FILE}
YAML

docker network create "$APP_NETWORK" >/dev/null
docker network create --internal "$DB_NETWORK" >/dev/null
docker run --detach \
  --name "$TARGET_CONTAINER" \
  --publish 0.0.0.0::8080 \
  "$CADDY_IMAGE" \
  caddy respond --listen :8080 --body pilot-egress-ok >/dev/null

published_port="$(docker port "$TARGET_CONTAINER" 8080/tcp | head -n 1)"
published_port="${published_port##*:}"
readonly published_port
[[ "$published_port" =~ ^[1-9][0-9]{0,4}$ ]] || {
  printf 'Pilot bootstrap network test failed: target port was not published.\n' >&2
  exit 1
}

target_ready=false
for _ in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:$published_port/" >/dev/null 2>&1; then
    target_ready=true
    break
  fi
  sleep 1
done
[[ "$target_ready" == true ]] || {
  printf 'Pilot bootstrap network test failed: local target did not become ready.\n' >&2
  exit 1
}

export CADDY_IMAGE
export PILOT_TEST_APP_NETWORK="$APP_NETWORK"
export PILOT_TEST_DATABASE_FILE="$DATABASE_FILE"
export PILOT_TEST_DB_NETWORK="$DB_NETWORK"
export PILOT_TEST_HTTP_PORT="$published_port"
export PILOT_TEST_MANIFEST_FILE="$MANIFEST_FILE"
export PILOT_TEST_STRIPE_FILE="$STRIPE_FILE"
export SURPLASSE_AUTH_JWT_KEY_ID=pilot-network-test
export SURPLASSE_BACKEND_IMAGE="$CADDY_IMAGE"
export SURPLASSE_COMMANDE_IMAGE="$CADDY_IMAGE"
export SURPLASSE_DASHBOARD_IMAGE="$CADDY_IMAGE"
export SURPLASSE_DOCS_IMAGE="$CADDY_IMAGE"
export SURPLASSE_ONBOARDING_IMAGE="$CADDY_IMAGE"
export SURPLASSE_SMTP_HOST=smtp.invalid

network_output="$(
  docker compose \
    --project-name "surplasse-pilot-network-$TEST_ID" \
    --file "$REPOSITORY_ROOT/deployment/vps/compose.yaml" \
    --file "$OVERRIDE_FILE" \
    --profile pilot-bootstrap \
    run --rm --no-deps pilot-bootstrap
)"
[[ "$network_output" == *pilot-egress-ok* ]] || {
  printf 'Pilot bootstrap network test failed: egress did not use the application network.\n' >&2
  exit 1
}

printf 'Pilot bootstrap network valid: the Compose job reached egress while joined to the internal database network.\n'
