# Build context must be the MONOREPO ROOT:
#   docker build -f packages/backend/Dockerfile -t alert-map-backend .
#
# On Render: set "Root Directory" to `.` (repo root) and
#            "Dockerfile Path" to `packages/backend/Dockerfile`

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests (enables npm workspaces dep resolution)
COPY package.json package-lock.json ./
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace deps hoisted to root node_modules
RUN npm ci --ignore-scripts

# Copy backend source
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src            ./packages/backend/src
COPY packages/backend/data           ./packages/backend/data

# Compile TypeScript → packages/backend/dist/
RUN npm run build -w packages/backend


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Production deps only (no devDependencies)
RUN npm ci --omit=dev --ignore-scripts

# Compiled output and static data
COPY --from=builder /build/packages/backend/dist ./packages/backend/dist
COPY --from=builder /build/packages/backend/data ./packages/backend/data

WORKDIR /app/packages/backend

# Render injects PORT automatically; 3001 is the local dev fallback
EXPOSE 3001

CMD ["node", "dist/server.js"]
