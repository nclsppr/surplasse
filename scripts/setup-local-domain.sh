#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

REPOSITORY_ROOT="$(surplasse_local_repo_root)"
REGENERATE_CERTIFICATES=false
if [[ "${1:-}" == "--regenerate-certificates" ]]; then
  REGENERATE_CERTIFICATES=true
  shift
fi
[[ "$#" -eq 0 ]] || surplasse_local_die \
  "usage: scripts/setup-local-domain.sh [--regenerate-certificates]"

surplasse_local_load_config "$REPOSITORY_ROOT"
surplasse_local_require_macos

command -v brew >/dev/null 2>&1 || surplasse_local_die \
  "Homebrew is required but was not found. Install it manually from https://brew.sh, reopen the terminal, then rerun this script."
for required_command in sudo launchctl plutil install mktemp dig openssl cmp; do
  command -v "$required_command" >/dev/null 2>&1 || surplasse_local_die \
    "required macOS command not found: ${required_command}. No system file was changed."
done
surplasse_local_require_admin_access

BREW_PREFIX="$(brew --prefix)"
[[ -n "$BREW_PREFIX" && -d "$BREW_PREFIX" ]] || surplasse_local_die \
  "Homebrew returned an invalid installation prefix."
surplasse_local_info "Homebrew prefix detected: ${BREW_PREFIX}"

RESOLVER_DIRECTORY="/etc/resolver"
RESOLVER_FILE="${RESOLVER_DIRECTORY}/${APP_BASE_DOMAIN}"
RESOLVER_MARKER="# Managed by Surplasse local-domain scripts."
USER_CONFIG_ROOT="${XDG_CONFIG_HOME:-${HOME}/.config}/surplasse"
DNSMASQ_CONFIG="${USER_CONFIG_ROOT}/dnsmasq.conf"
DNSMASQ_LOG="${USER_CONFIG_ROOT}/dnsmasq.log"
DOMAIN_STATE_FILE="${USER_CONFIG_ROOT}/local-domain.state"
LAUNCH_AGENT_LABEL="com.surplasse.local-dns"
LAUNCH_AGENT_FILE="${HOME}/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"
LAUNCH_AGENT_MANAGED_KEY="SurplasseManaged"
USER_ID="$(id -u)"

