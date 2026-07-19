#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

surplasse_local_require_admin_access
if ! surplasse_local_caddy_admin_socket_exists; then
  if surplasse_local_caddy_admin_path_exists; then
    surplasse_local_die \
      "The protected Caddy admin path exists but is not a Unix socket. It was left untouched."
  fi
  surplasse_local_info "No Surplasse local proxy admin socket is present."
  exit 0
fi

surplasse_local_caddy_admin_is_ready || surplasse_local_die \
  "The protected Caddy admin socket exists but is unreachable. It was left untouched; inspect the running Caddy instance before retrying."
surplasse_local_caddy_is_ours || surplasse_local_die \
  "The protected Caddy admin socket belongs to another instance. It was left running."

CADDY_BIN="$(surplasse_local_find_caddy)"
sudo "$CADDY_BIN" stop --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
sudo rm -f "$SURPLASSE_CADDY_ADMIN_SOCKET"
sudo rmdir "$SURPLASSE_CADDY_RUNTIME_DIRECTORY" >/dev/null 2>&1 || true
surplasse_local_info "The Surplasse local proxy has stopped."
