# syntax=docker/dockerfile:1

# ─── Frontend build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm run build

# ─── Backend: install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS backend-deps
WORKDIR /app
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Backend: compile TypeScript ─────────────────────────────────────────────
FROM backend-deps AS backend-build
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x?schema=public" pnpm run db:generate
RUN pnpm run build

# ─── Backend: production deps only ───────────────────────────────────────────
FROM backend-deps AS backend-prod-deps
RUN pnpm prune --prod

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-prod-deps /app/package.json ./package.json
COPY --from=backend-prod-deps /app/node_modules ./node_modules
COPY --from=backend-prod-deps /app/prisma ./prisma
COPY --from=backend-build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3000
USER node
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node dist/server.js"]
