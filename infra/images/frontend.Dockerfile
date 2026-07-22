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
COPY frontends/commande/package.json frontends/commande/package-lock.json ./frontends/commande/
COPY frontends/dashboard/package.json frontends/dashboard/package-lock.json ./frontends/dashboard/
RUN npm ci --prefix frontends/shared \
    && npm ci --prefix frontends/commande \
    && npm ci --prefix frontends/dashboard

COPY config/domains ./config/domains
COPY brand ./brand
COPY frontends/shared ./frontends/shared
COPY frontends/commande ./frontends/commande
COPY frontends/dashboard ./frontends/dashboard

RUN case "$DOMAIN_PROFILE" in development|production) ;; *) exit 64 ;; esac \
    && case "$FRONTEND_NAME" in commande|dashboard) ;; *) exit 64 ;; esac \
    && npm --prefix "frontends/${FRONTEND_NAME}" run build -- --mode "$DOMAIN_PROFILE" \
    && mkdir /output \
    && cp -R "frontends/${FRONTEND_NAME}/dist/." /output/

FROM ${NGINX_IMAGE} AS runtime

COPY infra/images/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /output/ /usr/share/nginx/html/

EXPOSE 8080
