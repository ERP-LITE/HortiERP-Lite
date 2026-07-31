#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Uso: deploy/rollback.sh <IMAGE_TAG_ANTERIOR> [arquivo-env]" >&2
  exit 1
fi

image_tag=$1
repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${2:-"$repository_dir/.env.production"}
compose_file="$repository_dir/docker-compose.production.yml"

if [ ! -f "$env_file" ]; then
  echo "Arquivo de ambiente não encontrado: $env_file" >&2
  exit 1
fi

echo "Voltando os containers para a versão $image_tag..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" up -d --no-build
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" ps

echo "Rollback de aplicação concluído. Migrations de banco não são revertidas automaticamente."
