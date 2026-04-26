# Bogotá Insights API — Dockerfile
# Multi-stage build for a pnpm monorepo workspace

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN npm install -g pnpm@8.15.0
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN npm install -g pnpm@8.15.0
WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared first (dependency of api)
RUN pnpm --filter @bogota-insights/shared build

# Build API
RUN pnpm --filter @bogota-insights/api build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@bogota-insights/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@bogota-insights/shared/package.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001
USER apiuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
