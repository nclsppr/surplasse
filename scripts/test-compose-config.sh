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

if grep -R -E 'surplasse\.(test|com)' \
    "${REPOSITORY_ROOT}/compose.yaml" \
    "${REPOSITORY_ROOT}/compose.development.yaml" \
    "${REPOSITORY_ROOT}/compose.production.yaml" \
    "${REPOSITORY_ROOT}/config/deployment" \
    "${REPOSITORY_ROOT}/infra/caddy" \
    "${REPOSITORY_ROOT}/infra/images" \
    "${REPOSITORY_ROOT}/scripts/compose.sh"; then
  printf 'Error: a deployment source contains a hard-coded Surplasse domain.\n' >&2
  exit 1
fi

write_fixture() {
  local target="$1"
  local image_tag="${2:-0123456789abcdef0123456789abcdef01234567}"
  local dns_module="${3:-github.com/caddy-dns/example@v0.0.0}"
  local grafana_bind_address="${4:-127.0.0.1}"
  local grafana_port="${5:-3000}"
  printf '%s\n' \
    'COMPOSE_PROJECT_NAME=surplasse-config-test' \
    'IMAGE_REGISTRY=ghcr.io/example/surplasse' \
    "IMAGE_TAG=${image_tag}" \
    'COMPOSE_NETWORK_SUBNET=172.31.0.0/24' \
    'CADDY_INTERNAL_IP=172.31.0.10' \
    'CADDY_HTTP_BIND_ADDRESS=0.0.0.0' \
    'CADDY_HTTPS_BIND_ADDRESS=0.0.0.0' \
    'CADDY_HTTP_PORT=80' \
    'CADDY_HTTPS_PORT=443' \
    'POSTGRES_DB=surplasse' \
    'POSTGRES_USER=surplasse' \
    'POSTGRES_PASSWORD=test-only' \
    'STRIPE_SECRET_KEY=sk_live_test_only' \
    'STRIPE_PAYMENT_WEBHOOK_SECRET=whsec_payment_test_only' \
    'STRIPE_ACCOUNT_WEBHOOK_SECRET=whsec_account_test_only' \
    'STRIPE_LIVE_MODE=true' \
    'VITE_STRIPE_PUBLISHABLE_KEY=pk_live_test_only' \
    "AUTH_JWT_PRIVATE_KEY_FILE=${TEST_DIRECTORY}/jwt-private.pem" \
    "AUTH_JWT_JWKS_FILE=${TEST_DIRECTORY}/jwks.json" \
    'AUTH_JWT_KEY_ID=test-key' \
    'AUTH_JWT_AUDIENCE=surplasse-dashboard' \
    'SMTP_HOST=smtp.example.invalid' \
    'SMTP_PORT=587' \
    'SMTP_USERNAME=test-user' \
    'SMTP_PASSWORD=test-only' \
    'SMTP_FROM=no-reply@example.invalid' \
    'SMTP_TLS=false' \
    'SMTP_START_TLS=REQUIRED' \
    'PROMETHEUS_RETENTION_TIME=15d' \
    "GRAFANA_BIND_ADDRESS=${grafana_bind_address}" \
    "GRAFANA_PORT=${grafana_port}" \
    'GRAFANA_ADMIN_USER=test-admin' \
    'GRAFANA_ADMIN_PASSWORD=test-only' \
    'GRAFANA_SECRET_KEY=test-only-secret-key' \
    "CADDY_DNS_MODULE=${dns_module}" \
    'CADDY_DNS_PROVIDER=example' \
    'DNS_API_TOKEN=test-only' \
    'ONBOARDING_STRIPE_PILOT_ENABLED=false' \
    >"$target"
  chmod 0600 "$target"
}

expect_failure() {
  local fixture="$1"
  local expected="$2"
  shift 2
  local output_file="${TEST_DIRECTORY}/failure-$RANDOM.log"
  if SURPLASSE_SECRETS_FILE="$fixture" \
      bash "${SCRIPT_DIR}/compose.sh" production "$@" >"$output_file" 2>&1; then
    printf 'Error: expected production Compose validation to fail: %s\n' "$expected" >&2
    exit 1
  fi
  grep -Fq "$expected" "$output_file" || {
    printf 'Error: production Compose validation failed for an unexpected reason.\n' >&2
    exit 1
  }
}

