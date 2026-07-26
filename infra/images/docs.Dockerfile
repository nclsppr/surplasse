# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG NODE_IMAGE=scratch
ARG NGINX_IMAGE=scratch
FROM ${NODE_IMAGE} AS build

ARG NIMBUS_SITE_ORIGIN
ARG NIMBUS_BASE_PATH

WORKDIR /workspace
COPY docs-nimbus/package.json docs-nimbus/package-lock.json ./docs-nimbus/
RUN --mount=type=cache,id=surplasse-npm,target=/root/.npm,sharing=locked \
    npm ci --prefix docs-nimbus
COPY docs ./docs
COPY docs-nimbus ./docs-nimbus
COPY brand ./brand
RUN NIMBUS_SITE_ORIGIN="${NIMBUS_SITE_ORIGIN}" \
    NIMBUS_BASE_PATH="${NIMBUS_BASE_PATH}" \
    npm --prefix docs-nimbus run check

FROM ${NGINX_IMAGE}

COPY infra/images/docs-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/docs-nimbus/dist/ /usr/share/nginx/html/

EXPOSE 8080
