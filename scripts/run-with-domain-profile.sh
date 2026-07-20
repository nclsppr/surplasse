#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROFILE="${1:-}"
case "$PROFILE" in
  development | production) ;;
  *)
    printf 'Error: usage: scripts/run-with-domain-profile.sh <development|production> <command> [args...]\n' >&2
    exit 1
    ;;
esac
shift
[[ "$#" -gt 0 ]] || {
  printf 'Error: a command is required after the domain profile.\n' >&2
  exit 1
}

CONFIG_FILE="${REPOSITORY_ROOT}/config/domains/${PROFILE}.env"
[[ -f "$CONFIG_FILE" ]] || {
  printf 'Error: missing domain profile: %s\n' "$CONFIG_FILE" >&2
  exit 1
}

set -a
# This versioned file intentionally uses Bash-compatible dotenv assignments.
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

for variable_name in \
  APP_SCHEME \
  APP_BASE_DOMAIN \
  APP_BASE_URL \
  ONBOARDING_URL \
  DASHBOARD_URL \
  API_URL \
  PROBLEM_TYPE_BASE \
  RESERVED_SUBDOMAINS; do
  [[ -n "${!variable_name:-}" ]] || {
    printf 'Error: %s is required in %s.\n' "$variable_name" "$CONFIG_FILE" >&2
    exit 1
  }
done

[[ "$APP_SCHEME" == "https" ]] || {
  printf 'Error: APP_SCHEME must be https in %s.\n' "$CONFIG_FILE" >&2
  exit 1
}
[[ "$APP_BASE_URL" == "${APP_SCHEME}://${APP_BASE_DOMAIN}" ]] || {
  printf 'Error: APP_BASE_URL is inconsistent in %s.\n' "$CONFIG_FILE" >&2
  exit 1
}

escaped_base_domain="${APP_BASE_DOMAIN//./\\.}"
export CORS_PUBLIC_ORIGINS="https://${APP_BASE_DOMAIN},/https:\/\/[a-z0-9-]+\.${escaped_base_domain}/"
export SMTP_FROM="${SMTP_FROM:-no-reply@${APP_BASE_DOMAIN}}"

# Quarkus tests for individual modules do not load the assembly module's
# application.properties. Export the config mapping directly as well so every
# module receives the same central profile.
export SURPLASSE_PLATFORM_SCHEME="$APP_SCHEME"
export SURPLASSE_PLATFORM_BASE_DOMAIN="$APP_BASE_DOMAIN"
export SURPLASSE_PLATFORM_BASE_URL="$APP_BASE_URL"
export SURPLASSE_PLATFORM_DASHBOARD_URL="$DASHBOARD_URL"
export SURPLASSE_PLATFORM_API_URL="$API_URL"
export SURPLASSE_PLATFORM_PROBLEM_TYPE_BASE="$PROBLEM_TYPE_BASE"
export SURPLASSE_PLATFORM_RESERVED_SUBDOMAINS="$RESERVED_SUBDOMAINS"

exec "$@"
