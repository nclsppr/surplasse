#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROFILE="${1:-}"
[[ "$PROFILE" == development ]] || {
  printf 'Error: usage: scripts/compose.sh development <docker compose arguments...>\n' >&2
  exit 1
}
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
        DOCS_URL | MAILPIT_URL | GRAFANA_URL | PROBLEM_TYPE_BASE | \
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

prepare_secret_directory() {
  local directory_path="$1"
  [[ "$directory_path" == /* ]] || {
    printf 'Error: the Compose secret directory must use an absolute path.\n' >&2
    exit 1
  }
  [[ ! -L "$directory_path" ]] || {
    printf 'Error: the Compose secret directory cannot be a symbolic link: %s\n' \
      "$directory_path" >&2
    exit 1
  }
  mkdir -p "$directory_path"
  chmod 0700 "$directory_path"
  [[ -d "$directory_path" && ! -L "$directory_path" ]] || {
    printf 'Error: invalid Compose secret directory: %s\n' "$directory_path" >&2
    exit 1
  }
}

install_materialized_secret() {
  local temporary_path="$1"
  local target_path="$2"

  if [[ -L "$target_path" ]]; then
    rm -f "$temporary_path"
    printf 'Error: a Compose secret target cannot be a symbolic link: %s\n' \
      "$target_path" >&2
    exit 1
  fi
  chmod 0444 "$temporary_path"

  if [[ -f "$target_path" ]] && cmp -s "$temporary_path" "$target_path"; then
    rm -f "$temporary_path"
    chmod 0444 "$target_path"
    return
  fi
  mv -f "$temporary_path" "$target_path"
}

materialize_secret() {
  local variable_name="$1"
  local file_name="$2"
  local target_path="${COMPOSE_SECRET_DIRECTORY}/${file_name}"
  local temporary_path

  temporary_path="$(mktemp "${COMPOSE_SECRET_DIRECTORY}/.${file_name}.XXXXXX")"
  printf '%s' "${!variable_name:-}" >"$temporary_path"
  install_materialized_secret "$temporary_path" "$target_path"
  export "COMPOSE_SECRET_${variable_name}_FILE=$target_path"
}

materialize_secret_file() {
  local source_variable_name="$1"
  local file_name="$2"
  local target_path="${COMPOSE_SECRET_DIRECTORY}/${file_name}"
  local temporary_path

  temporary_path="$(mktemp "${COMPOSE_SECRET_DIRECTORY}/.${file_name}.XXXXXX")"
  cp "${!source_variable_name}" "$temporary_path"
  install_materialized_secret "$temporary_path" "$target_path"
  export "${source_variable_name}=$target_path"
}

load_environment_file "${REPOSITORY_ROOT}/backend/.env" || true
load_environment_file "${REPOSITORY_ROOT}/frontends/commande/.env" || true
load_environment_file "${REPOSITORY_ROOT}/config/deployment/development.env" || {
  printf 'Error: missing development deployment profile.\n' >&2
  exit 1
}
load_environment_file "${REPOSITORY_ROOT}/config/deployment/images.env" || {
  printf 'Error: missing shared image catalog.\n' >&2
  exit 1
}

for optional_secret in \
  SMTP_PASSWORD \
  SMTP_USERNAME \
  STRIPE_ACCOUNT_WEBHOOK_SECRET \
  STRIPE_PAYMENT_WEBHOOK_SECRET \
  STRIPE_SECRET_KEY; do
  export "$optional_secret=${!optional_secret:-}"
done

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

command -v docker >/dev/null 2>&1 || {
  printf 'Error: Docker is required.\n' >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  printf 'Error: the Docker Compose plugin is required.\n' >&2
  exit 1
}

export DEPLOYMENT_PROFILE=development
export COMPOSE_PROJECT_NAME

if [[ "${1:-}" =~ ^(up|start|restart)$ ]]; then
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

COMPOSE_SECRET_DIRECTORY="${REPOSITORY_ROOT}/.surplasse/compose-secrets/development"
prepare_secret_directory "$COMPOSE_SECRET_DIRECTORY"
if [[ -f "$LOCAL_TLS_PRIVATE_KEY_FILE" ]]; then
  materialize_secret_file LOCAL_TLS_PRIVATE_KEY_FILE local_tls_private_key
fi
for secret_variable in \
  GRAFANA_ADMIN_PASSWORD \
  GRAFANA_SECRET_KEY \
  POSTGRES_PASSWORD \
  SMTP_PASSWORD \
  SMTP_USERNAME \
  STRIPE_ACCOUNT_WEBHOOK_SECRET \
  STRIPE_PAYMENT_WEBHOOK_SECRET \
  STRIPE_SECRET_KEY; do
  materialize_secret "$secret_variable" "$secret_variable"
done
unset \
  GRAFANA_ADMIN_PASSWORD \
  GRAFANA_SECRET_KEY \
  POSTGRES_PASSWORD \
  SMTP_PASSWORD \
  SMTP_USERNAME \
  STRIPE_ACCOUNT_WEBHOOK_SECRET \
  STRIPE_PAYMENT_WEBHOOK_SECRET \
  STRIPE_SECRET_KEY

exec docker compose \
  --project-directory "$REPOSITORY_ROOT" \
  --project-name "$COMPOSE_PROJECT_NAME" \
  --file "${REPOSITORY_ROOT}/compose.yaml" \
  --file "${REPOSITORY_ROOT}/compose.development.yaml" \
  "$@"
