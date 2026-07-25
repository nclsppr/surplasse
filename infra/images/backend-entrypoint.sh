#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

load_secret() {
  local variable_name="$1"
  local file_variable_name="${variable_name}_FILE"
  local direct_value="${!variable_name:-}"
  local file_path="${!file_variable_name:-}"

  if [[ -n "$direct_value" && -n "$file_path" ]]; then
    printf 'Error: %s and %s cannot both be configured.\n' \
      "$variable_name" "$file_variable_name" >&2
    exit 1
  fi
  [[ -n "$file_path" ]] || return 0
  [[ -f "$file_path" && -r "$file_path" ]] || {
    printf 'Error: secret file for %s is missing or unreadable.\n' "$variable_name" >&2
    exit 1
  }

  export "$variable_name=$(<"$file_path")"
  unset "$file_variable_name"
}

for secret_variable in \
  QUARKUS_DATASOURCE_PASSWORD \
  SMTP_PASSWORD \
  SMTP_USERNAME \
  STRIPE_ACCOUNT_WEBHOOK_SECRET \
  STRIPE_PAYMENT_WEBHOOK_SECRET \
  STRIPE_SECRET_KEY; do
  load_secret "$secret_variable"
done

case "${DEPLOYMENT_PROFILE:-}" in
  development)
    export QUARKUS_PROFILE=dev
    ;;
  production)
    export QUARKUS_PROFILE=prod
    ;;
  *)
    printf 'Error: DEPLOYMENT_PROFILE must be development or production.\n' >&2
    exit 1
    ;;
esac

exec /opt/surplasse/scripts/run-with-domain-profile.sh \
  "$DEPLOYMENT_PROFILE" \
  java -jar /opt/surplasse/application/quarkus-run.jar
