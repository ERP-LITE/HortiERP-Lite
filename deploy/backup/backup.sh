#!/bin/sh
set -eu

: "${PGHOST:?Defina PGHOST}"
: "${PGUSER:?Defina PGUSER}"
: "${PGDATABASE:?Defina PGDATABASE}"
: "${PGPASSWORD:?Defina PGPASSWORD}"
: "${BACKUP_ENCRYPTION_PASSWORD:?Defina BACKUP_ENCRYPTION_PASSWORD}"

backup_dir=${BACKUP_DIR:-/backups}
interval_seconds=${BACKUP_INTERVAL_SECONDS:-86400}
retention_days=${BACKUP_RETENTION_DAYS:-30}

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

run_backup() {
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  filename="hortierp_${timestamp}.dump.enc"
  plain_file=$(mktemp /tmp/hortierp-backup.dump.XXXXXX)
  encrypted_temp="$backup_dir/.${filename}.tmp"

  cleanup_files() {
    rm -f "$plain_file" "$encrypted_temp"
  }
  trap cleanup_files EXIT INT TERM

  echo "[$(date -u +%FT%TZ)] Iniciando backup $filename"
  pg_dump --format=custom --compress=9 --no-owner --no-acl --file="$plain_file"

  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -pass env:BACKUP_ENCRYPTION_PASSWORD \
    -in "$plain_file" \
    -out "$encrypted_temp"

  mv "$encrypted_temp" "$backup_dir/$filename"
  chmod 600 "$backup_dir/$filename"
  (cd "$backup_dir" && sha256sum "$filename" > "$filename.sha256")

  if [ -n "${BACKUP_REMOTE_PATH:-}" ]; then
    echo "[$(date -u +%FT%TZ)] Enviando backup para storage:${BACKUP_REMOTE_PATH}"
    rclone copyto "$backup_dir/$filename" "storage:${BACKUP_REMOTE_PATH}/$filename"
    rclone copyto "$backup_dir/$filename.sha256" "storage:${BACKUP_REMOTE_PATH}/$filename.sha256"
  fi

  find "$backup_dir" -type f \( -name 'hortierp_*.dump.enc' -o -name 'hortierp_*.dump.enc.sha256' \) \
    -mtime "+$retention_days" -delete

  date -u +%FT%TZ > "$backup_dir/.last-success"
  echo "[$(date -u +%FT%TZ)] Backup concluído: $filename"
  cleanup_files
  trap - EXIT INT TERM
}

if [ "${1:-}" = "once" ]; then
  run_backup
  exit 0
fi

while true; do
  if ! "$0" once; then
    echo "[$(date -u +%FT%TZ)] Falha no backup; nova tentativa em ${interval_seconds}s" >&2
  fi
  sleep "$interval_seconds" &
  wait $!
done
