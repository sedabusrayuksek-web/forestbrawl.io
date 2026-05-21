FROM node:24-alpine

WORKDIR /app

# Copy workspace files
COPY artifacts/package.json .
COPY artifacts/pnpm-workspace.yaml .
COPY artifacts/pnpm-lock.yaml .
COPY artifacts/tsconfig.base.json .
COPY artifacts/api-server ./api-server
COPY artifacts/forestbrawl ./forestbrawl

# Install pnpm globally
RUN npm install -g pnpm@10

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build frontend and API
RUN pnpm --filter @workspace/forestbrawl run build
RUN pnpm --filter @workspace/api-server run build

# Expose port
EXPOSE 8080

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/healthz', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "--enable-source-maps", "api-server/dist/index.mjs"]
