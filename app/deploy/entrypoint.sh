#!/usr/bin/env bash
# Запуск контейнера на платформе-хостинге (app/deploy/README.md).
#
# 1. Переменные платформы → переменные приложения (DATABASE_URL с драйвером asyncpg,
#    PUBLIC_SITE_URL → SITE_URL, JWT_SECRET/SECRET_KEY). Свои переменные из панели
#    стенда приходят поверх и имеют приоритет: здесь только значения по умолчанию.
# 2. Redis в контейнере, миграции, сид (демо-каталог только в пустую базу).
# 3. FastAPI, Next.js и nginx; упал любой процесс — контейнер завершается, и
#    платформа видит падение, а не «живой» контейнер с мёртвым сайтом.
set -euo pipefail

# --- Переменные --------------------------------------------------------------
: "${DATABASE_URL:?DATABASE_URL не задан — платформа выдаёт его вместе с Postgres}"
case "$DATABASE_URL" in
  postgres://*) DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgres://}" ;;
  postgresql://*) DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgresql://}" ;;
esac
export DATABASE_URL

export SITE_URL="${SITE_URL:-${PUBLIC_SITE_URL:-http://localhost:8080}}"
SITE_URL="${SITE_URL%/}"
export PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-$SITE_URL}"

# https — боевой режим: cookie только по HTTPS, проверки секретов при старте api.
# http (локальная проверка образа) — режим разработки, иначе api не стартует
if [[ "$SITE_URL" == https://* ]]; then
  export ENVIRONMENT="${ENVIRONMENT:-production}"
  export COOKIE_SECURE="${COOKIE_SECURE:-true}"
else
  export ENVIRONMENT="${ENVIRONMENT:-development}"
  export COOKIE_SECURE="${COOKIE_SECURE:-false}"
fi
export CORS_ORIGINS="${CORS_ORIGINS:-[\"$SITE_URL\"]}"

# Секреты платформы стабильны между деплоями — сессии админки не слетают
export JWT_SECRET="${JWT_SECRET:-${SECRET_KEY:-}}"
export REVALIDATE_SECRET="${REVALIDATE_SECRET:-${SECRET_KEY:-$JWT_SECRET}}"

# Пресет владельца в панели платформы использует BOOTSTRAP_ADMIN_*.
# Явно заданные переменные сайта сохраняют приоритет.
export ADMIN_SEED_EMAIL="${ADMIN_SEED_EMAIL:-${BOOTSTRAP_ADMIN_EMAIL:-}}"
export ADMIN_SEED_PASSWORD="${ADMIN_SEED_PASSWORD:-${BOOTSTRAP_ADMIN_PASSWORD:-}}"

# Внутренние адреса — постоянные
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
# nginx — локальный peer API. Сети внешнего балансировщика задаются явно в панели.
export TRUSTED_PROXY_NETWORKS="${TRUSTED_PROXY_NETWORKS:-[\"127.0.0.1/32\"]}"
export API_URL="http://127.0.0.1:8000/api/v1"
export WEB_REVALIDATE_URL="${WEB_REVALIDATE_URL:-http://127.0.0.1:3000/api/revalidate}"
# Стенд закрыт от поисковиков, пока явно не задано SITE_ENV=production
export SITE_ENV="${SITE_ENV:-staging}"

# В PostgreSQL хранятся оригиналы; MEDIA_ROOT — восстанавливаемый файловый кэш.
export MEDIA_STORAGE="${MEDIA_STORAGE:-database}"
export MEDIA_ROOT="${MEDIA_ROOT:-/var/lib/abrikosova/media}"
mkdir -p "$MEDIA_ROOT"
test -w "$MEDIA_ROOT" || { echo "MEDIA_ROOT недоступен для записи" >&2; exit 1; }
cp /srv/deploy/nginx.conf.template /tmp/nginx.conf

# --- Redis -------------------------------------------------------------------
# Без записи на диск: лимиты запросов и кэш настроек переживать деплой не должны
redis-server --bind 127.0.0.1 --port 6379 --save "" --appendonly no \
  --daemonize yes --dir /tmp --logfile ""

# --- База --------------------------------------------------------------------
cd /srv/api
alembic upgrade head
# Демо-каталог пишется только в пустую базу; SEED_DEMO=false — только учётная
# запись владелицы (ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD)
if [[ "${SEED_DEMO:-true}" == "true" ]]; then
  python -m app.seed
else
  python -m app.seed --admin-only
fi

# --- Процессы ----------------------------------------------------------------
uvicorn app.main:app --host 127.0.0.1 --port 8000 \
  --no-proxy-headers &
API_PID=$!

(cd /srv/web && PORT=3000 HOSTNAME=127.0.0.1 exec node server.js) &
WEB_PID=$!

nginx -e stderr -c /tmp/nginx.conf -g "daemon off;" &
NGINX_PID=$!

# Страницы, собранные при сборке образа (без API), — пересобрать сразу после
# старта, а не через 5 минут ISR
(
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null http://127.0.0.1:3000/healthz && break
    sleep 2
  done
  if curl -fsS --max-time 15 -o /dev/null -X POST http://127.0.0.1:3000/api/revalidate \
    -H "Content-Type: application/json" -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
    -d '{"paths":["/","/catalog","/custom-cakes","/gallery","/about","/contacts","/privacy","/terms","/consent","/sitemap.xml"],"tags":["categories","home","contacts","about","custom_cakes","gallery","legal"]}'; then
    # Сброс лишь помечает ISR устаревшим. Сами страницы собираем до первого посетителя.
    for path in / /catalog /custom-cakes /gallery /about /contacts /privacy /terms /consent /sitemap.xml; do
      curl -fsS --connect-timeout 2 --max-time 30 -o /dev/null "http://127.0.0.1:3000${path}" \
        || echo "Не удалось прогреть ${path} — обновится по ISR" >&2
    done
    echo "Прогрев публичных страниц завершён после старта"
  else
    echo "Кэш страниц не обновлён — обновится по ISR" >&2
  fi
) &

# Первый упавший из трёх процессов останавливает контейнер (прогрев кэша — не в счёт)
wait -n "$API_PID" "$WEB_PID" "$NGINX_PID"
echo "Процесс приложения завершился — останавливаю контейнер" >&2
exit 1
