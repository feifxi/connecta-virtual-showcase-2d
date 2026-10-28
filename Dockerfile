# One image recipe for the monorepo · build a service with --target web | api | realtime | migrate
# Debian slim (glibc): sharp and @napi-rs/canvas ship prebuilt binaries for it
FROM node:24-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/realtime/package.json apps/realtime/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

FROM deps AS build
ARG BASE_PATH=""
ARG PUBLIC_REALTIME_URL=""
ENV BASE_PATH=$BASE_PATH PUBLIC_REALTIME_URL=$PUBLIC_REALTIME_URL NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
RUN npm run build -w @connecta/shared && npm run build -w @connecta/db \
 && npm run build -w @connecta/api && npm run build -w @connecta/realtime \
 && npm run build -w @connecta/web

# Production-only dependencies per service (no web/dev packages in the api or realtime image)
FROM node:24-bookworm-slim AS prod-api
WORKDIR /repo
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY --from=deps /repo/apps/api/package.json apps/api/
COPY --from=deps /repo/packages/db/package.json packages/db/
COPY --from=deps /repo/packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --no-audit --no-fund -w @connecta/api -w @connecta/db -w @connecta/shared

FROM node:24-bookworm-slim AS prod-realtime
WORKDIR /repo
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY --from=deps /repo/apps/realtime/package.json apps/realtime/
COPY --from=deps /repo/packages/db/package.json packages/db/
COPY --from=deps /repo/packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --no-audit --no-fund -w @connecta/realtime -w @connecta/db -w @connecta/shared

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN groupadd -r app && useradd -r -g app app

# Prisma migrations, run once per deploy before the apps start
FROM runtime AS migrate
COPY --from=build /repo /repo
USER app
CMD ["npx", "prisma", "migrate", "deploy", "--config", "packages/db/prisma.config.ts"]

FROM runtime AS api
COPY --from=prod-api /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/assets ./packages/shared/assets
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/packages/db/package.json ./packages/db/
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/
USER app
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM runtime AS realtime
COPY --from=prod-realtime /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/assets ./packages/shared/assets
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/packages/db/package.json ./packages/db/
COPY --from=build /repo/apps/realtime/dist ./apps/realtime/dist
COPY --from=build /repo/apps/realtime/package.json ./apps/realtime/
USER app
EXPOSE 2567
CMD ["node", "apps/realtime/dist/index.js"]

# Next.js standalone output (only what the server needs)
FROM runtime AS web
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER app
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
