#!/usr/bin/env sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKUP_DIR="$ROOT/backups"
DATABASE="$ROOT/data/snowmountain.db"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DATABASE" ".backup '$BACKUP_DIR/snowmountain-$STAMP.db'"
find "$BACKUP_DIR" -type f -name 'snowmountain-*.db' -mtime +14 -delete
echo "$BACKUP_DIR/snowmountain-$STAMP.db"
