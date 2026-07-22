# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE
ARG NGINX_IMAGE
FROM ${NODE_IMAGE} AS build

WORKDIR /workspace
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libicu72 libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY docs ./docs
COPY retype.yml ./retype.yml
RUN npm run docs:build

FROM ${NGINX_IMAGE}

COPY infra/images/docs-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/docs-site/ /usr/share/nginx/html/surplasse/docs/

EXPOSE 8080
