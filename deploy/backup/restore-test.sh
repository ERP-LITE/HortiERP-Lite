#!/bin/sh
set -eu

: "${PGHOST:?Defina PGHOST}"
: "${PGUSER:?Defina PGUSER}"
: "${PGPASSWORD:?Defina PGPASSWORD}"
: "${BACKUP_ENCRYPTION_PASSWORD:?Defina BACKUP_ENCRYPTION_PASSWORD}"

backup_dir=${BACKUP_DIR:-/backups}
restore_database=${RESTORE_TEST_DATABASE:-hortierp_restore_test}

if [ "$restore_database" != 'hortierp_restore_test' ]; then
  echo "Execução recusada: RESTORE_TEST_DATABASE deve ser exatamente hortierp_restore_test" >&2
  exit 1
fi

latest_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'hortierp_*.dump.enc' -print | sort | tail -n 1)
if [ -z "$latest_backup" ]; then
  echo "Nenhum backup criptografado encontrado em $backup_dir" >&2
  exit 1
fi

checksum_file="$latest_backup.sha256"
if [ ! -f "$checksum_file" ]; then
  echo "Checksum ausente: $checksum_file" >&2
  exit 1
fi

(cd "$backup_dir" && sha256sum -c "$(basename "$checksum_file")")

plain_file=$(mktemp /tmp/hortierp-restore.dump.XXXXXX)

cleanup() {
  rm -f "$plain_file"
  psql --dbname=postgres --set=ON_ERROR_STOP=1 \
    --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$restore_database' AND pid <> pg_backend_pid();" \
    --command="DROP DATABASE IF EXISTS $restore_database;" >/dev/null
}
trap cleanup EXIT INT TERM

openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass env:BACKUP_ENCRYPTION_PASSWORD \
  -in "$latest_backup" \
  -out "$plain_file"

psql --dbname=postgres --set=ON_ERROR_STOP=1 \
  --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$restore_database' AND pid <> pg_backend_pid();" \
  --command="DROP DATABASE IF EXISTS $restore_database;" \
  --command="CREATE DATABASE $restore_database;" >/dev/null

pg_restore --exit-on-error --no-owner --no-acl --dbname="$restore_database" "$plain_file"

tables=$(psql --dbname="$restore_database" --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'products', 'stock_movements');")

if [ "$tables" != '3' ]; then
  echo "Restauração inválida: tabelas essenciais não foram encontradas" >&2
  exit 1
fi

echo "Teste de restauração concluído com sucesso usando $(basename "$latest_backup")"
