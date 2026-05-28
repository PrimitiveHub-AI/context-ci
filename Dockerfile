# syntax=docker/dockerfile:1.9
#
# PrimitiveHub web image — Next.js 16 + pnpm + Node 24 on Alpine.
# Multi-stage:
#   deps    → install dependencies from frozen lockfile (cacheable layer)
#   builder → next build with NODE_ENV=production
#   runner  → minimal runtime (standalone server.js + non-root user)
#   dev     → independent dev image with hot-reload (used by compose.override.yaml)
#
# Image base is pinned to a specific Alpine + Node patch release. To upgrade:
# bump NODE_IMAGE, rebuild, verify. Digest pinning will follow in a hardening pass.

ARG NODE_IMAGE=node:24.16.0-alpine

# ─────────────────────────────────────────────────────────────────────────────
# 1. deps — install dependencies in a cacheable layer
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# 2. builder — produce .next/standalone
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# 3. runner — minimal production runtime (default target)
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Use Node's built-in fetch so we don't need wget/curl in the image
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# 4. dev — used by compose.override.yaml for hot-reload local development
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS dev
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV WATCHPACK_POLLING=true
EXPOSE 3000
CMD ["pnpm", "dev"]
