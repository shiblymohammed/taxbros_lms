#!/usr/bin/env bash
# Daily PostgreSQL backup with 30-day retention (Task 67, R40).
#
#   bash deploy/scripts/backup-db.sh
#
# Reads DATABASE_URL from the environment or apps/api/.env.
# Optional settings: BACKUP_DIR (default /var/backups/taxbros), BACKUP_RETENTION_DAYS (default 30)
#
# Cron, daily at 02:00 India time (`crontab -e` as the deploy user):
#   CRON_TZ=Asia/Kolkata
#   0 2 * * * /bin/bash /srv/taxbros-lms/deploy/scripts/backup-db.sh >> /var/log/taxbros-backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/taxbros}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/apps/api/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/apps/api/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi
# pg_dump does not understand Prisma-only query parameters such as connection_limit
PG_URL="${DATABASE_URL%%\?*}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(TZ=Asia/Kolkata date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/taxbros_${STAMP}.sql.gz"
TMP="$FILE.partial"
trap 'rm -f "$TMP"' EXIT

echo "[$(date -Is)] Backing up to $FILE"
# Plain SQL without ownership/privileges, so it restores into any database and user
pg_dump --no-owner --no-privileges --format=plain "$PG_URL" | gzip -9 > "$TMP"
gzip -t "$TMP"   # verify the archive before keeping it
mv "$TMP" "$FILE"
chmod 600 "$FILE"
echo "[$(date -Is)] Done ($(du -h "$FILE" | cut -f1))"

# Retention: delete backups older than RETENTION_DAYS days
find "$BACKUP_DIR" -maxdepth 1 -name 'taxbros_*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete
