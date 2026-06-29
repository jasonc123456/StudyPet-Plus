#!/usr/bin/env bash
# Pre-deploy sanity check — lint, Prisma client, and production build.
# Does not deploy or require production secrets. Run from repo root:
#   ./scripts/check-deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Installing dependencies (npm ci)…"
npm ci

echo "→ Generating Prisma client…"
npx prisma generate

echo "→ Linting…"
npm run lint

echo "→ Building…"
npm run build

echo "✓ check-deploy passed"
