# Caddy with the two fronts in it (deploy/docker-compose.prod.yml, service caddy): deploy/deploy.sh builds it on the VM, like
# the API's image, so it comes out ARM64 or x86-64 with no registry. Build context: the repo root (the fronts import
# packages/shared):   docker build -f deploy/caddy.Dockerfile .
# The Caddyfile is mounted by the compose file, not copied: it reads deploy/.env's variables when Caddy starts.

FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app
# Every workspace's package.json, so the lockfile matches; only the two fronts' dependencies (and packages/shared) get installed.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace apps/web --workspace apps/dashboard
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/dashboard apps/dashboard
# deploy/.env's PUBLIC_URL (the compose passes it): the address of the tables' QR codes in the dashboard. Only vite build:
# the typecheck is the CI's.
ARG PUBLIC_URL
RUN cd apps/web && npx vite build && cd ../dashboard && VITE_PUBLIC_URL="$PUBLIC_URL" npx vite build

FROM caddy:2.11.4-alpine
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/apps/dashboard/dist /srv/painel
# default_sni (deploy/Caddyfile) takes a host, not a URL: PUBLIC_HOST is PUBLIC_URL without its scheme.
CMD ["sh", "-c", "export PUBLIC_HOST=\"${PUBLIC_URL#*://}\" && exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
