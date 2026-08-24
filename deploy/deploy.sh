#!/bin/sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${1:-"$repository_dir/.env.production"}
image_tag=${IMAGE_TAG:-$(git -C "$repository_dir" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}
compose_file="$repository_dir/docker-compose.production.yml"

# Evita que hosts pequenos (como a VM Always Free de 1 GB usada para demos)
# construam API, frontend e backup simultaneamente e esgotem RAM/swap. Hosts
# maiores podem sobrescrever este valor ao executar o script.
export COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT:-1}

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
if ! IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" \
  up -d --remove-orphans --wait --wait-timeout 180; then
  echo "Deploy falhou: algum serviço não iniciou ou não ficou saudável." >&2
  IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" \
    logs --tail=150 migrate api web gateway postgres >&2 || true
  exit 1
fi

migrate_container=$(IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" ps --all -q migrate)
if [ -z "$migrate_container" ]; then
  echo "Deploy falhou: container de migration não foi encontrado." >&2
  exit 1
fi

migrate_exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$migrate_container")
if [ "$migrate_exit_code" != '0' ]; then
  echo "Deploy falhou: migration encerrou com código $migrate_exit_code." >&2
  IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" logs --tail=150 migrate >&2 || true
  exit 1
fi

# Já aconteceu de o `caddy reload` recarregar a configuração antiga e retornar sucesso, com o job
# verde e a CSP velha no ar. Esta conferência faz esse caso falhar em vez de passar em silêncio.
echo "Conferindo se o gateway vê a configuração atual..."
caddyfile_host=$(md5sum < "$repository_dir/deploy/caddy/Caddyfile" | cut -d' ' -f1)
caddyfile_container=$(IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" \
  exec -T gateway md5sum /etc/caddy/Caddyfile | cut -d' ' -f1)
if [ "$caddyfile_host" != "$caddyfile_container" ]; then
  echo "Deploy falhou: o gateway está lendo um Caddyfile diferente do que há no repositório." >&2
  echo "  repositório: $caddyfile_host" >&2
  echo "  container:   $caddyfile_container" >&2
  echo "Recrie o gateway para refazer a montagem e rode o deploy de novo:" >&2
  echo "  docker compose --env-file $env_file -f $compose_file up -d --force-recreate gateway" >&2
  exit 1
fi

echo "Recarregando configuração do gateway..."
if ! IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" exec -T gateway \
  caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Deploy falhou: o Caddyfile novo foi recusado pelo gateway." >&2
  echo "O gateway segue no ar com a configuração anterior. Verifique a sintaxe de deploy/caddy/Caddyfile." >&2
  IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" logs --tail=50 gateway >&2 || true
  exit 1
fi

echo "Validando estado dos containers..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" ps

echo "Validando health check profundo da API..."
IMAGE_TAG="$image_tag" docker compose --env-file "$env_file" -f "$compose_file" exec -T api \
  node -e "fetch('http://127.0.0.1:3333/health').then(async response => { if (!response.ok) { console.error(await response.text()); process.exit(1) } console.log(await response.text()) }).catch(error => { console.error(error); process.exit(1) })"

echo "Deploy concluído. IMAGE_TAG=$image_tag"
