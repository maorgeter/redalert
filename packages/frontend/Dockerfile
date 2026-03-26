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
# outputFileTracingRoot = monorepo root (/build) means Next.js mirrors the full
# monorepo path inside standalone.  The actual layout after the COPY is:
#
#   /app/
#   ├── node_modules/               ← traced workspace deps (from /build/node_modules)
#   └── packages/frontend/
#       ├── server.js               ← entry point (app-relative path, NOT root)
#       └── .next/server/           ← compiled server chunks
#
COPY --from=builder /build/packages/frontend/.next/standalone ./

# Static assets go where server.js's process.chdir(__dirname) will look:
# __dirname = /app/packages/frontend → expects .next/static there
COPY --from=builder /build/packages/frontend/.next/static \
     ./packages/frontend/.next/static

# Public assets — same relative location
RUN mkdir -p ./packages/frontend/public
COPY --from=builder /build/packages/frontend/public \
     ./packages/frontend/public

EXPOSE 3000

# server.js lives at packages/frontend/server.js (monorepo-mirrored path).
# On failure the shell prints a directory listing so the next debug is easy.
CMD ["sh", "-c", \
  "node packages/frontend/server.js || \
   (echo '--- /app layout (no node_modules) ---' && \
    find /app -maxdepth 4 ! -path '*/node_modules/*' && exit 1)"]
