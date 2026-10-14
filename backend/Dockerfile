# syntax=docker/dockerfile:1

# One image for the API and the BullMQ workers; compose picks the command.
#   api:    node index.js  (default CMD)
#   worker: concurrently, same arguments as `npm run worker:all`. Do not use
#           npm itself here: npm exits on SIGTERM without waiting for its
#           children, so the container stops and the workers are SIGKILLed mid-job.

ARG NODE_VERSION=22

# ---- production dependencies ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
# bcrypt is a native module: the toolchain covers a missing prebuilt musl binary
# and stays in this stage only
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

# tini -g forwards SIGTERM to the whole process group, so every worker under
# concurrently receives it directly
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PATH=/app/node_modules/.bin:$PATH

# Code and dependencies stay root-owned (read-only for the app user); only the
# upload scratch folder is writable. Mount the same volume at /app/public/temp
# in the api and worker containers: the image worker reads files the API wrote.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public/temp && chown -R node:node public/temp

USER node
EXPOSE 3000

# Only meaningful for the API; disable it on the worker service in compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["node", "index.js"]
