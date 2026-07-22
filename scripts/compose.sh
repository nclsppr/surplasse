#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROFILE="${1:-}"
case "$PROFILE" in
  development | production) ;;
  *)
    printf 'Error: usage: scripts/compose.sh <development|production> <docker compose arguments...>\n' >&2
    exit 1
    ;;
esac
shift
[[ "$#" -gt 0 ]] || {
  printf 'Error: Docker Compose arguments are required.\n' >&2
  exit 1
}
[[ "${1:-}" != -* ]] || {
  printf 'Error: the Docker Compose command must be the first argument after the profile.\n' >&2
  exit 1
}

if [[ "${SURPLASSE_DOMAIN_PROFILE_LOADED:-}" != "$PROFILE" ]]; then
  exec "${SCRIPT_DIR}/run-with-domain-profile.sh" \
    "$PROFILE" \
    env SURPLASSE_DOMAIN_PROFILE_LOADED="$PROFILE" \
    "$0" "$PROFILE" "$@"
fi

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_environment_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || return 1
  local raw_line line key value
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    line="$(trim_whitespace "$line")"
    [[ -n "$line" && "$line" != \#* ]] || continue
    [[ "$line" == *=* ]] || {
      printf 'Error: invalid dotenv assignment in %s.\n' "$file_path" >&2
      exit 1
    }
    key="$(trim_whitespace "${line%%=*}")"
    value="$(trim_whitespace "${line#*=}")"
    [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || {
      printf 'Error: invalid environment variable name in %s.\n' "$file_path" >&2
      exit 1
    }
    case "$key" in
      APP_SCHEME | APP_BASE_DOMAIN | APP_BASE_URL | ONBOARDING_URL | DASHBOARD_URL | API_URL | \
        LOCAL_CONTROL_URL | DOCS_URL | MAILPIT_URL | REPORTS_URL | GRAFANA_URL | PROBLEM_TYPE_BASE | COOKIE_DOMAIN | \
        RESERVED_SUBDOMAINS | CORS_PUBLIC_ORIGINS | SURPLASSE_PLATFORM_* | DEPLOYMENT_PROFILE)
        printf 'Error: %s belongs to the central domain profile and is forbidden in %s.\n' \
          "$key" "$file_path" >&2
        exit 1
        ;;
      BASH_ENV | BASHOPTS | CDPATH | ENV | GLOBIGNORE | HOME | IFS | OLDPWD | PATH | PWD | \
        SHELL | SHELLOPTS | ZDOTDIR | COMPOSE_FILE | COMPOSE_PROFILES | COMPOSE_ENV_FILES | \
        COMPOSE_PATH_SEPARATOR | DOCKER_* | GIT_* | LD_* | DYLD_* | SSH_*)
        printf 'Error: process control variable %s is forbidden in %s.\n' \
          "$key" "$file_path" >&2
        exit 1
        ;;
    esac
    if [[ ${#value} -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ ${#value} -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done <"$file_path"
}

require_variable() {
  local variable_name="$1"
  local value="${!variable_name:-}"
  [[ -n "$value" && "$value" != change-me* ]] || {
    printf 'Error: %s must be configured for the %s deployment.\n' "$variable_name" "$PROFILE" >&2
    exit 1
  }
}

require_protected_file() {
  local file_path="$1"
  local description="$2"
  [[ "$file_path" == /* ]] || {
    printf 'Error: %s must use an absolute path.\n' "$description" >&2
    exit 1
  }
  [[ -f "$file_path" && -r "$file_path" && -s "$file_path" ]] || {
    printf 'Error: %s is missing, empty or unreadable: %s\n' "$description" "$file_path" >&2
    exit 1
  }
}

file_permissions() {
  local file_path="$1"
  if stat -c '%a' "$file_path" >/dev/null 2>&1; then
    stat -c '%a' "$file_path"
  else
    stat -f '%Lp' "$file_path"
  fi
}

require_private_permissions() {
  local file_path="$1"
  local description="$2"
  local permissions
  permissions="$(file_permissions "$file_path")"
  [[ "$permissions" =~ ^[0-7]{3,4}$ ]] || {
    printf 'Error: unable to determine permissions for %s.\n' "$description" >&2
    exit 1
  }
  (( (8#$permissions & 077) == 0 )) || {
    printf 'Error: %s must not be accessible by group or others: %s (mode %s).\n' \
      "$description" "$file_path" "$permissions" >&2
    exit 1
  }
}

if [[ "$PROFILE" == development ]]; then
  load_environment_file "${REPOSITORY_ROOT}/backend/.env" || true
  load_environment_file "${REPOSITORY_ROOT}/frontends/commande/.env" || true
  load_environment_file "${REPOSITORY_ROOT}/config/deployment/development.env" || {
    printf 'Error: missing development deployment profile.\n' >&2
    exit 1
  }
  export LOCAL_TLS_CERTIFICATE_FILE="${REPOSITORY_ROOT}/.certs/${APP_BASE_DOMAIN}.pem"
  export LOCAL_TLS_PRIVATE_KEY_FILE="${REPOSITORY_ROOT}/.certs/${APP_BASE_DOMAIN}-key.pem"
  if [[ -z "${LOCAL_TLS_CA_FILE:-}" ]]; then
    LOCAL_TLS_CA_FILE="$LOCAL_TLS_CERTIFICATE_FILE"
    if command -v mkcert >/dev/null 2>&1; then
      MKCERT_CA_ROOT="$(mkcert -CAROOT 2>/dev/null || true)"
      if [[ -n "$MKCERT_CA_ROOT" && -f "${MKCERT_CA_ROOT}/rootCA.pem" ]]; then
        LOCAL_TLS_CA_FILE="${MKCERT_CA_ROOT}/rootCA.pem"
      fi
    fi
  fi
  [[ "$LOCAL_TLS_CA_FILE" == /* ]] || {
    printf 'Error: LOCAL_TLS_CA_FILE must use an absolute path.\n' >&2
    exit 1
  }
  export LOCAL_TLS_CA_FILE
  LOCAL_CONTROL_TOKEN_FILE="${REPOSITORY_ROOT}/.surplasse/dev-cockpit/upstream-token"
  node -e '
    const { randomBytes } = require("node:crypto");
    const { mkdirSync, writeFileSync } = require("node:fs");
    const { dirname } = require("node:path");
    const file = process.argv[1];
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(file, `${randomBytes(32).toString("hex")}\n`, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  ' "$LOCAL_CONTROL_TOKEN_FILE"
  [[ ! -L "$LOCAL_CONTROL_TOKEN_FILE" && -f "$LOCAL_CONTROL_TOKEN_FILE" ]] || {
    printf 'Error: invalid local cockpit upstream token file.\n' >&2
    exit 1
  }
  require_private_permissions "$LOCAL_CONTROL_TOKEN_FILE" "the local cockpit upstream token"
  LOCAL_CONTROL_TOKEN="$(tr -d '\r\n' <"$LOCAL_CONTROL_TOKEN_FILE")"
  [[ "$LOCAL_CONTROL_TOKEN" =~ ^[0-9a-f]{64}$ ]] || {
    printf 'Error: invalid local cockpit upstream token.\n' >&2
    exit 1
  }
  export LOCAL_CONTROL_TOKEN
  COMPOSE_OVERRIDE="${REPOSITORY_ROOT}/compose.development.yaml"
else
  SECRETS_FILE="${SURPLASSE_SECRETS_FILE:-}"
  [[ -n "$SECRETS_FILE" ]] || {
    printf 'Error: SURPLASSE_SECRETS_FILE must point to the protected production environment file.\n' >&2
    exit 1
  }
  [[ "$SECRETS_FILE" == /* ]] || {
    printf 'Error: SURPLASSE_SECRETS_FILE must be an absolute path.\n' >&2
    exit 1
  }
  load_environment_file "$SECRETS_FILE" || {
    printf 'Error: production environment file not found: %s\n' "$SECRETS_FILE" >&2
    exit 1
  }
  require_protected_file "$SECRETS_FILE" "the production environment file"
  require_private_permissions "$SECRETS_FILE" "the production environment file"
  for variable_name in \
    IMAGE_TAG \
    POSTGRES_PASSWORD \
    STRIPE_SECRET_KEY \
    STRIPE_PAYMENT_WEBHOOK_SECRET \
    STRIPE_ACCOUNT_WEBHOOK_SECRET \
    VITE_STRIPE_PUBLISHABLE_KEY \
    AUTH_JWT_PRIVATE_KEY_FILE \
    AUTH_JWT_JWKS_FILE \
    AUTH_JWT_KEY_ID \
    SMTP_HOST \
    SMTP_USERNAME \
    SMTP_PASSWORD \
    SMTP_FROM \
    CADDY_DNS_MODULE \
    CADDY_DNS_PROVIDER \
    DNS_API_TOKEN; do
    require_variable "$variable_name"
  done
  [[ "${STRIPE_LIVE_MODE:-}" == true ]] || {
    printf 'Error: STRIPE_LIVE_MODE must be true in production.\n' >&2
    exit 1
  }
  [[ "${ONBOARDING_STRIPE_PILOT_ENABLED:-}" == false ]] || {
    printf 'Error: ONBOARDING_STRIPE_PILOT_ENABLED must be false in production.\n' >&2
    exit 1
  }
  [[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ && "$IMAGE_TAG" != 0000000000000000000000000000000000000000 ]] || {
    printf 'Error: IMAGE_TAG must be the full lowercase 40-character git SHA in production.\n' >&2
    exit 1
  }
  [[ "$CADDY_DNS_MODULE" =~ ^[A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)+@[A-Za-z0-9._+~-]+$ ]] || {
    printf 'Error: CADDY_DNS_MODULE must be a valid versioned Go module path.\n' >&2
    exit 1
  }
  [[ "$CADDY_DNS_PROVIDER" =~ ^[a-z][a-z0-9_-]*$ ]] || {
    printf 'Error: CADDY_DNS_PROVIDER must be a valid Caddy provider identifier.\n' >&2
    exit 1
  }
  COMPOSE_OVERRIDE="${REPOSITORY_ROOT}/compose.production.yaml"
fi

load_environment_file "${REPOSITORY_ROOT}/config/deployment/images.env" || {
  printf 'Error: missing shared image catalog.\n' >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  printf 'Error: Docker is required.\n' >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  printf 'Error: the Docker Compose plugin is required.\n' >&2
  exit 1
}

export DEPLOYMENT_PROFILE="$PROFILE"
export COMPOSE_PROJECT_NAME

if [[ "$PROFILE" == development && "${1:-}" =~ ^(up|start|restart)$ ]]; then
  [[ -f "$LOCAL_TLS_CERTIFICATE_FILE" ]] || {
    printf 'Error: missing local certificate. Run npm run local:setup first.\n' >&2
    exit 1
  }
  [[ -f "$LOCAL_TLS_PRIVATE_KEY_FILE" ]] || {
    printf 'Error: missing local private key. Run npm run local:setup first.\n' >&2
    exit 1
  }
  [[ -f "$LOCAL_TLS_CA_FILE" ]] || {
    printf 'Error: missing local certificate authority: %s\n' "$LOCAL_TLS_CA_FILE" >&2
    exit 1
  }
fi

if [[ "$PROFILE" == production ]]; then
  compose_command="${1:-}"
  grafana_start_requested=false
  case "$compose_command" in
    up | start | restart | run)
      if [[ ",${COMPOSE_PROFILES:-}," == *,observability,* ]]; then
        grafana_start_requested=true
      else
        for compose_argument in "$@"; do
          if [[ "$compose_argument" == grafana ]]; then
            grafana_start_requested=true
            break
          fi
        done
      fi
      ;;
  esac
  if [[ "$grafana_start_requested" == true ]]; then
    for variable_name in \
      GRAFANA_ADMIN_USER \
      GRAFANA_ADMIN_PASSWORD \
      GRAFANA_SECRET_KEY; do
      require_variable "$variable_name"
    done
    [[ "${GRAFANA_BIND_ADDRESS:-}" == 127.0.0.1 ]] || {
      printf 'Error: GRAFANA_BIND_ADDRESS must be 127.0.0.1 in production.\n' >&2
      exit 1
    }
    [[ "${GRAFANA_PORT:-}" =~ ^[0-9]+$ ]] &&
      (( 10#$GRAFANA_PORT >= 1024 && 10#$GRAFANA_PORT <= 65535 )) || {
      printf 'Error: GRAFANA_PORT must be an integer between 1024 and 65535 in production.\n' >&2
      exit 1
    }
  fi
  case "$compose_command" in
    up | start | restart)
      require_protected_file "$AUTH_JWT_PRIVATE_KEY_FILE" "the JWT private key"
      require_private_permissions "$AUTH_JWT_PRIVATE_KEY_FILE" "the JWT private key"
      require_protected_file "$AUTH_JWT_JWKS_FILE" "the JWT public JWKS"
      ;;
  esac

  release_action=false
  case "$compose_command" in
    build | pull | push | up | start | restart)
      release_action=true
      ;;
  esac
  if [[ "$release_action" == true ]]; then
    command -v git >/dev/null 2>&1 || {
      printf 'Error: git is required for a production release action.\n' >&2
      exit 1
    }
    checked_out_commit="$(git -C "$REPOSITORY_ROOT" rev-parse --verify HEAD)"
    [[ "$IMAGE_TAG" == "$checked_out_commit" ]] || {
      printf 'Error: IMAGE_TAG must match the checked-out production commit: %s.\n' \
        "$checked_out_commit" >&2
      exit 1
    }
    [[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain --untracked-files=all)" ]] || {
      printf 'Error: the production worktree must be clean before a release action.\n' >&2
      exit 1
    }
  fi
fi

exec docker compose \
  --project-directory "$REPOSITORY_ROOT" \
  --project-name "$COMPOSE_PROJECT_NAME" \
  --file "${REPOSITORY_ROOT}/compose.yaml" \
  --file "$COMPOSE_OVERRIDE" \
  "$@"
