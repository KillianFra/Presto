# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

FROM base AS dependencies
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.json ./
COPY src ./src
RUN DATABASE_URL="postgresql://presto:presto@db:5432/presto?schema=public" pnpm run db:generate
RUN pnpm run build

FROM dependencies AS migration
COPY prisma ./prisma
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM build AS production-dependencies
RUN pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=production-dependencies /app/package.json ./package.json
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
USER node
CMD ["node", "dist/server.js"]
