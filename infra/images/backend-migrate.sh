#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

fail() {
  printf 'Database migration refused: %s\n' "$1" >&2
  exit "${2:-1}"
}

[[ $# -eq 0 ]] || fail "the command accepts no arguments" 64
[[ "${DEPLOYMENT_PROFILE:-}" == production ]] || \
  fail "DEPLOYMENT_PROFILE must be production" 64

direct_password="${QUARKUS_DATASOURCE_PASSWORD:-}"
password_file="${QUARKUS_DATASOURCE_PASSWORD_FILE:-}"
if [[ -n "$direct_password" && -n "$password_file" ]]; then
  fail "database password value and file cannot both be configured"
fi
[[ -z "$direct_password" ]] || fail "the database password must use a secret file"
[[ -n "$password_file" && -f "$password_file" && ! -L "$password_file" && -r "$password_file" ]] || \
  fail "the database password file is missing or unreadable"

QUARKUS_DATASOURCE_PASSWORD="$(<"$password_file")"
export QUARKUS_DATASOURCE_PASSWORD
unset QUARKUS_DATASOURCE_PASSWORD_FILE
[[ -n "$QUARKUS_DATASOURCE_PASSWORD" ]] || fail "the database password file is empty"
[[ -n "${QUARKUS_DATASOURCE_JDBC_URL:-}" ]] || \
  fail "QUARKUS_DATASOURCE_JDBC_URL is required" 64
[[ -n "${QUARKUS_DATASOURCE_USERNAME:-}" ]] || \
  fail "QUARKUS_DATASOURCE_USERNAME is required" 64

exec java \
  -Djava.util.logging.manager=org.jboss.logmanager.LogManager \
  -cp '/opt/surplasse/application/app/*:/opt/surplasse/application/lib/boot/*:/opt/surplasse/application/lib/main/*' \
  com.surplasse.application.migration.DatabaseMigrationCommand
