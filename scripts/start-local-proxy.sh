#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/local-domain.sh
source "${SCRIPT_DIR}/lib/local-domain.sh"

REPOSITORY_ROOT="$(surplasse_local_repo_root)"
surplasse_local_load_config "$REPOSITORY_ROOT"

[[ -f "$SURPLASSE_LOCAL_CERT_FILE" ]] || surplasse_local_die \
  "missing local certificate. Run scripts/setup-local-domain.sh first."
[[ -f "$SURPLASSE_LOCAL_KEY_FILE" ]] || surplasse_local_die \
  "missing local private key. Run scripts/setup-local-domain.sh first."

# Stop the pre-Compose host Caddy only when its protected identity proves that
# it belongs to Surplasse. This migration path can be removed after all local
# workstations have moved to the containerized edge.
if surplasse_local_caddy_admin_socket_exists; then
  surplasse_local_require_admin_access
  surplasse_local_caddy_admin_is_ready || surplasse_local_die \
    "The protected Caddy admin socket exists but is unreachable. It was left untouched; inspect the running Caddy instance before retrying."
  surplasse_local_caddy_is_ours || surplasse_local_die \
    "The protected Caddy admin socket belongs to another instance. It was left untouched."
  CADDY_BIN="$(surplasse_local_find_caddy)"
  sudo "$CADDY_BIN" stop --address "unix//${SURPLASSE_CADDY_ADMIN_SOCKET}"
  sudo rm -f "$SURPLASSE_CADDY_ADMIN_SOCKET"
  sudo rmdir "$SURPLASSE_CADDY_RUNTIME_DIRECTORY" >/dev/null 2>&1 || true
elif surplasse_local_caddy_admin_path_exists; then
  surplasse_local_die \
    "The protected Caddy admin path exists but is not a Unix socket. It was left untouched."
fi

exec "${SCRIPT_DIR}/compose.sh" development up --detach --build --wait edge
