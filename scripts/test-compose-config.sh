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
    "${REPOSITORY_ROOT}/config/deployment" \
    "${REPOSITORY_ROOT}/infra/caddy" \
    "${REPOSITORY_ROOT}/infra/images" \
    "${REPOSITORY_ROOT}/scripts/compose.sh"; then
  printf 'Error: a deployment source contains a hard-coded Surplasse domain.\n' >&2
  exit 1
fi

bash "${SCRIPT_DIR}/compose.sh" development config --quiet
if bash "${SCRIPT_DIR}/compose.sh" development --ansi never config --quiet \
    >"${TEST_DIRECTORY}/global-option.log" 2>&1; then
  printf 'Error: a global Compose option bypassed command detection.\n' >&2
  exit 1
fi
grep -Fq 'Docker Compose command must be the first argument' \
  "${TEST_DIRECTORY}/global-option.log"

COMPOSE_PROFILES=observability \
  bash "${SCRIPT_DIR}/compose.sh" development config --format json \
  >"${TEST_DIRECTORY}/development.json"

node - "${TEST_DIRECTORY}/development.json" <<'NODE'
const { readFileSync } = require("node:fs");

const model = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { backend, docs, edge, grafana, onboarding, postgresql } = model.services;

if (docs.build?.args?.NIMBUS_SITE_ORIGIN !== "https://docs.surplasse.test") {
  throw new Error("development Nimbus does not use the canonical documentation origin");
}
if (docs.build?.args?.NIMBUS_BASE_PATH !== "/") {
  throw new Error("development Nimbus is not built for the documentation-domain root");
}
if (!docs.healthcheck?.test?.join(" ").includes("http://127.0.0.1:8080/")) {
  throw new Error("development documentation healthcheck does not cover Nimbus");
}
if (edge.environment?.GRAFANA_UPSTREAM !== "grafana:3000") {
  throw new Error("development Caddy does not receive the internal Grafana upstream");
}
if (!Object.hasOwn(edge.networks ?? {}, "observability")) {
  throw new Error("development Caddy cannot reach the observability network");
}
if (grafana.environment?.GF_SERVER_ROOT_URL !== "https://grafana.surplasse.test") {
  throw new Error("development Grafana does not use the canonical HTTPS URL");
}
if (grafana.environment?.GF_AUTH_ANONYMOUS_ENABLED !== "true" || grafana.ports) {
  throw new Error("development Grafana is not private and read-only");
}
for (const [service, variableName] of [
  [backend, "STRIPE_SECRET_KEY"],
  [backend, "QUARKUS_DATASOURCE_PASSWORD"],
  [postgresql, "POSTGRES_PASSWORD"],
  [onboarding, "STRIPE_SECRET_KEY"],
]) {
  if (Object.hasOwn(service.environment ?? {}, variableName)) {
    throw new Error(`development Compose exposes ${variableName} directly`);
  }
}
if (
  onboarding.environment?.STRIPE_SECRET_KEY_FILE !== "/run/secrets/stripe_secret_key" ||
  !onboarding.secrets?.some((secret) => secret.source === "stripe_secret_key")
) {
  throw new Error("development Onboarding does not consume the Stripe key as a secret");
}
const network = model.networks?.default?.ipam?.config?.[0];
if (network?.subnet !== "172.30.0.0/24" || network?.ip_range !== "172.30.0.128/25") {
  throw new Error("development dynamic addresses can overlap Caddy");
}
NODE

# Validate the observability files with the same pinned Prometheus image used
# by the development profile, including every referenced rule file.
# shellcheck disable=SC1091
source "${REPOSITORY_ROOT}/config/deployment/images.env"
docker run --rm \
  --entrypoint /bin/promtool \
  --volume "${REPOSITORY_ROOT}/infra/observability/prometheus:/etc/prometheus:ro" \
  "$PROMETHEUS_IMAGE" \
  check config /etc/prometheus/prometheus.yml

node - "${REPOSITORY_ROOT}/infra/observability/grafana/dashboards/surplasse-overview.json" <<'NODE'
const { readFileSync } = require("node:fs");

const dashboard = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (dashboard.title !== "Vue opérationnelle" || dashboard.uid !== "surplasse-operations") {
  throw new Error("the development Grafana dashboard has an unexpected identity");
}
if (!Array.isArray(dashboard.panels) || dashboard.panels.length !== 18) {
  throw new Error("the development Grafana dashboard does not contain the expected panels");
}
const expressions = dashboard.panels
  .flatMap((panel) => panel.targets ?? [])
  .map((target) => target.expr ?? "")
  .join("\n");
for (const metric of [
  "surplasse_orders_created_total",
  "http_server_requests_seconds_count",
  "jvm_memory_used_bytes",
  "process_cpu_usage",
  "jvm_threads_live_threads",
  "agroal_active_count",
  "agroal_awaiting_count",
  'up{job="prometheus"}',
  "scrape_samples_scraped",
]) {
  if (!expressions.includes(metric)) {
    throw new Error(`the development Grafana dashboard does not query ${metric}`);
  }
}
NODE

printf 'Development Compose profile guardrails verified.\n'
