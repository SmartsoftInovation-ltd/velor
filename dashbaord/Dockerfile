# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---- build ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Vite inlines VITE_* into the bundle at build time. VITE_API_URL and
# VITE_SOCKET_URL are required: the app throws on load without them.
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_WORKSPACE_DOMAIN
ARG VITE_PLATFORM_WORKSPACES
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_WORKSPACE_DOMAIN=$VITE_WORKSPACE_DOMAIN \
    VITE_PLATFORM_WORKSPACES=$VITE_PLATFORM_WORKSPACES

COPY . .
RUN npm run build

# ---- runtime: static files behind nginx ----
# The nginx master binds :80 as root; the workers that serve requests run as
# the unprivileged "nginx" user.
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
