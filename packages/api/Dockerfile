# Bogotá Insights API — Dockerfile
# Simple multi-stage build: deps → build → run with tsx

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN npm install -g pnpm@8.15.0
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN npm install -g pnpm@8.15.0
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN pnpm --filter @bogota-insights/shared build
RUN pnpm --filter @bogota-insights/api build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy full workspace — symlinks stay valid because /app path matches builder
COPY --from=builder /app ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001
USER apiuser

WORKDIR /app/packages/api
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
