#!/bin/sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
test_database_url='postgres://hortierp_test:hortierp_test@127.0.0.1:5434/hortierp_test'

cleanup() {
  docker compose -p hortierp-tests -f "$repository_dir/docker-compose.test.yml" down --volumes
}

trap cleanup EXIT INT TERM

docker compose -p hortierp-tests -f "$repository_dir/docker-compose.test.yml" up -d --wait

cd "$repository_dir/apps/api"
DATABASE_URL="$test_database_url" \
NODE_ENV=test \
JWT_SECRET='integration-test-secret-with-at-least-32-characters' \
npm run db:migrate

DATABASE_URL="$test_database_url" \
NODE_ENV=test \
JWT_SECRET='integration-test-secret-with-at-least-32-characters' \
TURNSTILE_SECRET_KEY='1x0000000000000000000000000000000AA' \
npm run test:run
