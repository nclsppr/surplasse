# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# check=error=true

ARG NODE_IMAGE=scratch
ARG NGINX_IMAGE=scratch
FROM ${NODE_IMAGE} AS build

ARG DOMAIN_PROFILE
ARG FRONTEND_NAME
ARG STRIPE_PUBLIC_VALUE=""

WORKDIR /workspace
COPY frontends/shared/package.json frontends/shared/package-lock.json ./frontends/shared/
COPY frontends/design-system2/package.json frontends/design-system2/package-lock.json ./frontends/design-system2/
COPY frontends/${FRONTEND_NAME}/package.json frontends/${FRONTEND_NAME}/package-lock.json ./frontends/${FRONTEND_NAME}/
RUN --mount=type=cache,id=surplasse-npm,target=/root/.npm,sharing=locked \
    case "$FRONTEND_NAME" in \
      onboarding2) npm ci --prefix frontends/design-system2 ;; \
      commande2|dashboard2) npm ci --prefix frontends/shared && npm ci --prefix frontends/design-system2 ;; \
      *) exit 64 ;; \
    esac \
    && npm ci --prefix "frontends/${FRONTEND_NAME}"

COPY config/domains ./config/domains
COPY brand ./brand
COPY frontends/shared ./frontends/shared
COPY frontends/design-system2 ./frontends/design-system2
COPY frontends/${FRONTEND_NAME} ./frontends/${FRONTEND_NAME}

RUN case "$DOMAIN_PROFILE" in development) ;; *) exit 64 ;; esac \
    && case "$FRONTEND_NAME" in onboarding2|commande2|dashboard2) ;; *) exit 64 ;; esac \
    && VITE_STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLIC_VALUE" \
      npm --prefix "frontends/${FRONTEND_NAME}" run build -- --mode "$DOMAIN_PROFILE" \
    && mkdir /output \
    && cp -R "frontends/${FRONTEND_NAME}/dist/." /output/

FROM ${NGINX_IMAGE} AS runtime

COPY infra/images/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /output/ /usr/share/nginx/html/

EXPOSE 8080
