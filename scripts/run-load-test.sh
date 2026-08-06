#!/bin/sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
base_url=${BASE_URL:-http://host.docker.internal:3333}
profile=${LOAD_PROFILE:-baseline}

case "$base_url" in
  http://localhost:*|http://127.0.0.1:*|http://host.docker.internal:*) ;;
  *)
    if [ "${ALLOW_REMOTE_LOAD_TEST:-false}" != 'true' ]; then
      echo "Execução recusada para URL remota: $base_url" >&2
      echo "Use ALLOW_REMOTE_LOAD_TEST=true somente em um ambiente de homologação autorizado." >&2
      exit 1
    fi
    ;;
esac

case "$profile" in
  smoke|baseline|stress) ;;
  *) echo "LOAD_PROFILE inválido: $profile (use smoke, baseline ou stress)" >&2; exit 1 ;;
esac

mkdir -p "$repository_dir/tests/load/results"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
result_name="${profile}-${timestamp}.json"
result_file="/results/$result_name"

echo "Executando teste de carga '$profile' contra $base_url"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --add-host host.docker.internal:host-gateway \
  -e BASE_URL="$base_url" \
  -e LOAD_PROFILE="$profile" \
  -e LOAD_TEST_EMAIL="${LOAD_TEST_EMAIL:-operador@hortierp.com}" \
  -e LOAD_TEST_PASSWORD="${LOAD_TEST_PASSWORD:-operador123}" \
  -e LOAD_TEST_TURNSTILE_TOKEN="${LOAD_TEST_TURNSTILE_TOKEN:-load-test}" \
  -v "$repository_dir/tests/load:/scripts:ro" \
  -v "$repository_dir/tests/load/results:/results" \
  grafana/k6:0.54.0 run --summary-export "$result_file" /scripts/read-flow.js

if [ ! -s "$repository_dir/tests/load/results/$result_name" ]; then
  echo "Teste concluído, mas o resumo JSON não foi criado corretamente." >&2
  exit 1
fi

echo "Resumo salvo em tests/load/results/$result_name"
