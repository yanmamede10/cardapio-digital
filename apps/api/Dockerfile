# The API image for the VM (deploy/docker-compose.prod.yml). Build context: the repo root, because the API imports
# packages/shared:   docker build -f apps/api/Dockerfile .
# It runs the TypeScript with tsx, as dev and the tests do: @cardapio/shared is .ts source with no build step, so plain
# `node dist/index.js` can't load it. The same image runs db:deploy and the demo seed (deploy/deploy.sh), which need prisma and tsx.
# ponytail: tsx compiles on start (a second or so); bundle with esbuild if start time ever matters.

FROM node:22.23.3-bookworm-slim AS build
# Prisma picks its engine by the OpenSSL it finds: generate here, load it at runtime (same base below).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Every workspace's package.json, so the lockfile matches; only the API's dependencies (and packages/shared) get installed.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace apps/api && npm cache clean --force
COPY apps/api/prisma apps/api/prisma
# Inside the image, so "native" is the engine for the platform being built (linux-arm64 on the VM).
RUN cd apps/api && npx prisma generate
COPY packages/shared packages/shared
COPY apps/api apps/api

FROM node:22.23.3-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
WORKDIR /app/apps/api
# HOST: every interface of the container; only the compose network reaches it (Caddy publishes the ports, not the API).
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100 NPM_CONFIG_UPDATE_NOTIFIER=false
USER node
EXPOSE 4100
CMD ["node", "--import", "tsx", "src/index.ts"]
