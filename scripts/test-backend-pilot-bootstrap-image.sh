#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly BACKEND_IMAGE="${1:-}"
[[ -n "$BACKEND_IMAGE" && $# -eq 1 ]] || {
  printf 'Usage: %s <backend-image>\n' "${0##*/}" >&2
  exit 64
}

WORK_DIRECTORY="$(mktemp -d)"
readonly WORK_DIRECTORY
readonly MANIFEST_FILE="$WORK_DIRECTORY/pilot-bootstrap.json"
readonly DATABASE_FILE="$WORK_DIRECTORY/database-password"
readonly STRIPE_FILE="$WORK_DIRECTORY/stripe-key"

cleanup() {
  local command_exit=$?
  rm -f -- "$MANIFEST_FILE" "$DATABASE_FILE" "$STRIPE_FILE"
  rmdir -- "$WORK_DIRECTORY" 2>/dev/null || true
  exit "$command_exit"
}
trap cleanup EXIT HUP INT TERM

printf '{}\n' >"$MANIFEST_FILE"
printf 'not-used\n' >"$DATABASE_FILE"
printf 'not-used\n' >"$STRIPE_FILE"
chmod 0444 "$MANIFEST_FILE" "$DATABASE_FILE" "$STRIPE_FILE"

readonly -a FIXED_ENVIRONMENT=(
  --env DEPLOYMENT_PROFILE=production
  --env PILOT_BOOTSTRAP_MANIFEST_FILE=/run/surplasse/pilot-bootstrap.json
  --env QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://postgresql:5432/surplasse
  --env QUARKUS_DATASOURCE_PASSWORD_FILE=/run/secrets/surplasse_postgres_runtime_password
  --env QUARKUS_DATASOURCE_USERNAME=surplasse_runtime
  --env STRIPE_LIVE_MODE=false
  --env STRIPE_SECRET_KEY_FILE=/run/secrets/surplasse_stripe_secret_key
  --env SURPLASSE_PRODUCTION_RELEASE_MODE=testers
)

set +e
direct_output="$(
  docker run --rm \
    "${FIXED_ENVIRONMENT[@]}" \
    --env STRIPE_SECRET_KEY=forbidden-direct-value \
    --entrypoint /opt/surplasse/scripts/backend-pilot-bootstrap.sh \
    "$BACKEND_IMAGE" status 2>&1
)"
direct_exit=$?
set -e
[[ "$direct_exit" -eq 64 ]] || {
  printf 'Pilot bootstrap image test failed: direct secret input was not refused.\n' >&2
  exit 1
}
[[ "$direct_output" != *forbidden-direct-value* ]] || {
  printf 'Pilot bootstrap image test failed: a rejected input was printed.\n' >&2
  exit 1
}

set +e
classpath_output="$(
  docker run --rm \
    "${FIXED_ENVIRONMENT[@]}" \
    --mount "type=bind,source=$MANIFEST_FILE,target=/run/surplasse/pilot-bootstrap.json,readonly" \
    --mount "type=bind,source=$DATABASE_FILE,target=/run/secrets/surplasse_postgres_runtime_password,readonly" \
    --mount "type=bind,source=$STRIPE_FILE,target=/run/secrets/surplasse_stripe_secret_key,readonly" \
    --entrypoint /opt/surplasse/scripts/backend-pilot-bootstrap.sh \
    "$BACKEND_IMAGE" status 2>&1
)"
classpath_exit=$?
set -e
[[ "$classpath_exit" -eq 64 ]] || {
  printf 'Pilot bootstrap image test failed: unsafe fixture metadata was not refused.\n' >&2
  exit 1
}
[[ "$classpath_output" == *"Pilot bootstrap refused: The pilot manifest has unsafe metadata."* ]] || {
  printf 'Pilot bootstrap image test failed: the standalone Java command did not run.\n' >&2
  exit 1
}

printf 'Backend pilot bootstrap image valid: bounded runner and standalone command are packaged.\n'
