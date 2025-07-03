# =============================================================================
# BATCH REFINEMENT SERVICE - STANDALONE DOCKERFILE
# =============================================================================
# Compatible with: Docker, Kubernetes, Cloud Run, ECS, Azure Container Instances

FROM node:18-alpine AS base
RUN apk add --no-cache curl postgresql-client

FROM base AS deps
WORKDIR /app
# Copy all necessary files first
COPY package*.json ./
COPY prisma ./prisma/
# Install dependencies and generate Prisma client
RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

FROM base AS builder
WORKDIR /app
# Copy all necessary files first
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
# Install dependencies, generate Prisma client, and build
RUN npm ci && \
    npx prisma generate && \
    npm run build && \
    cp -r src/generated dist/

FROM base AS runtime
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs batch-refinement

# Copy application
COPY --from=builder --chown=batch-refinement:nodejs /app/dist ./dist
COPY --from=deps --chown=batch-refinement:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=batch-refinement:nodejs /app/prisma ./prisma
COPY --from=builder --chown=batch-refinement:nodejs /app/src/generated ./dist/generated
COPY --chown=batch-refinement:nodejs package*.json ./

# Create directories and entrypoint
RUN mkdir -p logs data && chown -R batch-refinement:nodejs logs data
COPY --chown=batch-refinement:nodejs docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV AUTO_MIGRATE=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

USER batch-refinement
EXPOSE $PORT

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["start"] 