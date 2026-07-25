# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG TEMURIN_BUILD_IMAGE=scratch
ARG TEMURIN_RUNTIME_IMAGE=scratch
FROM ${TEMURIN_BUILD_IMAGE} AS build

WORKDIR /workspace
ARG DOMAIN_PROFILE
COPY backend ./backend
RUN --mount=type=cache,id=surplasse-maven,target=/root/.m2,sharing=locked \
    case "$DOMAIN_PROFILE" in \
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

RUN groupadd --gid 10001 surplasse \
    && useradd \
      --no-log-init \
      --uid 10001 \
      --gid surplasse \
      --home-dir /opt/surplasse \
      --shell /usr/sbin/nologin \
      surplasse

WORKDIR /opt/surplasse
COPY --from=build --chown=surplasse:surplasse /workspace/backend/application/target/quarkus-app ./application
COPY --from=build --chown=surplasse:surplasse /workspace/domain-config ./config/domains
COPY --chmod=0555 --chown=surplasse:surplasse scripts/run-with-domain-profile.sh ./scripts/run-with-domain-profile.sh
COPY --chmod=0555 --chown=surplasse:surplasse infra/images/backend-entrypoint.sh ./scripts/backend-entrypoint.sh
COPY --chmod=0555 --chown=surplasse:surplasse infra/images/backend-healthcheck.sh ./scripts/backend-healthcheck.sh

USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/opt/surplasse/scripts/backend-entrypoint.sh"]
