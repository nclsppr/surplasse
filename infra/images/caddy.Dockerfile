# syntax=docker/dockerfile:1.7

ARG CADDY_BUILDER_IMAGE
ARG CADDY_RUNTIME_IMAGE
FROM ${CADDY_BUILDER_IMAGE} AS build

ARG CADDY_DNS_MODULE
RUN test -n "$CADDY_DNS_MODULE" \
    && xcaddy build --with "$CADDY_DNS_MODULE" --output /usr/bin/surplasse-caddy

FROM ${CADDY_RUNTIME_IMAGE}

COPY --from=build /usr/bin/surplasse-caddy /usr/bin/caddy