valid_fixture="${TEST_DIRECTORY}/production.env"
write_fixture "$valid_fixture"
bash "${SCRIPT_DIR}/compose.sh" development config --quiet
if bash "${SCRIPT_DIR}/compose.sh" development --ansi never config --quiet \
    >"${TEST_DIRECTORY}/global-option.log" 2>&1; then
  printf 'Error: a global Compose option bypassed command detection.\n' >&2
  exit 1
fi
grep -Fq 'Docker Compose command must be the first argument' \
  "${TEST_DIRECTORY}/global-option.log"
COMPOSE_PROFILES=observability SURPLASSE_SECRETS_FILE="$valid_fixture" \
  bash "${SCRIPT_DIR}/compose.sh" production config \
  >"${TEST_DIRECTORY}/production-compose.yaml"
grep -Fq 'surplasse.com' "${TEST_DIRECTORY}/production-compose.yaml"
if grep -Fq 'surplasse.test' "${TEST_DIRECTORY}/production-compose.yaml"; then
  printf 'Error: the resolved production Compose model contains the development domain.\n' >&2
  exit 1
fi
COMPOSE_PROFILES=observability SURPLASSE_SECRETS_FILE="$valid_fixture" \
  bash "${SCRIPT_DIR}/compose.sh" production config --format json \
  >"${TEST_DIRECTORY}/production-compose.json"
node - "${TEST_DIRECTORY}/production-compose.json" <<'NODE'
const { readFileSync } = require('node:fs');

const model = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const onboarding = model.services.onboarding;
const prometheus = model.services.prometheus;
const grafana = model.services.grafana;
for (const developmentOnlyService of ['docs', 'mailpit']) {
  if (Object.hasOwn(model.services, developmentOnlyService)) {
    throw new Error(`production unexpectedly contains ${developmentOnlyService}`);
  }
}
for (const developmentOnlyUpstream of [
  'DOCS_UPSTREAM',
  'MAILPIT_UPSTREAM',
  'LOCAL_CONTROL_UPSTREAM',
  'LOCAL_CONTROL_TOKEN',
  'GRAFANA_UPSTREAM',
]) {
  if (Object.hasOwn(model.services.edge.environment ?? {}, developmentOnlyUpstream)) {
    throw new Error(`production Caddy unexpectedly receives ${developmentOnlyUpstream}`);
  }
}
const forbiddenRuntimeVariables = [
  'ONBOARDING_STRIPE_PILOT_ENABLED',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_CONNECT_PILOT_ACCOUNT_ID',
  'STRIPE_CONNECT_PILOT_ESTABLISHMENT_NAME',
];
for (const variableName of forbiddenRuntimeVariables) {
  if (Object.hasOwn(onboarding.environment ?? {}, variableName)) {
    throw new Error(`production Onboarding unexpectedly receives ${variableName}`);
  }
}
if (onboarding.environment?.DEPLOYMENT_PROFILE !== 'production') {
  throw new Error('production Onboarding does not receive the production profile');
}
if (!onboarding.healthcheck?.test?.includes('wget')) {
  throw new Error('production Onboarding does not use the NGINX healthcheck');
}
if (model.services.edge.environment?.ONBOARDING_UPSTREAM !== 'onboarding:8080') {
  throw new Error('production Caddy does not target the NGINX Onboarding port');
}
const edgeHealthcheck = model.services.edge.healthcheck?.test?.join(' ') ?? '';
if (
  !edgeHealthcheck.includes('caddy validate') ||
  !edgeHealthcheck.includes('/.well-known/surplasse-edge')
) {
  throw new Error('production Caddy does not validate configuration and serve its HTTPS identity');
}
if (!model.services.edge.networks?.default?.aliases?.includes('surplasse.com')) {
  throw new Error('production Caddy cannot resolve its public apex to the edge container');
}
if (!prometheus || !grafana) {
  throw new Error('production observability profile does not include Prometheus and Grafana');
}
if (!Object.hasOwn(model.services.backend.networks ?? {}, 'observability') || model.networks?.observability?.internal !== true) {
  throw new Error('Backend and monitoring do not share the isolated observability network');
}
for (const serviceName of ['edge', 'backend', 'onboarding', 'commande', 'dashboard']) {
  const dependencies = Object.keys(model.services[serviceName].depends_on ?? {});
  if (dependencies.includes('prometheus') || dependencies.includes('grafana')) {
    throw new Error(`${serviceName} unexpectedly depends on observability`);
  }
}
if (grafana.depends_on || prometheus.depends_on) {
  throw new Error('observability services unexpectedly have startup dependencies');
}
if (prometheus.ports) {
  throw new Error('Prometheus is unexpectedly published on the host');
}
if (grafana.ports?.[0]?.host_ip !== '127.0.0.1' || grafana.ports?.[0]?.target !== 3000) {
  throw new Error('production Grafana is not bound to a private loopback port');
}
if (grafana.environment?.GF_AUTH_ANONYMOUS_ENABLED !== 'false') {
  throw new Error('production Grafana unexpectedly permits anonymous access');
}
for (const service of [prometheus, grafana]) {
  if (service.read_only !== true || !service.security_opt?.includes('no-new-privileges:true')) {
    throw new Error('an observability service is missing container hardening');
  }
  if (!service.deploy?.resources?.limits?.memory || !service.deploy?.resources?.limits?.cpus) {
    throw new Error('an observability service is missing resource limits');
  }
}
NODE

