#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_DIRECTORY="$(mktemp -d)"

cleanup() {
  rm -rf "$TEST_DIRECTORY"
}
trap cleanup EXIT INT TERM

backend_image='ghcr.io/nclsppr/surplasse/backend@sha256:1111111111111111111111111111111111111111111111111111111111111111'
onboarding_image='ghcr.io/nclsppr/surplasse/onboarding@sha256:2222222222222222222222222222222222222222222222222222222222222222'
commande_image='ghcr.io/nclsppr/surplasse/commande@sha256:3333333333333333333333333333333333333333333333333333333333333333'
dashboard_image='ghcr.io/nclsppr/surplasse/dashboard@sha256:4444444444444444444444444444444444444444444444444444444444444444'
docs_image='ghcr.io/nclsppr/surplasse/docs@sha256:5555555555555555555555555555555555555555555555555555555555555555'
resolved="${TEST_DIRECTORY}/compose.json"
production_release_mode="$(
  cd "$REPOSITORY_ROOT"
  node --input-type=module -e '
      import { loadProductionReleaseConfig } from "./config/deployment/load-production-release-config.mjs";
      process.stdout.write(loadProductionReleaseConfig().SURPLASSE_PRODUCTION_RELEASE_MODE);
    '
)"

case "$production_release_mode" in
  testers) expected_stripe_live_mode=false ;;
  public) expected_stripe_live_mode=true ;;
  *)
    printf 'Error: invalid versioned production release mode.\n' >&2
    exit 1
    ;;
esac

vps_compose() {
  env \
    SURPLASSE_BACKEND_IMAGE="$backend_image" \
    SURPLASSE_ONBOARDING_IMAGE="$onboarding_image" \
    SURPLASSE_COMMANDE_IMAGE="$commande_image" \
    SURPLASSE_DASHBOARD_IMAGE="$dashboard_image" \
    SURPLASSE_DOCS_IMAGE="$docs_image" \
    SURPLASSE_AUTH_JWT_KEY_ID=test-key \
    SURPLASSE_SMTP_HOST=smtp.example.invalid \
    docker compose \
      --file "${REPOSITORY_ROOT}/deployment/vps/compose.yaml" \
      --profile migration \
      "$@"
}

vps_compose config --quiet
vps_compose config --format json >"$resolved"

node - "$resolved" "$expected_stripe_live_mode" <<'NODE'
const { readFileSync } = require('node:fs');

const model = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const expectedStripeLiveMode = process.argv[3];
const serviceNames = Object.keys(model.services).sort();
const expectedServices = [
  'backend',
  'commande',
  'dashboard',
  'docs',
  'migrator',
  'onboarding',
];
if (JSON.stringify(serviceNames) !== JSON.stringify(expectedServices)) {
  throw new Error(`unexpected VPS service allowlist: ${serviceNames.join(', ')}`);
}
for (const [name, service] of Object.entries(model.services)) {
  if (service.ports || service.build) {
    throw new Error(`${name} exposes a host port or build context`);
  }
  if (!service.read_only || !service.cap_drop?.includes('ALL')) {
    throw new Error(`${name} is missing read-only or dropped-capability hardening`);
  }
  if (!service.security_opt?.includes('no-new-privileges:true')) {
    throw new Error(`${name} permits privilege escalation`);
  }
}
if (model.services.migrator.image !== model.services.backend.image) {
  throw new Error('migrator does not use the exact Backend image');
}
if (model.services.migrator.restart !== 'no') {
  throw new Error('migrator is not a one-shot service');
}
if (
  JSON.stringify(model.services.migrator.entrypoint) !==
  JSON.stringify(['/opt/surplasse/scripts/backend-migrate.sh'])
) {
  throw new Error('migrator entrypoint is not the production migration runner');
}
if (model.services.backend.environment?.QUARKUS_FLYWAY_MIGRATE_AT_START !== 'false') {
  throw new Error('Backend runtime can still migrate at start');
}
if (model.services.backend.environment?.STRIPE_LIVE_MODE !== expectedStripeLiveMode) {
  throw new Error('Backend runtime does not match the versioned production release mode');
}
if (model.services.backend.environment?.QUARKUS_DATASOURCE_USERNAME !== 'surplasse_runtime') {
  throw new Error('Backend does not use the limited runtime role');
}
if (model.services.migrator.environment?.QUARKUS_DATASOURCE_USERNAME !== 'surplasse_migrator') {
  throw new Error('migration job does not use the migrator role');
}
for (const networkName of ['app_surplasse', 'db_surplasse']) {
  const network = model.networks?.[networkName];
  if (!network || network.name !== networkName || network.external !== true) {
    throw new Error(`${networkName} is not an exact external Atlas network`);
  }
}
if (
  Object.hasOwn(model.services.migrator.networks ?? {}, 'app_surplasse') ||
  !Object.hasOwn(model.services.migrator.networks ?? {}, 'db_surplasse')
) {
  throw new Error('migrator network scope is broader than the database network');
}
const expectedSecrets = [
  'surplasse_jwt_jwks',
  'surplasse_jwt_private_key',
  'surplasse_postgres_migrator_password',
  'surplasse_postgres_runtime_password',
  'surplasse_smtp_password',
  'surplasse_smtp_username',
  'surplasse_stripe_account_webhook_secret',
  'surplasse_stripe_payment_webhook_secret',
  'surplasse_stripe_secret_key',
];
if (JSON.stringify(Object.keys(model.secrets ?? {}).sort()) !== JSON.stringify(expectedSecrets)) {
  throw new Error('VPS secret allowlist is invalid');
}
for (const [name, secret] of Object.entries(model.secrets)) {
  if (
    !secret.file?.startsWith('/etc/vps/secrets/surplasse/') ||
    Object.hasOwn(secret, 'environment')
  ) {
    throw new Error(`${name} is not an external Atlas secret file`);
  }
}
NODE

if env \
    SURPLASSE_BACKEND_IMAGE="$backend_image" \
    SURPLASSE_ONBOARDING_IMAGE="$onboarding_image" \
    SURPLASSE_COMMANDE_IMAGE="$commande_image" \
    SURPLASSE_DASHBOARD_IMAGE="$dashboard_image" \
    SURPLASSE_DOCS_IMAGE="$docs_image" \
    SURPLASSE_AUTH_JWT_KEY_ID=test-key \
    docker compose \
      --file "${REPOSITORY_ROOT}/deployment/vps/compose.yaml" \
      config --quiet >"${TEST_DIRECTORY}/missing-required.log" 2>&1; then
  printf 'Error: VPS Compose accepted a missing SMTP host.\n' >&2
  exit 1
fi

printf 'VPS application-only Compose contract is valid.\n'
