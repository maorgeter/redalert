# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY packages/backend/package.json  ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace deps
RUN npm ci --ignore-scripts

# --- התיקון כאן: מעתיקים את כל התיקייה במקום קובץ-קובץ ---
COPY packages/frontend ./packages/frontend

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

WORKDIR /build/packages/frontend

# מריצים build (ה-standalone דורש הגדרה ב-next.config.mjs שקלוד כבר הוסיף לך)
RUN npm run build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# העתקת התוצרים מה-builder
COPY --from=builder /build/packages/frontend/package.json ./
COPY --from=builder /build/packages/frontend/.next/standalone ./
COPY --from=builder /build/packages/frontend/.next/static ./.next/static

# פתרון לבעיית ה-public: מעתיקים רק אם התיקייה קיימת כדי למנוע קריסה
RUN if [ -d "/build/packages/frontend/public" ]; then cp -r /build/packages/frontend/public ./public; fi

EXPOSE 3000

# הרצה של ה-standalone server
CMD ["node", "server.js"]
