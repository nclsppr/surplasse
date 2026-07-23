# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE
ARG NGINX_IMAGE
FROM ${NODE_IMAGE} AS build

ARG DOMAIN_PROFILE
ARG FRONTEND_NAME
ARG VITE_STRIPE_PUBLISHABLE_KEY=""
ENV VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}

WORKDIR /workspace
COPY frontends/shared/package.json frontends/shared/package-lock.json ./frontends/shared/
COPY frontends/design-system2/package.json frontends/design-system2/package-lock.json ./frontends/design-system2/
COPY frontends/${FRONTEND_NAME}/package.json frontends/${FRONTEND_NAME}/package-lock.json ./frontends/${FRONTEND_NAME}/
RUN case "$FRONTEND_NAME" in \
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
    && npm --prefix "frontends/${FRONTEND_NAME}" run build -- --mode "$DOMAIN_PROFILE" \
    && mkdir /output \
    && cp -R "frontends/${FRONTEND_NAME}/dist/." /output/

FROM ${NGINX_IMAGE} AS runtime

COPY infra/images/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /output/ /usr/share/nginx/html/

EXPOSE 8080
