#!/usr/bin/env bash
# Build and (re)start TAXBROS LMS on the server (Tasks 66, 68, 69).
#   bash deploy/scripts/deploy.sh
# Needs: Node 20+, pnpm, PM2, PostgreSQL client tools, and filled-in
# apps/api/.env and apps/web/.env.production.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

[[ -f apps/api/.env ]] || { echo "Missing apps/api/.env (copy apps/api/.env.production.example)"; exit 1; }
[[ -f apps/web/.env.production ]] || { echo "Missing apps/web/.env.production (copy apps/web/.env.production.example)"; exit 1; }

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Backing up the database before migrating"
if [[ "${SKIP_BACKUP:-}" != "1" ]]; then
  bash deploy/scripts/backup-db.sh || { echo "Backup failed; not migrating (SKIP_BACKUP=1 for a first install)"; exit 1; }
fi

echo "==> Applying database migrations"
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy

echo "==> Building API"
pnpm --filter api build

echo "==> Building web app"
pnpm --filter web build
# The standalone server does not include static files: copy them in
STANDALONE=apps/web/.next/standalone/apps/web
rm -rf "$STANDALONE/public" "$STANDALONE/.next/static"
cp -r apps/web/public "$STANDALONE/public"
cp -r apps/web/.next/static "$STANDALONE/.next/static"

echo "==> (Re)starting processes"
if pm2 describe taxbros-api >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js --update-env
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo "==> Health check"
sleep 3
curl -fsS -o /dev/null -w "API %{http_code}\n" http://127.0.0.1:4000/api/health || { echo "API not responding"; exit 1; }
curl -fsS -o /dev/null -w "Web %{http_code}\n" http://127.0.0.1:3000/login || { echo "Web not responding"; exit 1; }
echo "Deployed."
