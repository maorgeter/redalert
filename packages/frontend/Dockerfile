# Build context must be the MONOREPO ROOT:
#   docker build -f packages/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com \
#     --build-arg NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com \
#     -t alert-map-frontend .
#
# On Render: Root Directory = `.`  |  Dockerfile Path = packages/frontend/Dockerfile

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests so npm knows about both packages
COPY package.json package-lock.json ./
RUN mkdir -p packages/backend packages/frontend
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace deps (hoisted to /build/node_modules)
RUN npm ci --ignore-scripts

# Copy entire frontend source (avoids missing-file errors for optional configs)
COPY packages/frontend ./packages/frontend

# NEXT_PUBLIC_* are baked into the JS bundle at compile time — inject as ARGs
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

WORKDIR /build/packages/frontend

# next.config.mjs sets outputFileTracingRoot to /build (monorepo root).
# Standalone output structure:
#   .next/standalone/
#   ├── server.js              ← entry point
#   ├── node_modules/          ← traced workspace deps
#   └── packages/frontend/     ← app server chunks
RUN npm run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy the entire standalone directory.
# Because outputFileTracingRoot = monorepo root, server.js lands at /app/server.js
# and the app's chunks are at /app/packages/frontend/
COPY --from=builder /build/packages/frontend/.next/standalone ./

# Static assets: Next.js serves /_next/static from the app's .next/static dir,
# which relative to the standalone root is packages/frontend/.next/static
COPY --from=builder /build/packages/frontend/.next/static \
     ./packages/frontend/.next/static

# Public assets: same monorepo-relative path within standalone
# (mkdir ensures this works even if the public dir is empty / doesn't exist)
RUN mkdir -p ./packages/frontend/public
COPY --from=builder /build/packages/frontend/public \
     ./packages/frontend/public

EXPOSE 3000

# server.js is at /app/server.js — run it directly from WORKDIR /app
CMD ["node", "server.js"]
