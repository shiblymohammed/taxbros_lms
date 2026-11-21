#!/usr/bin/env bash
# Restore a backup made by backup-db.sh (Task 67).
#
#   bash deploy/scripts/restore-db.sh /var/backups/taxbros/taxbros_2026-11-21_0200.sql.gz [TARGET_DATABASE_URL]
#
# Restores into TARGET_DATABASE_URL (default: DATABASE_URL). The target must be an EMPTY database,
# for example:  createdb -O taxbros taxbros_restore
# To replace the live database: pm2 stop taxbros-api, drop and recreate it, restore, pm2 start taxbros-api.
set -euo pipefail

FILE="${1:?Usage: restore-db.sh BACKUP_FILE [TARGET_DATABASE_URL]}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="${2:-${DATABASE_URL:-}}"
if [[ -z "$TARGET" && -f "$ROOT/apps/api/.env" ]]; then
  TARGET="$(grep -E '^DATABASE_URL=' "$ROOT/apps/api/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
if [[ -z "$TARGET" ]]; then
  echo "No target database URL"
  exit 1
fi
TARGET="${TARGET%%\?*}"

gzip -t "$FILE"
read -r -p "Restore $(basename "$FILE") into ${TARGET##*@}? Type RESTORE to continue: " answer
if [[ "$answer" != "RESTORE" ]]; then
  echo "Cancelled"
  exit 1
fi

gunzip -c "$FILE" | psql --set ON_ERROR_STOP=1 --single-transaction "$TARGET"
# Print only host/database: the URL contains the password
echo "Restore complete into ${TARGET##*@}. Check the row counts, e.g.: select count(*) from users;"
