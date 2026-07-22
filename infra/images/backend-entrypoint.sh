#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

case "${DEPLOYMENT_PROFILE:-}" in
  development)
    export QUARKUS_PROFILE=dev
    ;;
  production)
    export QUARKUS_PROFILE=prod
    ;;
  *)
    printf 'Error: DEPLOYMENT_PROFILE must be development or production.\n' >&2
    exit 1
    ;;
esac

exec /opt/surplasse/scripts/run-with-domain-profile.sh \
  "$DEPLOYMENT_PROFILE" \
  java -jar /opt/surplasse/application/quarkus-run.jar
