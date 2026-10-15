#!/usr/bin/env bash
# Отдельный .next, без конфликта с next dev. Один запуск подготавливает smoke-сервер.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
name=abrikosova-web-smoke
port="${WEB_PROD_PORT:-3200}"
if docker inspect "$name" >/dev/null 2>&1; then
  docker rm -f "$name" >/dev/null
fi
docker compose run -d --rm --no-deps --name "$name" -p "127.0.0.1:$port:3000" -v abrikosova-smoke-next:/srv/.next -e SITE_ENV=production -e SHOW_WIP_PAGES=false -e "NEXT_PUBLIC_SITE_URL=http://localhost:$port" web \
  sh -c 'npm run build > /tmp/build.log 2>&1; smoke_result=$?; echo "$smoke_result" > /tmp/build-exit; if [ "$smoke_result" -ne 0 ]; then cat /tmp/build.log; exit "$smoke_result"; fi; exec npx next start -p 3000' >/dev/null
for ((attempt=0; attempt<120; attempt++)); do
  if result=$(docker exec "$name" cat /tmp/build-exit 2>/dev/null); then
    if [ "$result" != 0 ]; then
      docker logs "$name"
      exit 1
    fi
    echo "BUILD_EXIT=0"
    break
  fi
  sleep 5
done
if [ "${result:-}" != 0 ]; then
  docker logs "$name"
  echo "Сборка не завершилась за 10 минут" >&2
  exit 1
fi
for ((attempt=0; attempt<30; attempt++)); do
  if curl --max-time 5 -fsS "http://localhost:$port/robots.txt" >/dev/null; then
    echo "PROD_READY=http://localhost:$port"
    exit 0
  fi
  sleep 2
done
docker logs "$name"
echo "Прод-сервер не готов" >&2
exit 1