PREVIOUS_BASE_DOMAIN=""
if [[ -e "$DOMAIN_STATE_FILE" ]]; then
  grep -Fxq "$RESOLVER_MARKER" "$DOMAIN_STATE_FILE" || surplasse_local_die \
    "${DOMAIN_STATE_FILE} already exists and is not managed by Surplasse; it was left untouched."
  PREVIOUS_BASE_DOMAIN="$(sed -n 's/^APP_BASE_DOMAIN=//p' "$DOMAIN_STATE_FILE")"
  [[ "$PREVIOUS_BASE_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.test$ ]] || surplasse_local_die \
    "${DOMAIN_STATE_FILE} contains an invalid previous domain and was left untouched."
fi

if [[ -e "$RESOLVER_FILE" ]] && ! grep -Fxq "$RESOLVER_MARKER" "$RESOLVER_FILE"; then
  surplasse_local_die \
    "${RESOLVER_FILE} already exists and is not managed by Surplasse; it was left untouched."
fi
if [[ -e "$DNSMASQ_CONFIG" ]] && ! grep -Fxq "$RESOLVER_MARKER" "$DNSMASQ_CONFIG"; then
  surplasse_local_die \
    "${DNSMASQ_CONFIG} already exists and is not managed by Surplasse; it was left untouched."
fi
if [[ -e "$LAUNCH_AGENT_FILE" ]] && \
  [[ "$(plutil -extract "$LAUNCH_AGENT_MANAGED_KEY" raw "$LAUNCH_AGENT_FILE" 2>/dev/null || true)" != true ]]; then
  surplasse_local_die \
    "${LAUNCH_AGENT_FILE} already exists and is not managed by Surplasse; it was left untouched."
fi
if [[ -n "$PREVIOUS_BASE_DOMAIN" && "$PREVIOUS_BASE_DOMAIN" != "$APP_BASE_DOMAIN" ]]; then
  PREVIOUS_RESOLVER_FILE="${RESOLVER_DIRECTORY}/${PREVIOUS_BASE_DOMAIN}"
  if [[ -e "$PREVIOUS_RESOLVER_FILE" ]] && ! grep -Fxq "$RESOLVER_MARKER" "$PREVIOUS_RESOLVER_FILE"; then
    surplasse_local_die \
      "${PREVIOUS_RESOLVER_FILE} exists but is not managed by Surplasse; it was left untouched."
  fi
fi

surplasse_local_info "Installing required Homebrew formulae when missing..."
for formula in dnsmasq nss mkcert caddy; do
  if ! brew list --versions "$formula" >/dev/null 2>&1; then
    brew install "$formula"
  fi
done

if [[ -n "$PREVIOUS_BASE_DOMAIN" && "$PREVIOUS_BASE_DOMAIN" != "$APP_BASE_DOMAIN" ]]; then
  if surplasse_local_caddy_admin_socket_exists; then
    surplasse_local_caddy_admin_is_ready || surplasse_local_die \
      "The protected Caddy admin socket exists but is unreachable. It was left untouched; inspect the running Caddy instance before retrying."
    surplasse_local_caddy_is_ours || surplasse_local_die \
      "The protected Caddy admin socket belongs to another instance. It was left untouched."
    sudo "$(surplasse_local_find_caddy)" stop --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
    sudo rm -f "$SURPLASSE_CADDY_ADMIN_SOCKET"
    sudo rmdir "$SURPLASSE_CADDY_RUNTIME_DIRECTORY" >/dev/null 2>&1 || true
  elif surplasse_local_caddy_admin_path_exists; then
    surplasse_local_die \
      "The protected Caddy admin path exists but is not a Unix socket. It was left untouched."
  fi
  if [[ -e "$PREVIOUS_RESOLVER_FILE" ]]; then
    sudo rm -f "$PREVIOUS_RESOLVER_FILE"
  fi
  rm -f \
    "${REPOSITORY_ROOT}/.certs/${PREVIOUS_BASE_DOMAIN}.pem" \
    "${REPOSITORY_ROOT}/.certs/${PREVIOUS_BASE_DOMAIN}-key.pem"
fi

DNSMASQ_PREFIX="$(brew --prefix dnsmasq)"
DNSMASQ_BIN="${DNSMASQ_PREFIX}/sbin/dnsmasq"
[[ -x "$DNSMASQ_BIN" ]] || surplasse_local_die \
  "dnsmasq was installed but its executable was not found under ${DNSMASQ_PREFIX}."

mkdir -p "$USER_CONFIG_ROOT" "$(dirname "$LAUNCH_AGENT_FILE")"

DNSMASQ_TEMP="$(mktemp)"
LAUNCH_AGENT_TEMP="$(mktemp)"
RESOLVER_TEMP="$(mktemp)"
DOMAIN_STATE_TEMP="$(mktemp)"
CERTIFICATE_PUBLIC_KEY_TEMP="$(mktemp)"
PRIVATE_KEY_PUBLIC_KEY_TEMP="$(mktemp)"
cleanup_temporary_files() {
  rm -f \
    "$DNSMASQ_TEMP" \
    "$LAUNCH_AGENT_TEMP" \
    "$RESOLVER_TEMP" \
    "$DOMAIN_STATE_TEMP" \
    "$CERTIFICATE_PUBLIC_KEY_TEMP" \
    "$PRIVATE_KEY_PUBLIC_KEY_TEMP"
}
trap cleanup_temporary_files EXIT

printf '%s\n' \
  '# Managed by Surplasse local-domain scripts.' \
  'port=53535' \
  'listen-address=127.0.0.1' \
  'bind-interfaces' \
  'no-resolv' \
  'no-hosts' \
  'domain-needed' \
  "local=/${APP_BASE_DOMAIN}/" \
  "address=/${APP_BASE_DOMAIN}/127.0.0.1" >"$DNSMASQ_TEMP"
install -m 0644 "$DNSMASQ_TEMP" "$DNSMASQ_CONFIG"

plutil -create xml1 "$LAUNCH_AGENT_TEMP"
plutil -insert "$LAUNCH_AGENT_MANAGED_KEY" -bool true "$LAUNCH_AGENT_TEMP"
plutil -insert Label -string "$LAUNCH_AGENT_LABEL" "$LAUNCH_AGENT_TEMP"
plutil -insert ProgramArguments -array "$LAUNCH_AGENT_TEMP"
plutil -insert ProgramArguments.0 -string "$DNSMASQ_BIN" "$LAUNCH_AGENT_TEMP"
plutil -insert ProgramArguments.1 -string '--keep-in-foreground' "$LAUNCH_AGENT_TEMP"
plutil -insert ProgramArguments.2 -string "--conf-file=${DNSMASQ_CONFIG}" "$LAUNCH_AGENT_TEMP"
plutil -insert RunAtLoad -bool true "$LAUNCH_AGENT_TEMP"
plutil -insert KeepAlive -bool true "$LAUNCH_AGENT_TEMP"
plutil -insert StandardOutPath -string "$DNSMASQ_LOG" "$LAUNCH_AGENT_TEMP"
plutil -insert StandardErrorPath -string "$DNSMASQ_LOG" "$LAUNCH_AGENT_TEMP"
plutil -lint "$LAUNCH_AGENT_TEMP" >/dev/null
install -m 0644 "$LAUNCH_AGENT_TEMP" "$LAUNCH_AGENT_FILE"

launchctl bootout "gui/${USER_ID}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${USER_ID}" "$LAUNCH_AGENT_FILE"
launchctl enable "gui/${USER_ID}/${LAUNCH_AGENT_LABEL}"
launchctl kickstart -k "gui/${USER_ID}/${LAUNCH_AGENT_LABEL}"

printf '%s\n' \
  "$RESOLVER_MARKER" \
  'nameserver 127.0.0.1' \
  'port 53535' >"$RESOLVER_TEMP"
sudo mkdir -p "$RESOLVER_DIRECTORY"
sudo install -m 0644 "$RESOLVER_TEMP" "$RESOLVER_FILE"
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder >/dev/null 2>&1 || true

# Record the active resolver immediately. If a later certificate or DNS check
# fails, remove-local-domain.sh can still remove the new domain safely.
printf '%s\n' \
  "$RESOLVER_MARKER" \
  "APP_BASE_DOMAIN=${APP_BASE_DOMAIN}" >"$DOMAIN_STATE_TEMP"
install -m 0644 "$DOMAIN_STATE_TEMP" "$DOMAIN_STATE_FILE"

surplasse_local_info "Installing the mkcert authority in the local trust stores..."
mkcert -install
MKCERT_ROOT_CA="$(mkcert -CAROOT)/rootCA.pem"
[[ -f "$MKCERT_ROOT_CA" ]] || surplasse_local_die \
  "mkcert did not expose its root authority at ${MKCERT_ROOT_CA}."
mkdir -p "${REPOSITORY_ROOT}/.certs"

if [[ "$REGENERATE_CERTIFICATES" == true ]]; then
  rm -f "$SURPLASSE_LOCAL_CERT_FILE" "$SURPLASSE_LOCAL_KEY_FILE"
fi
certificate_pair_is_valid() {
  [[ -f "$SURPLASSE_LOCAL_CERT_FILE" && -f "$SURPLASSE_LOCAL_KEY_FILE" ]] || return 1
  openssl x509 -checkend 604800 -noout -in "$SURPLASSE_LOCAL_CERT_FILE" >/dev/null 2>&1 || return 1
  openssl verify -CAfile "$MKCERT_ROOT_CA" "$SURPLASSE_LOCAL_CERT_FILE" >/dev/null 2>&1 || return 1
  local subject_alternative_names
  subject_alternative_names="$(openssl x509 -noout -text -in "$SURPLASSE_LOCAL_CERT_FILE" 2>/dev/null)" || return 1
  tr ',' '\n' <<<"$subject_alternative_names" | \
    sed 's/^[[:space:]]*//' | \
    grep -Fxq "DNS:${APP_BASE_DOMAIN}" || return 1
  tr ',' '\n' <<<"$subject_alternative_names" | \
    sed 's/^[[:space:]]*//' | \
    grep -Fxq "DNS:*.${APP_BASE_DOMAIN}" || return 1
  openssl x509 -pubkey -noout -in "$SURPLASSE_LOCAL_CERT_FILE" >"$CERTIFICATE_PUBLIC_KEY_TEMP" 2>/dev/null || return 1
  openssl pkey -pubout -in "$SURPLASSE_LOCAL_KEY_FILE" >"$PRIVATE_KEY_PUBLIC_KEY_TEMP" 2>/dev/null || return 1
  cmp -s "$CERTIFICATE_PUBLIC_KEY_TEMP" "$PRIVATE_KEY_PUBLIC_KEY_TEMP"
}

if ! certificate_pair_is_valid; then
  if [[ -e "$SURPLASSE_LOCAL_CERT_FILE" || -e "$SURPLASSE_LOCAL_KEY_FILE" ]]; then
    surplasse_local_info "The existing certificate pair is incomplete, mismatched, missing SANs, or expires within seven days; regenerating it."
  fi
  rm -f "$SURPLASSE_LOCAL_CERT_FILE" "$SURPLASSE_LOCAL_KEY_FILE"
  mkcert \
    -cert-file "$SURPLASSE_LOCAL_CERT_FILE" \
    -key-file "$SURPLASSE_LOCAL_KEY_FILE" \
    "$APP_BASE_DOMAIN" "*.${APP_BASE_DOMAIN}"
fi
chmod 0600 "$SURPLASSE_LOCAL_KEY_FILE"

DNS_READY=false
for _attempt in {1..20}; do
  if dig +short @127.0.0.1 -p 53535 "probe.${APP_BASE_DOMAIN}" A 2>/dev/null | \
    grep -Fxq '127.0.0.1'; then
    DNS_READY=true
    break
  fi
  sleep 0.25
done
[[ "$DNS_READY" == true ]] || surplasse_local_die \
  "dnsmasq did not answer on 127.0.0.1:53535. Inspect ${DNSMASQ_LOG}."

SYSTEM_DNS_READY=false
for _attempt in {1..20}; do
  if dscacheutil -q host -a name "probe.${APP_BASE_DOMAIN}" 2>/dev/null | \
    grep -Eq 'ip_address: 127\.0\.0\.1'; then
    SYSTEM_DNS_READY=true
    break
  fi
  sleep 0.25
done
[[ "$SYSTEM_DNS_READY" == true ]] || surplasse_local_die \
  "macOS did not resolve probe.${APP_BASE_DOMAIN} through /etc/resolver. Rerun the setup, then inspect scutil --dns."

surplasse_local_info ""
surplasse_local_info "Local wildcard DNS and certificates are ready."
surplasse_local_info "  Domain:      ${APP_BASE_DOMAIN} and *.${APP_BASE_DOMAIN}"
surplasse_local_info "  DNS server:  127.0.0.1:53535"
surplasse_local_info "  Certificate: ${SURPLASSE_LOCAL_CERT_FILE}"
surplasse_local_info "Next: scripts/start-local-proxy.sh"
