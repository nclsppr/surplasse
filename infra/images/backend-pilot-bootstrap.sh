#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

fail() {
  printf 'Pilot bootstrap refused: %s\n' "$1" >&2
  exit "${2:-64}"
}

[[ $# -eq 1 && "$1" =~ ^(apply|status)$ ]] || \
  fail "the command accepts exactly one operation: apply or status"
[[ "${DEPLOYMENT_PROFILE:-}" == production ]] || \
  fail "DEPLOYMENT_PROFILE must be production"
[[ "${SURPLASSE_PRODUCTION_RELEASE_MODE:-}" == testers ]] || \
  fail "SURPLASSE_PRODUCTION_RELEASE_MODE must be testers"
[[ "${STRIPE_LIVE_MODE:-}" == false ]] || \
  fail "STRIPE_LIVE_MODE must be false"
[[ -z "${QUARKUS_DATASOURCE_PASSWORD:-}" ]] || \
  fail "the database password must use its protected file"
[[ -z "${STRIPE_SECRET_KEY:-}" ]] || \
  fail "the Stripe key must use its protected file"
[[ "${PILOT_BOOTSTRAP_MANIFEST_FILE:-}" == /run/surplasse/pilot-bootstrap.json ]] || \
  fail "the pilot manifest path differs from the fixed contract"
[[ "${QUARKUS_DATASOURCE_JDBC_URL:-}" == jdbc:postgresql://postgresql:5432/surplasse ]] || \
  fail "the database URL differs from the fixed contract"
[[ "${QUARKUS_DATASOURCE_USERNAME:-}" == surplasse_runtime ]] || \
  fail "the database role differs from the fixed contract"
[[ "${QUARKUS_DATASOURCE_PASSWORD_FILE:-}" == /run/secrets/surplasse_postgres_runtime_password ]] || \
  fail "the database password path differs from the fixed contract"
[[ "${STRIPE_SECRET_KEY_FILE:-}" == /run/secrets/surplasse_stripe_secret_key ]] || \
  fail "the Stripe key path differs from the fixed contract"

for protected_file in \
  "$PILOT_BOOTSTRAP_MANIFEST_FILE" \
  "$QUARKUS_DATASOURCE_PASSWORD_FILE" \
  "$STRIPE_SECRET_KEY_FILE"; do
  [[ -f "$protected_file" && ! -L "$protected_file" && -r "$protected_file" ]] || \
    fail "a protected input is missing or unreadable"
done

exec java \
  -Djava.util.logging.manager=org.jboss.logmanager.LogManager \
  -cp '/opt/surplasse/application/app/*:/opt/surplasse/application/lib/boot/*:/opt/surplasse/application/lib/main/*' \
  com.surplasse.application.bootstrap.PilotBootstrapCommand \
  "$1"
