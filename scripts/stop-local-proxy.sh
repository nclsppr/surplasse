#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

"${SCRIPT_DIR}/compose.sh" development stop edge

if surplasse_local_caddy_admin_socket_exists; then
  surplasse_local_require_admin_access
  surplasse_local_caddy_admin_is_ready || surplasse_local_die \
    "The protected legacy Caddy socket exists but is unreachable. It was left untouched."
  surplasse_local_caddy_is_ours || surplasse_local_die \
    "The protected legacy Caddy socket belongs to another instance. It was left running."
  CADDY_BIN="$(surplasse_local_find_caddy)"
  sudo "$CADDY_BIN" stop --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
  sudo rm -f "$SURPLASSE_CADDY_ADMIN_SOCKET"
  sudo rmdir "$SURPLASSE_CADDY_RUNTIME_DIRECTORY" >/dev/null 2>&1 || true
fi

surplasse_local_info "The Surplasse edge has stopped."
