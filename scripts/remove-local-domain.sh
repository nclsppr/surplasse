#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

REPOSITORY_ROOT="$(surplasse_local_repo_root)"
surplasse_local_require_macos

USER_CONFIG_ROOT="${XDG_CONFIG_HOME:-${HOME}/.config}/surplasse"
DNSMASQ_CONFIG="${USER_CONFIG_ROOT}/dnsmasq.conf"
DNSMASQ_LOG="${USER_CONFIG_ROOT}/dnsmasq.log"
DOMAIN_STATE_FILE="${USER_CONFIG_ROOT}/local-domain.state"
LAUNCH_AGENT_LABEL="com.surplasse.local-dns"
LAUNCH_AGENT_FILE="${HOME}/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"
LAUNCH_AGENT_MANAGED_KEY="SurplasseManaged"
USER_ID="$(id -u)"
RESOLVER_MARKER="# Managed by Surplasse local-domain scripts."

MANAGED_BASE_DOMAINS=()
MANAGED_DOMAIN_STATE=false
surplasse_add_managed_domain() {
  local candidate="$1"
  local existing
  for existing in "${MANAGED_BASE_DOMAINS[@]}"; do
    [[ "$existing" != "$candidate" ]] || return
  done
  MANAGED_BASE_DOMAINS+=("$candidate")
}

if [[ -e "$DOMAIN_STATE_FILE" ]]; then
  if grep -Fxq "$RESOLVER_MARKER" "$DOMAIN_STATE_FILE"; then
    STATE_BASE_DOMAIN="$(sed -n 's/^APP_BASE_DOMAIN=//p' "$DOMAIN_STATE_FILE")"
    if [[ "$STATE_BASE_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.test$ ]]; then
      surplasse_add_managed_domain "$STATE_BASE_DOMAIN"
      MANAGED_DOMAIN_STATE=true
    else
      surplasse_local_die \
        "${DOMAIN_STATE_FILE} contains an invalid domain and was left untouched."
    fi
  else
    surplasse_local_info \
      "Left ${DOMAIN_STATE_FILE} untouched because it is not managed by Surplasse."
  fi
fi

DEVELOPMENT_CONFIG="${REPOSITORY_ROOT}/config/domains/development.env"
if [[ -f "$DEVELOPMENT_CONFIG" ]]; then
  CONFIGURED_BASE_DOMAIN="$(sed -n 's/^APP_BASE_DOMAIN=//p' "$DEVELOPMENT_CONFIG")"
  if [[ "$CONFIGURED_BASE_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.test$ ]]; then
    surplasse_add_managed_domain "$CONFIGURED_BASE_DOMAIN"
  else
    surplasse_local_info \
      "Could not infer a safe domain from ${DEVELOPMENT_CONFIG}; only recorded domains will be removed."
  fi
fi

surplasse_local_require_admin_access
if surplasse_local_caddy_admin_socket_exists; then
  surplasse_local_caddy_admin_is_ready || surplasse_local_die \
    "The protected Caddy admin socket exists but is unreachable. It was left untouched; inspect the running Caddy instance before retrying."
  if surplasse_local_caddy_is_ours; then
    CADDY_BIN="$(surplasse_local_find_caddy)"
    sudo "$CADDY_BIN" stop --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
    sudo rm -f "$SURPLASSE_CADDY_ADMIN_SOCKET"
    sudo rmdir "$SURPLASSE_CADDY_RUNTIME_DIRECTORY" >/dev/null 2>&1 || true
  else
    surplasse_local_info \
      "Left the protected Caddy admin socket untouched because it is not managed by Surplasse."
  fi
elif surplasse_local_caddy_admin_path_exists; then
  surplasse_local_die \
    "The protected Caddy admin path exists but is not a Unix socket. It was left untouched."
fi

MANAGED_DNS_CONFIG=false
MANAGED_LAUNCH_AGENT=false
if [[ -e "$DNSMASQ_CONFIG" ]] && grep -Fxq "$RESOLVER_MARKER" "$DNSMASQ_CONFIG"; then
  MANAGED_DNS_CONFIG=true
elif [[ -e "$DNSMASQ_CONFIG" ]]; then
  surplasse_local_info \
    "Left ${DNSMASQ_CONFIG} untouched because it is not managed by Surplasse."
fi
if [[ -e "$LAUNCH_AGENT_FILE" ]] && \
  [[ "$(plutil -extract "$LAUNCH_AGENT_MANAGED_KEY" raw "$LAUNCH_AGENT_FILE" 2>/dev/null || true)" == true ]]; then
  MANAGED_LAUNCH_AGENT=true
elif [[ -e "$LAUNCH_AGENT_FILE" ]]; then
  surplasse_local_info \
    "Left ${LAUNCH_AGENT_FILE} untouched because it is not managed by Surplasse."
fi

if [[ "$MANAGED_LAUNCH_AGENT" == true ]]; then
  launchctl bootout "gui/${USER_ID}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
  rm -f "$LAUNCH_AGENT_FILE"
fi
if [[ "$MANAGED_DNS_CONFIG" == true ]]; then
  rm -f "$DNSMASQ_CONFIG" "$DNSMASQ_LOG"
fi
if [[ "$MANAGED_DOMAIN_STATE" == true ]]; then
  rm -f "$DOMAIN_STATE_FILE"
fi

RESOLVER_REMOVED=false
for MANAGED_BASE_DOMAIN in "${MANAGED_BASE_DOMAINS[@]}"; do
  RESOLVER_FILE="/etc/resolver/${MANAGED_BASE_DOMAIN}"
  if [[ -e "$RESOLVER_FILE" ]]; then
    if grep -Fxq "$RESOLVER_MARKER" "$RESOLVER_FILE"; then
      sudo rm -f "$RESOLVER_FILE"
      RESOLVER_REMOVED=true
    else
      surplasse_local_info \
        "Left ${RESOLVER_FILE} untouched because it is not managed by Surplasse."
    fi
  fi
done

for MANAGED_BASE_DOMAIN in "${MANAGED_BASE_DOMAINS[@]}"; do
  rm -f \
    "${REPOSITORY_ROOT}/.certs/${MANAGED_BASE_DOMAIN}.pem" \
    "${REPOSITORY_ROOT}/.certs/${MANAGED_BASE_DOMAIN}-key.pem"
done
rmdir "${REPOSITORY_ROOT}/.certs" >/dev/null 2>&1 || true
rmdir "$USER_CONFIG_ROOT" >/dev/null 2>&1 || true

if [[ "$RESOLVER_REMOVED" == true ]]; then
  sudo dscacheutil -flushcache
  sudo killall -HUP mDNSResponder >/dev/null 2>&1 || true
fi

surplasse_local_info "Local Surplasse DNS configuration and leaf certificates were removed."
surplasse_local_info "Homebrew packages and the shared mkcert authority were intentionally kept."
