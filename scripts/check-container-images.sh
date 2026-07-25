#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck disable=SC1091
source "${REPOSITORY_ROOT}/config/deployment/images.env"

check_dockerfile() {
  local dockerfile="$1"
  shift
  docker build \
    --check \
    --file "${REPOSITORY_ROOT}/${dockerfile}" \
    "$@" \
    "$REPOSITORY_ROOT"
}

check_dockerfile infra/images/backend.Dockerfile \
  --build-arg "TEMURIN_BUILD_IMAGE=${TEMURIN_BUILD_IMAGE}" \
  --build-arg "TEMURIN_RUNTIME_IMAGE=${TEMURIN_RUNTIME_IMAGE}" \
  --build-arg DOMAIN_PROFILE=production

check_dockerfile infra/images/caddy.Dockerfile \
  --build-arg "CADDY_BUILDER_IMAGE=${CADDY_BUILDER_IMAGE}" \
  --build-arg "CADDY_RUNTIME_IMAGE=${CADDY_IMAGE}" \
  --build-arg CADDY_DNS_MODULE=github.com/caddy-dns/example@v0.0.0

check_dockerfile infra/images/docs.Dockerfile \
  --build-arg "NODE_IMAGE=${NODE_IMAGE}" \
  --build-arg "NGINX_IMAGE=${NGINX_IMAGE}" \
  --build-arg NIMBUS_SITE_ORIGIN=https://docs.example.invalid \
  --build-arg NIMBUS_BASE_PATH=/_experiments/nimbus-docs

for frontend_name in commande dashboard; do
  check_dockerfile infra/images/frontend.Dockerfile \
    --build-arg "NODE_IMAGE=${NODE_IMAGE}" \
    --build-arg "NGINX_IMAGE=${NGINX_IMAGE}" \
    --build-arg DOMAIN_PROFILE=production \
    --build-arg "FRONTEND_NAME=${frontend_name}"
done

for frontend_name in onboarding2 commande2 dashboard2; do
  check_dockerfile infra/images/frontend2.Dockerfile \
    --build-arg "NODE_IMAGE=${NODE_IMAGE}" \
    --build-arg "NGINX_IMAGE=${NGINX_IMAGE}" \
    --build-arg DOMAIN_PROFILE=development \
    --build-arg "FRONTEND_NAME=${frontend_name}"
done

for domain_profile in development production; do
  check_dockerfile infra/images/onboarding.Dockerfile \
    --build-arg "NODE_IMAGE=${NODE_IMAGE}" \
    --build-arg "NGINX_IMAGE=${NGINX_IMAGE}" \
    --build-arg "DOMAIN_PROFILE=${domain_profile}"
done
