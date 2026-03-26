# Build context must be the MONOREPO ROOT:
#   docker build -f packages/backend/Dockerfile -t alert-map-backend .
#
# On Render: Root Directory = `.`  |  Dockerfile Path = packages/backend/Dockerfile

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests so npm resolves both packages
COPY package.json package-lock.json ./
RUN mkdir -p packages/backend packages/frontend
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace deps (hoisted to /build/node_modules)
RUN npm ci --ignore-scripts

# Copy backend source + static data
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src            ./packages/backend/src
COPY packages/backend/data           ./packages/backend/data

# Compile TypeScript → packages/backend/dist/
RUN npm run build -w packages/backend


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for production dep install
COPY package.json package-lock.json ./
RUN mkdir -p packages/backend packages/frontend
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Production deps only — run scripts allowed so native addons (e.g. pg) build
RUN npm ci --omit=dev

# Compiled JS + geofence data
COPY --from=builder /build/packages/backend/dist ./packages/backend/dist
COPY --from=builder /build/packages/backend/data ./packages/backend/data

WORKDIR /app/packages/backend

# Render overrides PORT automatically; 3001 is the local fallback
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
