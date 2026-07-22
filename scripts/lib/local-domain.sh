#!/usr/bin/env bash

# Shared helpers for the Surplasse local domain scripts. This file is sourced
# by entry-point scripts and is not meant to be executed directly.

SURPLASSE_CADDY_RUNTIME_DIRECTORY="/var/run/surplasse-local"
SURPLASSE_CADDY_ADMIN_SOCKET="${SURPLASSE_CADDY_RUNTIME_DIRECTORY}/caddy-admin.sock"

surplasse_local_die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

surplasse_local_info() {
  printf '%s\n' "$*"
}

surplasse_local_repo_root() {
  local library_dir
  library_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${library_dir}/../.." && pwd
}

surplasse_local_load_config() {
  local repository_root="$1"
  local config_file="${SURPLASSE_DOMAIN_CONFIG:-${repository_root}/config/domains/development.env}"

  [[ -f "$config_file" ]] || surplasse_local_die \
    "missing domain configuration: ${config_file}. Copy or restore config/domains/development.env first."

  set -a
  # The configuration is versioned with the repository and intentionally uses
  # dotenv syntax compatible with Bash assignments.
  # shellcheck disable=SC1090
  source "$config_file"
  set +a

  local variable_name
  for variable_name in \
    APP_SCHEME \
    APP_BASE_DOMAIN \
    PROBLEM_TYPE_BASE; do
    [[ -n "${!variable_name:-}" ]] || surplasse_local_die \
      "${variable_name} is required in ${config_file}."
  done

  export APP_BASE_URL="${APP_SCHEME}://${APP_BASE_DOMAIN}"
  export ONBOARDING_URL="$APP_BASE_URL"
  export DASHBOARD_URL="${APP_SCHEME}://dashboard.${APP_BASE_DOMAIN}"
  export API_URL="${APP_SCHEME}://api.${APP_BASE_DOMAIN}"
  export LOCAL_CONTROL_URL="${APP_SCHEME}://local.${APP_BASE_DOMAIN}"
  export DOCS_URL="${APP_SCHEME}://docs.${APP_BASE_DOMAIN}"
  export MAILPIT_URL="${APP_SCHEME}://mail.${APP_BASE_DOMAIN}"
  export REPORTS_URL="${APP_SCHEME}://reports.${APP_BASE_DOMAIN}"
  export GRAFANA_URL="${APP_SCHEME}://grafana.${APP_BASE_DOMAIN}"

  [[ "$APP_BASE_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.test$ ]] || surplasse_local_die \
    "APP_BASE_DOMAIN must be a lowercase .test domain without a scheme, port or wildcard."
  [[ "$APP_SCHEME" == "https" ]] || surplasse_local_die \
    "APP_SCHEME must be https for the local domain topology."
  [[ "$APP_BASE_DOMAIN" != *..* ]] || surplasse_local_die \
    "APP_BASE_DOMAIN must not contain adjacent dots."
  [[ "$APP_BASE_URL" == "https://${APP_BASE_DOMAIN}" ]] || surplasse_local_die \
    "APP_BASE_URL must equal https://${APP_BASE_DOMAIN}."

  export SURPLASSE_DOMAIN_CONFIG_FILE="$config_file"
  export SURPLASSE_DASHBOARD_HOST
  export SURPLASSE_API_HOST
  export SURPLASSE_LOCAL_CONTROL_HOST
  export SURPLASSE_DOCS_HOST
  export SURPLASSE_MAILPIT_HOST
  export SURPLASSE_REPORTS_HOST
  export SURPLASSE_GRAFANA_HOST
  SURPLASSE_DASHBOARD_HOST="$(surplasse_local_https_host "$DASHBOARD_URL" "DASHBOARD_URL")"
  SURPLASSE_API_HOST="$(surplasse_local_https_host "$API_URL" "API_URL")"
  SURPLASSE_LOCAL_CONTROL_HOST="$(surplasse_local_https_host "$LOCAL_CONTROL_URL" "LOCAL_CONTROL_URL")"
  SURPLASSE_DOCS_HOST="$(surplasse_local_https_host "$DOCS_URL" "DOCS_URL")"
  SURPLASSE_MAILPIT_HOST="$(surplasse_local_https_host "$MAILPIT_URL" "MAILPIT_URL")"
  SURPLASSE_REPORTS_HOST="$(surplasse_local_https_host "$REPORTS_URL" "REPORTS_URL")"
  SURPLASSE_GRAFANA_HOST="$(surplasse_local_https_host "$GRAFANA_URL" "GRAFANA_URL")"

  surplasse_local_require_direct_subdomain "$SURPLASSE_DASHBOARD_HOST" "DASHBOARD_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_API_HOST" "API_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_LOCAL_CONTROL_HOST" "LOCAL_CONTROL_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_DOCS_HOST" "DOCS_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_MAILPIT_HOST" "MAILPIT_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_REPORTS_HOST" "REPORTS_URL"
  surplasse_local_require_direct_subdomain "$SURPLASSE_GRAFANA_HOST" "GRAFANA_URL"

  export SURPLASSE_LOCAL_CERT_FILE="${repository_root}/.certs/${APP_BASE_DOMAIN}.pem"
  export SURPLASSE_LOCAL_KEY_FILE="${repository_root}/.certs/${APP_BASE_DOMAIN}-key.pem"
}

surplasse_local_https_host() {
  local url="$1"
  local variable_name="$2"
  local host

  [[ "$url" == https://* ]] || surplasse_local_die "${variable_name} must use https://."
  host="${url#https://}"
  [[ -n "$host" && "$host" != */* && "$host" != *:* && "$host" != *\?* && "$host" != *\#* ]] || \
    surplasse_local_die "${variable_name} must contain only an HTTPS origin without a path, query or port."
  [[ "$host" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ ]] || \
    surplasse_local_die "${variable_name} contains an invalid hostname."
  printf '%s\n' "$host"
}

surplasse_local_require_direct_subdomain() {
  local host="$1"
  local variable_name="$2"
  local suffix=".${APP_BASE_DOMAIN}"
  local label

  [[ "$host" == *"$suffix" ]] || surplasse_local_die \
    "${variable_name} must be a direct subdomain of ${APP_BASE_DOMAIN}."
  label="${host%"$suffix"}"
  [[ -n "$label" && "$label" != *.* ]] || surplasse_local_die \
    "${variable_name} must be a direct subdomain of ${APP_BASE_DOMAIN}."
  [[ "$label" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || surplasse_local_die \
    "${variable_name} contains an invalid subdomain label."
}

surplasse_local_require_macos() {
  local operating_system
  operating_system="$(uname -s)"
  if [[ "$operating_system" == "Darwin" ]]; then
    return
  fi

  if [[ "$operating_system" == "Linux" ]] && \
    { [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qi microsoft /proc/version 2>/dev/null; }; then
    surplasse_local_die \
      "automatic DNS setup is not supported safely on WSL2 yet. No system file was changed. Use the documented WSL2 procedure, including the Windows DNS and certificate trust steps."
  fi

  surplasse_local_die \
    "automatic DNS setup currently supports macOS only. No system file was changed. Use the documented Linux procedure."
}

surplasse_local_find_caddy() {
  local caddy_path
  if caddy_path="$(command -v caddy 2>/dev/null)" && [[ -x "$caddy_path" ]]; then
    printf '%s\n' "$caddy_path"
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    local caddy_prefix
    if caddy_prefix="$(brew --prefix caddy 2>/dev/null)"; then
      caddy_path="${caddy_prefix}/bin/caddy"
      if [[ -x "$caddy_path" ]]; then
        printf '%s\n' "$caddy_path"
        return
      fi
    fi
  fi

  surplasse_local_die \
    "Caddy is not installed. Run scripts/setup-local-domain.sh first."
}

surplasse_local_caddy_environment() {
  env \
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
    "$@"
}

surplasse_local_require_admin_access() {
  sudo -v || surplasse_local_die \
    "administrator privileges are required to manage the local resolver and HTTPS proxy."
}

surplasse_local_caddy_admin_socket_exists() {
  sudo test -S "$SURPLASSE_CADDY_ADMIN_SOCKET"
}

surplasse_local_caddy_admin_path_exists() {
  sudo test -e "$SURPLASSE_CADDY_ADMIN_SOCKET" || \
    sudo test -L "$SURPLASSE_CADDY_ADMIN_SOCKET"
}

surplasse_local_caddy_admin_is_ready() {
  sudo curl --unix-socket "$SURPLASSE_CADDY_ADMIN_SOCKET" \
    --silent --show-error --fail --max-time 1 \
    http://localhost/config/ >/dev/null 2>&1
}

surplasse_local_caddy_is_ours() {
  sudo curl --unix-socket "$SURPLASSE_CADDY_ADMIN_SOCKET" \
    --silent --show-error --fail --max-time 1 \
    http://localhost/config/ 2>/dev/null | \
    grep -Fq 'surplasse-local-proxy-v1'
}
