#!/usr/bin/env bash

set -euo pipefail

SURPLASSE_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_verification() {
  exec bash "$SURPLASSE_REPO_ROOT/scripts/run-with-domain-profile.sh" \
    development \
    "$SURPLASSE_REPO_ROOT/backend/mvnw" \
    -f "$SURPLASSE_REPO_ROOT/backend/pom.xml" \
    -B \
    verify \
    "$@"
}

if command -v java >/dev/null 2>&1 && java -version 2>&1 | head -n 1 | grep -Eq 'version "21([."]|$)'; then
  run_verification
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Backend verification requires Java 21 or a running Docker daemon." >&2
  exit 1
fi

mkdir -p "$SURPLASSE_REPO_ROOT/.surplasse/maven"

SURPLASSE_DOCKER_SOCKET_GROUP="$(
  docker run --rm \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    eclipse-temurin:21-jdk \
    stat -c '%g' /var/run/docker.sock
)"
if [[ ! "$SURPLASSE_DOCKER_SOCKET_GROUP" =~ ^[0-9]+$ ]]; then
  echo "The Docker socket group could not be determined." >&2
  exit 1
fi

exec docker run --rm \
  --user "$(id -u):$(id -g)" \
  --group-add "$SURPLASSE_DOCKER_SOCKET_GROUP" \
  --env MAVEN_USER_HOME=/workspace/.surplasse/maven \
  --env DOCKER_HOST=unix:///var/run/docker.sock \
  --volume "$SURPLASSE_REPO_ROOT:/workspace" \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --workdir /workspace \
  eclipse-temurin:21-jdk \
  bash scripts/run-with-domain-profile.sh \
  development \
  ./backend/mvnw \
  -f backend/pom.xml \
  -B \
  -Dmaven.repo.local=/workspace/.surplasse/maven \
  verify
