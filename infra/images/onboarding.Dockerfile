# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG NODE_IMAGE=scratch
ARG NGINX_IMAGE=scratch
ARG DOMAIN_PROFILE=production
FROM ${NODE_IMAGE} AS prepare

ARG DOMAIN_PROFILE
WORKDIR /workspace
COPY config/domains ./config/domains
COPY config/deployment/load-production-release-config.mjs config/deployment/production-release.env ./config/deployment/
COPY brand ./brand
COPY frontends/onboarding ./frontends/onboarding
RUN case "$DOMAIN_PROFILE" in development|production) ;; *) exit 64 ;; esac \
    && node config/domains/generate-onboarding-config.mjs --profile "$DOMAIN_PROFILE" \
    && mkdir -p "/output/config/domains" "/output/frontends" \
    && cp config/domains/load-domain-config.mjs "/output/config/domains/" \
    && cp "config/domains/${DOMAIN_PROFILE}.env" "/output/config/domains/" \
    && cp -R frontends/onboarding "/output/frontends/" \
    && cp -R brand "/output/brand" \
    && cp frontends/onboarding/index.css "/output/brand/onboarding.css" \
    && cp frontends/onboarding/index.js "/output/brand/onboarding.js" \
    && if [ "$DOMAIN_PROFILE" = production ]; then \
      rm -f "/output/brand/qr/qr-demo-development.png"; \
    fi

FROM ${NODE_IMAGE} AS runtime-development

WORKDIR /opt/surplasse
COPY --from=prepare --chown=node:node /output/brand ./brand
COPY --from=prepare --chown=node:node /output/config ./config
COPY --from=prepare --chown=node:node /output/frontends ./frontends
COPY --chown=node:node scripts/onboarding-server/onboarding-server.mjs ./scripts/onboarding-server/onboarding-server.mjs
COPY --chown=node:node scripts/onboarding-server/public-files.mjs ./scripts/onboarding-server/public-files.mjs

USER node
EXPOSE 4173
CMD ["node", "/opt/surplasse/scripts/onboarding-server/onboarding-server.mjs"]

FROM ${NGINX_IMAGE} AS runtime-production

COPY infra/images/onboarding-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=prepare /output/brand /usr/share/nginx/html/brand
COPY --from=prepare /output/frontends /usr/share/nginx/html/frontends

EXPOSE 8080

FROM runtime-${DOMAIN_PROFILE} AS runtime
