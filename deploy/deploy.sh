#!/bin/sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${1:-"$repository_dir/.env.production"}
image_tag=${IMAGE_TAG:-$(git -C "$repository_dir" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}
compose_file="$repository_dir/docker-compose.production.yml"

if [ ! -f "$env_file" ]; then
  echo "Arquivo de ambiente não encontrado: $env_file" >&2
  echo "Copie .env.production.example para .env.production e preencha os valores reais." >&2
  exit 1
fi

if grep -Eq '=(troque-|erp\.exemplo\.com$)' "$env_file"; then
  echo "O arquivo de produção ainda contém valores de exemplo (troque-... ou erp.exemplo.com)." >&2
  exit 1
fi

echo "Validando configuração de produção..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" config --quiet

echo "Construindo imagens da versão $image_tag..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" build api web backup

echo "Aplicando migrations e iniciando serviços..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" up -d --remove-orphans

echo "Validando estado dos containers..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" ps

echo "Deploy concluído. IMAGE_TAG=$image_tag"
