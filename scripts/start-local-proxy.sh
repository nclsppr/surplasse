#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

REPOSITORY_ROOT="$(surplasse_local_repo_root)"
surplasse_local_load_config "$REPOSITORY_ROOT"

CADDYFILE="${REPOSITORY_ROOT}/infra/local/Caddyfile"
CADDY_BIN="$(surplasse_local_find_caddy)"
[[ -f "$CADDYFILE" ]] || surplasse_local_die "missing Caddy configuration: ${CADDYFILE}."
[[ -f "$SURPLASSE_LOCAL_CERT_FILE" ]] || surplasse_local_die \
  "missing local certificate. Run scripts/setup-local-domain.sh first."
[[ -f "$SURPLASSE_LOCAL_KEY_FILE" ]] || surplasse_local_die \
  "missing local private key. Run scripts/setup-local-domain.sh first."

surplasse_local_caddy_environment \
  "$CADDY_BIN" validate --config "$CADDYFILE" --adapter caddyfile

surplasse_local_require_admin_access
if surplasse_local_caddy_admin_socket_exists; then
  surplasse_local_caddy_admin_is_ready || surplasse_local_die \
    "The protected Caddy admin socket exists but is unreachable. It was left untouched; inspect the running Caddy instance before retrying."
  surplasse_local_caddy_is_ours || surplasse_local_die \
    "The protected Caddy admin socket belongs to another instance. It was left untouched."
  surplasse_local_info "Reloading the existing Surplasse local proxy..."
  sudo env \
      APP_BASE_DOMAIN="$APP_BASE_DOMAIN" \
      APP_BASE_URL="$APP_BASE_URL" \
      ONBOARDING_URL="$ONBOARDING_URL" \
      DASHBOARD_URL="$DASHBOARD_URL" \
      SURPLASSE_LOCAL_CERT_FILE="$SURPLASSE_LOCAL_CERT_FILE" \
      SURPLASSE_LOCAL_KEY_FILE="$SURPLASSE_LOCAL_KEY_FILE" \
      SURPLASSE_DASHBOARD_HOST="$SURPLASSE_DASHBOARD_HOST" \
      SURPLASSE_API_HOST="$SURPLASSE_API_HOST" \
      SURPLASSE_LOCAL_CONTROL_HOST="$SURPLASSE_LOCAL_CONTROL_HOST" \
      SURPLASSE_DOCS_HOST="$SURPLASSE_DOCS_HOST" \
      SURPLASSE_MAILPIT_HOST="$SURPLASSE_MAILPIT_HOST" \
      "$CADDY_BIN" reload \
      --config "$CADDYFILE" \
      --adapter caddyfile \
      --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
else
  if surplasse_local_caddy_admin_path_exists; then
    surplasse_local_die \
      "The protected Caddy admin path exists but is not a Unix socket. It was left untouched."
  fi
  surplasse_local_info \
    "Starting Caddy on loopback port 443. macOS and most Linux systems require administrator privileges for this port."
  sudo install -d -m 0700 -o root "$SURPLASSE_CADDY_RUNTIME_DIRECTORY"
  sudo env \
      APP_BASE_DOMAIN="$APP_BASE_DOMAIN" \
      APP_BASE_URL="$APP_BASE_URL" \
      ONBOARDING_URL="$ONBOARDING_URL" \
      DASHBOARD_URL="$DASHBOARD_URL" \
      SURPLASSE_LOCAL_CERT_FILE="$SURPLASSE_LOCAL_CERT_FILE" \
      SURPLASSE_LOCAL_KEY_FILE="$SURPLASSE_LOCAL_KEY_FILE" \
      SURPLASSE_DASHBOARD_HOST="$SURPLASSE_DASHBOARD_HOST" \
      SURPLASSE_API_HOST="$SURPLASSE_API_HOST" \
      SURPLASSE_LOCAL_CONTROL_HOST="$SURPLASSE_LOCAL_CONTROL_HOST" \
      SURPLASSE_DOCS_HOST="$SURPLASSE_DOCS_HOST" \
      SURPLASSE_MAILPIT_HOST="$SURPLASSE_MAILPIT_HOST" \
      "$CADDY_BIN" start --config "$CADDYFILE" --adapter caddyfile
fi

PROXY_READY=false
for _attempt in {1..20}; do
  if surplasse_local_caddy_admin_is_ready; then
    PROXY_READY=true
    break
  fi
  sleep 0.25
done
[[ "$PROXY_READY" == true ]] || surplasse_local_die \
  "Caddy did not expose its protected Surplasse admin socket."

surplasse_local_info ""
surplasse_local_info "Surplasse local proxy is ready:"
surplasse_local_info "  Website:       ${APP_BASE_URL}"
surplasse_local_info "  Dashboard:     ${DASHBOARD_URL}"
surplasse_local_info "  API:           ${API_URL}"
surplasse_local_info "  Local control: ${LOCAL_CONTROL_URL}"
surplasse_local_info "  Documentation: ${DOCS_URL}"
surplasse_local_info "  Mailpit:       ${MAILPIT_URL}"
surplasse_local_info "  Restaurant:    https://demo.${APP_BASE_DOMAIN}"
