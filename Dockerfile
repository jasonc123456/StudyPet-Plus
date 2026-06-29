# StudyPet+ production image — Next.js 14 (App Router) + Prisma.
# Multi-stage build: install deps, build the app, then run a lean image.
# Debian (slim) is used over Alpine so Prisma's default query engine just works.

FROM node:20-slim AS base
# Prisma loads its query engine at runtime and needs OpenSSL present.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies (cached unless package*.json change) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the typed Prisma client, then build. A dummy DATABASE_URL lets
# `next build` import Prisma without a live database connection.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Carry the built app + node_modules (includes the Prisma CLI for migrations).
COPY --from=builder /app ./
EXPOSE 3000
# Apply any pending migrations on boot, then start the Next.js server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
