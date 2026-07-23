# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE
ARG NGINX_IMAGE
FROM ${NODE_IMAGE} AS build

ARG NIMBUS_SITE_ORIGIN
ARG NIMBUS_BASE_PATH

WORKDIR /workspace
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libicu72 libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY docs-nimbus/package.json docs-nimbus/package-lock.json ./docs-nimbus/
RUN npm ci
RUN npm ci --prefix docs-nimbus
COPY docs ./docs
COPY docs-nimbus ./docs-nimbus
COPY brand ./brand
COPY retype.yml ./retype.yml
RUN npm run docs:build \
    && NIMBUS_SITE_ORIGIN="${NIMBUS_SITE_ORIGIN}" \
       NIMBUS_BASE_PATH="${NIMBUS_BASE_PATH}" \
       npm --prefix docs-nimbus run build

FROM ${NGINX_IMAGE}

COPY infra/images/docs-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/docs-site/ /usr/share/nginx/html/surplasse/docs/
COPY --from=build /workspace/docs-nimbus/dist/ /usr/share/nginx/html/_experiments/nimbus-docs/

EXPOSE 8080
