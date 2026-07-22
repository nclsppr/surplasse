# syntax=docker/dockerfile:1.7

ARG TEMURIN_BUILD_IMAGE
ARG TEMURIN_RUNTIME_IMAGE
FROM ${TEMURIN_BUILD_IMAGE} AS build

WORKDIR /workspace
ARG DOMAIN_PROFILE
COPY backend ./backend
RUN case "$DOMAIN_PROFILE" in \
      development) QUARKUS_BUILD_PROFILE=dev; PRODUCTION_ARTIFACT=false ;; \
      production) QUARKUS_BUILD_PROFILE=prod; PRODUCTION_ARTIFACT=true ;; \
      *) exit 64 ;; \
    esac \
    && cd backend \
    && ./mvnw --batch-mode --no-transfer-progress \
      -DskipTests \
      -Dquarkus.profile="$QUARKUS_BUILD_PROFILE" \
      -Dsurplasse.production-artifact="$PRODUCTION_ARTIFACT" \
      package \
    && if [ "$PRODUCTION_ARTIFACT" = true ]; then \
      CATALOG_JAR="$(find catalog/target -maxdepth 1 -type f -name 'catalog-*.jar' -print -quit)"; \
      test -n "$CATALOG_JAR"; \
      if jar tf "$CATALOG_JAR" | grep '^db/seed/' >/dev/null; then \
        printf 'Production artifact contains demo seed resources.\n' >&2; \
        exit 1; \
      fi; \
    fi

COPY config/domains ./config/domains
RUN case "$DOMAIN_PROFILE" in development|production) ;; *) exit 64 ;; esac \
    && mkdir -p /workspace/domain-config \
    && cp "config/domains/${DOMAIN_PROFILE}.env" /workspace/domain-config/

FROM ${TEMURIN_RUNTIME_IMAGE} AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 surplasse \
    && useradd --uid 10001 --gid surplasse --home-dir /opt/surplasse --shell /usr/sbin/nologin surplasse

WORKDIR /opt/surplasse
COPY --from=build --chown=surplasse:surplasse /workspace/backend/application/target/quarkus-app ./application
COPY --from=build --chown=surplasse:surplasse /workspace/domain-config ./config/domains
COPY --chown=surplasse:surplasse scripts/run-with-domain-profile.sh ./scripts/run-with-domain-profile.sh
COPY --chown=surplasse:surplasse infra/images/backend-entrypoint.sh ./scripts/backend-entrypoint.sh

USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/opt/surplasse/scripts/backend-entrypoint.sh"]