COMPOSE_PROFILES=observability \
  bash "${SCRIPT_DIR}/compose.sh" development config --format json \
  >"${TEST_DIRECTORY}/development-observability.json"
node - "${TEST_DIRECTORY}/development-observability.json" <<'NODE'
const { readFileSync } = require('node:fs');

const model = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (model.services.edge.environment?.GRAFANA_UPSTREAM !== 'grafana:3000') {
  throw new Error('development Caddy does not receive the internal Grafana upstream');
}
if (!Object.hasOwn(model.services.edge.networks ?? {}, 'observability')) {
  throw new Error('development Caddy cannot reach the isolated observability network');
}
if (model.services.grafana.environment?.GF_SERVER_ROOT_URL !== 'https://grafana.surplasse.test') {
  throw new Error('development Grafana does not use the centrally derived HTTPS URL');
}
if (model.services.grafana.environment?.GF_AUTH_ANONYMOUS_ENABLED !== 'true') {
  throw new Error('development Grafana does not provide the expected read-only anonymous access');
}
if (model.services.grafana.ports) {
  throw new Error('development Grafana bypasses Caddy with a published host port');
}
NODE

public_fixture="${TEST_DIRECTORY}/public.env"
cp "$valid_fixture" "$public_fixture"
chmod 0644 "$public_fixture"
expect_failure "$public_fixture" 'must not be accessible by group or others' config --quiet

domain_fixture="${TEST_DIRECTORY}/domain-override.env"
cp "$valid_fixture" "$domain_fixture"
printf '%s\n' 'APP_BASE_DOMAIN=override.invalid' >>"$domain_fixture"
expect_failure "$domain_fixture" 'belongs to the central domain profile' config --quiet

process_control_fixture="${TEST_DIRECTORY}/process-control.env"
cp "$valid_fixture" "$process_control_fixture"
printf '%s\n' 'DOCKER_HOST=tcp://override.invalid:2375' >>"$process_control_fixture"
expect_failure "$process_control_fixture" 'process control variable DOCKER_HOST is forbidden' config --quiet

short_sha_fixture="${TEST_DIRECTORY}/short-sha.env"
write_fixture "$short_sha_fixture" deadbeef
expect_failure "$short_sha_fixture" 'IMAGE_TAG must be the full lowercase 40-character git SHA' config --quiet

zero_sha_fixture="${TEST_DIRECTORY}/zero-sha.env"
write_fixture "$zero_sha_fixture" 0000000000000000000000000000000000000000
expect_failure "$zero_sha_fixture" 'IMAGE_TAG must be the full lowercase 40-character git SHA' config --quiet

unversioned_dns_fixture="${TEST_DIRECTORY}/unversioned-dns.env"
write_fixture \
  "$unversioned_dns_fixture" \
  0123456789abcdef0123456789abcdef01234567 \
  github.com/caddy-dns/example
