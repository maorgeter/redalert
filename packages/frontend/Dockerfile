# Build context must be the MONOREPO ROOT:
#   docker build -f packages/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com \
#     --build-arg NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com \
#     -t alert-map-frontend .
#
# On Render: set "Root Directory" to `.` (repo root) and
#            "Dockerfile Path" to `packages/frontend/Dockerfile`

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests (enables npm workspaces dep resolution)
COPY package.json package-lock.json ./
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace deps
RUN npm ci --ignore-scripts

# Copy frontend source
COPY packages/frontend/next.config.mjs  ./packages/frontend/
COPY packages/frontend/tailwind.config.js ./packages/frontend/
COPY packages/frontend/postcss.config.js  ./packages/frontend/
COPY packages/frontend/tsconfig.json      ./packages/frontend/
COPY packages/frontend/src               ./packages/frontend/src
COPY packages/frontend/public            ./packages/frontend/public

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time — must be ARGs
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

WORKDIR /build/packages/frontend

RUN npm run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# next start needs the package.json for the "start" script
COPY --from=builder /build/packages/frontend/package.json ./

# Copy only what Next.js needs at runtime
COPY --from=builder /build/packages/frontend/.next/standalone ./
COPY --from=builder /build/packages/frontend/.next/static     ./.next/static
COPY --from=builder /build/packages/frontend/public           ./public

EXPOSE 3000

# next/standalone produces a self-contained server.js at the root
CMD ["node", "server.js"]
