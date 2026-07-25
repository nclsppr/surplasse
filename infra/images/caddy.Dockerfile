# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG CADDY_BUILDER_IMAGE=scratch
ARG CADDY_RUNTIME_IMAGE=scratch
FROM ${CADDY_BUILDER_IMAGE} AS build

ARG CADDY_DNS_MODULE
RUN test -n "$CADDY_DNS_MODULE" \
    && xcaddy build --with "$CADDY_DNS_MODULE" --output /usr/bin/surplasse-caddy

FROM ${CADDY_RUNTIME_IMAGE}

COPY --from=build /usr/bin/surplasse-caddy /usr/bin/caddy
COPY --chmod=0555 infra/images/caddy-entrypoint.sh /usr/bin/surplasse-caddy-entrypoint

ENTRYPOINT ["/usr/bin/surplasse-caddy-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
