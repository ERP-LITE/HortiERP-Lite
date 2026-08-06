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
invoice_plain=''
invoice_restore_dir=''

cleanup() {
  rm -f "$plain_file"
  if [ -n "$invoice_plain" ]; then rm -f "$invoice_plain"; fi
  if [ -n "$invoice_restore_dir" ] && [ -d "$invoice_restore_dir" ]; then
    find "$invoice_restore_dir" -mindepth 1 -delete
    rmdir "$invoice_restore_dir"
  fi
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
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'products', 'stock_movements', 'stock_entry_attachments');")

if [ "$tables" != '4' ]; then
  echo "Restauração inválida: tabelas essenciais não foram encontradas" >&2
  exit 1
fi

latest_invoice_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'hortierp_invoices_*.tar.gz.enc' -print | sort | tail -n 1)
attachment_count=$(psql --dbname="$restore_database" --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command='SELECT count(*) FROM stock_entry_attachments;')

if [ -z "$latest_invoice_backup" ] && [ "$attachment_count" != '0' ]; then
  echo "Restauração inválida: o banco possui $attachment_count anexo(s), mas o pacote de arquivos não existe" >&2
  exit 1
fi

if [ -n "$latest_invoice_backup" ]; then
  invoice_checksum="$latest_invoice_backup.sha256"
  [ -f "$invoice_checksum" ] || { echo "Checksum ausente: $invoice_checksum" >&2; exit 1; }
  (cd "$backup_dir" && sha256sum -c "$(basename "$invoice_checksum")")
  invoice_plain=$(mktemp /tmp/hortierp-invoices-restore.tar.gz.XXXXXX)
  openssl enc -d -aes-256-cbc -pbkdf2 \
    -pass env:BACKUP_ENCRYPTION_PASSWORD \
    -in "$latest_invoice_backup" \
    -out "$invoice_plain"
  tar -tzf "$invoice_plain" >/dev/null
  invoice_restore_dir=$(mktemp -d /tmp/hortierp-invoices-restore.XXXXXX)
  tar -xzf "$invoice_plain" -C "$invoice_restore_dir"

  psql --dbname="$restore_database" --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --command='SELECT stored_name FROM stock_entry_attachments ORDER BY stored_name;' |
  while IFS= read -r stored_name; do
    case "$stored_name" in
      ''|*/*|*'..'*)
        echo "Nome interno de anexo inválido no banco restaurado: $stored_name" >&2
        exit 1
        ;;
    esac
    if [ ! -f "$invoice_restore_dir/$stored_name" ]; then
      echo "Arquivo fiscal ausente no pacote restaurado: $stored_name" >&2
      exit 1
    fi
  done

  rm -f "$invoice_plain"
  invoice_plain=''
fi

echo "Teste de restauração concluído com sucesso usando $(basename "$latest_backup"); $attachment_count anexo(s) conferido(s)"
