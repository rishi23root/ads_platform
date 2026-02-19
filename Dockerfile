# Base stage
FROM node:20-alpine AS base
WORKDIR /app
# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage for development (includes devDependencies)
FROM base AS deps-dev
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# Dependencies stage for production (only production dependencies)
FROM base AS deps-prod
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
ENV NODE_ENV=development
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Build stage
FROM base AS builder
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .

# Next.js 16 requires DATABASE_URL during build for some static optimizations
# ENV DATABASE_URL=postgresql://user:password@localhost:5432/app_db
RUN pnpm build

# Production runner stage
FROM base AS runner
ENV NODE_ENV=production
# Add a non-root user for security
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migration SQL files aren't traced by Next.js — copy them so instrumentation can find them
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]