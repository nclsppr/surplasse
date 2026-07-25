# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG NODE_IMAGE=scratch
ARG NGINX_IMAGE=scratch
FROM ${NODE_IMAGE} AS build

ARG NIMBUS_SITE_ORIGIN
ARG NIMBUS_BASE_PATH

WORKDIR /workspace
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libicu72 libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY docs-nimbus/package.json docs-nimbus/package-lock.json ./docs-nimbus/
RUN --mount=type=cache,id=surplasse-npm,target=/root/.npm,sharing=locked \
    npm ci \
    && npm ci --prefix docs-nimbus
COPY docs ./docs
COPY docs-nimbus ./docs-nimbus
COPY brand ./brand
COPY scripts/build-docs-with-retry.sh ./scripts/build-docs-with-retry.sh
COPY retype.yml ./retype.yml
RUN bash scripts/build-docs-with-retry.sh \
    && NIMBUS_SITE_ORIGIN="${NIMBUS_SITE_ORIGIN}" \
       NIMBUS_BASE_PATH="${NIMBUS_BASE_PATH}" \
       npm --prefix docs-nimbus run build

FROM ${NGINX_IMAGE}

COPY infra/images/docs-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/docs-site/ /usr/share/nginx/html/surplasse/docs/
COPY --from=build /workspace/docs-nimbus/dist/ /usr/share/nginx/html/_experiments/nimbus-docs/

EXPOSE 8080
