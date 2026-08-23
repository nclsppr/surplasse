#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly BACKEND_IMAGE="${1:-}"
[[ -n "$BACKEND_IMAGE" && $# -eq 1 ]] || {
  printf 'Usage: %s <backend-image>\n' "${0##*/}" >&2
  exit 64
}

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPOSITORY_ROOT
# The PostgreSQL image is the immutable production-compatible test subject.
# shellcheck disable=SC1091
source "$REPOSITORY_ROOT/config/deployment/images.env"
: "${POSTGRES_IMAGE:?POSTGRES_IMAGE is required}"

readonly TEST_ID="$$-${RANDOM}"
readonly NETWORK_NAME="surplasse-migration-test-${TEST_ID}"
readonly DATABASE_CONTAINER="surplasse-migration-db-${TEST_ID}"
WORK_DIRECTORY="$(mktemp -d)"
readonly WORK_DIRECTORY
readonly DATABASE_SECRET_FILE="$WORK_DIRECTORY/database-secret"

cleanup() {
  local status=$?
  docker container rm --force -- "$DATABASE_CONTAINER" >/dev/null 2>&1 || true
  docker network rm -- "$NETWORK_NAME" >/dev/null 2>&1 || true
  rm -f -- "$DATABASE_SECRET_FILE"
  rmdir -- "$WORK_DIRECTORY" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

printf 'EXAMPLE\n' >"$DATABASE_SECRET_FILE"
chmod 0444 "$DATABASE_SECRET_FILE"

docker network create "$NETWORK_NAME" >/dev/null
docker run --detach \
  --name "$DATABASE_CONTAINER" \
  --network "$NETWORK_NAME" \
  --network-alias postgresql \
  --env POSTGRES_DB=surplasse \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=EXAMPLE \
  "$POSTGRES_IMAGE" >/dev/null

database_ready=false
for _ in $(seq 1 60); do
  if docker exec "$DATABASE_CONTAINER" \
    pg_isready --quiet --username postgres --dbname surplasse; then
    database_ready=true
    break
  fi
  sleep 1
done
[[ "$database_ready" == true ]] || {
  printf 'Backend migration image test failed: PostgreSQL did not become ready.\n' >&2
  exit 1
}

docker run --rm \
  --network "$NETWORK_NAME" \
  --read-only \
  --tmpfs /tmp:size=32m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --user 10001:10001 \
  --env DEPLOYMENT_PROFILE=production \
  --env QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://postgresql:5432/surplasse \
  --env QUARKUS_DATASOURCE_USERNAME=postgres \
  --env QUARKUS_DATASOURCE_PASSWORD_FILE=/run/secrets/database-secret \
  --mount "type=bind,source=$DATABASE_SECRET_FILE,target=/run/secrets/database-secret,readonly" \
  --entrypoint /opt/surplasse/scripts/backend-migrate.sh \
  "$BACKEND_IMAGE"

migration_state="$(
  docker exec --env PGPASSWORD=EXAMPLE "$DATABASE_CONTAINER" \
    psql --username postgres --dbname surplasse --tuples-only --no-align \
      --command "SELECT count(*) FILTER (WHERE version IS NOT NULL), max(version::integer) FILTER (WHERE version IS NOT NULL), bool_and(success) FROM flyway_schema_history;"
)"
readonly migration_state
[[ "$migration_state" == "15|15|t" ]] || {
  printf 'Backend migration image test failed: unexpected Flyway state %s.\n' \
    "$migration_state" >&2
  exit 1
}

printf 'Backend migration image valid: V1 through V15 applied successfully.\n'