expect_failure "$unversioned_dns_fixture" 'CADDY_DNS_MODULE must be a valid versioned Go module path' config --quiet

public_grafana_fixture="${TEST_DIRECTORY}/public-grafana.env"
write_fixture \
  "$public_grafana_fixture" \
  0123456789abcdef0123456789abcdef01234567 \
  github.com/caddy-dns/example@v0.0.0 \
  0.0.0.0
expect_failure "$public_grafana_fixture" 'GRAFANA_BIND_ADDRESS must be 127.0.0.1' start grafana

privileged_grafana_port_fixture="${TEST_DIRECTORY}/privileged-grafana-port.env"
write_fixture \
  "$privileged_grafana_port_fixture" \
  0123456789abcdef0123456789abcdef01234567 \
  github.com/caddy-dns/example@v0.0.0 \
  127.0.0.1 \
  443
expect_failure "$privileged_grafana_port_fixture" 'GRAFANA_PORT must be an integer between 1024 and 65535' start grafana

app_only_fixture="${TEST_DIRECTORY}/app-only.env"
grep -v '^GRAFANA_' "$valid_fixture" >"$app_only_fixture"
chmod 0600 "$app_only_fixture"
SURPLASSE_SECRETS_FILE="$app_only_fixture" \
  bash "${SCRIPT_DIR}/compose.sh" production config --services \
  >"${TEST_DIRECTORY}/app-only-services.txt"
if grep -Eq '^(prometheus|grafana)$' "${TEST_DIRECTORY}/app-only-services.txt"; then
  printf 'Error: the application-only production profile unexpectedly enables observability.\n' >&2
  exit 1
fi
expect_failure "$app_only_fixture" 'GRAFANA_ADMIN_USER must be configured' start grafana

observability_profile_failure="${TEST_DIRECTORY}/observability-profile-failure.log"
if COMPOSE_PROFILES=observability SURPLASSE_SECRETS_FILE="$app_only_fixture" \
    bash "${SCRIPT_DIR}/compose.sh" production start >"$observability_profile_failure" 2>&1; then
  printf 'Error: the observability profile started without Grafana secrets.\n' >&2
  exit 1
fi
grep -Fq 'GRAFANA_ADMIN_USER must be configured' "$observability_profile_failure"

expect_failure "$valid_fixture" 'IMAGE_TAG must match the checked-out production commit' pull

expect_failure "$valid_fixture" 'the JWT private key is missing, empty or unreadable' up --no-start

# The same pinned image that runs in Compose validates the tracked scrape and
# alerting configuration, including all referenced rule files.
# shellcheck disable=SC1091
source "${REPOSITORY_ROOT}/config/deployment/images.env"
docker run --rm \
  --entrypoint /bin/promtool \
  --volume "${REPOSITORY_ROOT}/infra/observability/prometheus:/etc/prometheus:ro" \
  "$PROMETHEUS_IMAGE" \
  check config /etc/prometheus/prometheus.yml
node - "${REPOSITORY_ROOT}/infra/observability/grafana/dashboards/surplasse-overview.json" <<'NODE'
const { readFileSync } = require('node:fs');

const dashboard = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (dashboard.title !== 'Vue opérationnelle' || dashboard.uid !== 'surplasse-operations') {
  throw new Error('the provisioned Grafana dashboard has an unexpected identity');
}
if (!Array.isArray(dashboard.panels) || dashboard.panels.length !== 18) {
  throw new Error('the provisioned Grafana dashboard does not contain the expected panels');
}
const expressions = dashboard.panels
  .flatMap((panel) => panel.targets ?? [])
  .map((target) => target.expr ?? '')
  .join('\n');
for (const metric of [
  'surplasse_orders_created_total',
  'http_server_requests_seconds_count',
  'jvm_memory_used_bytes',
  'process_cpu_usage',
  'jvm_threads_live_threads',
  'agroal_active_count',
  'agroal_awaiting_count',
  'up{job="prometheus"}',
  'scrape_samples_scraped',
]) {
  if (!expressions.includes(metric)) {
    throw new Error(`the provisioned Grafana dashboard does not query ${metric}`);
  }
}
NODE

printf 'Development and production Compose profile guardrails verified.\n'
