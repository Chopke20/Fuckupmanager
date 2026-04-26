#!/usr/bin/env bash
set -euo pipefail

# Daily PostgreSQL backups for all companies (single-domain, multi-db).
#
# - Reads COMPANY_DATABASES_JSON from /var/www/lamaapp/apps/api/.env (default) or BACKUP_ENV_FILE
# - Creates pg_dump (custom format) per company
# - Verifies file size > 0 (and > 4KB)
# - Keeps only last N days (BACKUP_RETENTION_DAYS, default 14)
#
# Usage (server):
#   sudo bash /var/www/lamaapp/scripts/backup-databases.sh
#

APP_ROOT="${APP_ROOT:-/var/www/lamaapp}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$APP_ROOT/apps/api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lamaapp}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PG_DUMP_PATH="${PG_DUMP_PATH:-pg_dump}"
MIN_SIZE_BYTES="${MIN_SIZE_BYTES:-4096}"

timestamp() { date +"%F %T"; }
log() { echo "[$(timestamp)] $*"; }
fail() { echo "[$(timestamp)] ERROR: $*" >&2; exit 1; }

if [[ ! -f "$BACKUP_ENV_FILE" ]]; then
  fail "Brak pliku env: $BACKUP_ENV_FILE"
fi

mkdir -p "$BACKUP_DIR"

if ! command -v "$PG_DUMP_PATH" >/dev/null 2>&1; then
  fail "Nie znaleziono pg_dump ($PG_DUMP_PATH). Ustaw PG_DUMP_PATH lub doinstaluj postgresql-client."
fi

log "Backup start. env=$BACKUP_ENV_FILE dir=$BACKUP_DIR retention=${BACKUP_RETENTION_DAYS}d"

# Parse COMPANY_DATABASES_JSON without jq (Node is already present on the server).
mapfile -t ENTRIES < <(
  node -e "
    const fs = require('fs');
    const path = process.env.BACKUP_ENV_FILE;
    const text = fs.readFileSync(path, 'utf8');
    const lines = text.split(/\\r?\\n/);
    const env = {};
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = (m[2] || '').trim();
      if ((val.startsWith('\"') && val.endsWith('\"')) || (val.startsWith(\"'\") && val.endsWith(\"'\"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    const raw = (env.COMPANY_DATABASES_JSON || '').trim();
    if (!raw) {
      // Fallback to single-company (DATABASE_URL)
      const db = (env.DATABASE_URL || '').trim();
      if (!db) process.exit(2);
      console.log('main\\t' + db);
      process.exit(0);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) process.exit(3);
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const code = String(row.code || '').trim().toLowerCase();
      const url = String(row.databaseUrl || '').trim();
      if (!code || !url) continue;
      console.log(code + '\\t' + url);
    }
  " 2>/dev/null
)

if [[ "${#ENTRIES[@]}" -eq 0 ]]; then
  fail "Nie udało się odczytać listy baz z COMPANY_DATABASES_JSON/DATABASE_URL."
fi

FAILED=0
for entry in "${ENTRIES[@]}"; do
  code="${entry%%$'\t'*}"
  url="${entry#*$'\t'}"
  if [[ -z "$code" || -z "$url" ]]; then
    continue
  fi

  out="$BACKUP_DIR/lama-stage-pg-backup-${code}-$(date -u +%Y-%m-%dT%H-%M-%SZ).dump"
  log "pg_dump company=$code → $out"

  if ! "$PG_DUMP_PATH" -Fc --no-owner --no-privileges --dbname "$url" -f "$out"; then
    log "FAILED company=$code pg_dump error"
    FAILED=1
    rm -f "$out" || true
    continue
  fi

  size="$(stat -c%s "$out" 2>/dev/null || wc -c <"$out")"
  if [[ "$size" -lt "$MIN_SIZE_BYTES" ]]; then
    log "FAILED company=$code dump too small (${size}B) – deleting"
    FAILED=1
    rm -f "$out" || true
    continue
  fi

  log "OK company=$code size=${size}B"
done

log "Retention cleanup: keep last ${BACKUP_RETENTION_DAYS} days"
find "$BACKUP_DIR" -type f -name "lama-stage-pg-backup-*.dump" -mtime "+$BACKUP_RETENTION_DAYS" -print -delete || true

if [[ "$FAILED" -ne 0 ]]; then
  fail "Backup finished with failures. Check logs above."
fi

log "Backup finished successfully."

