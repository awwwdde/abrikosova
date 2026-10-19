# Образ для платформы-хостинга с под-сайтами `<slug>.awwwdde.art` (контракт гостя —
# app/deploy/README.md). Один контейнер: снаружи — только порт 8080 и /healthz,
# внутри — nginx (8080), Next.js (127.0.0.1:3000), FastAPI (127.0.0.1:8000) и Redis
# (127.0.0.1:6379). Postgres даёт платформа (DATABASE_URL); в нём же хранятся
# фотографии и видео, отдельный файловый том приложения не требуется.
#
# Для разработки по-прежнему docker compose (app/docker-compose.yml) и Dockerfile
# в app/apps/api и app/apps/web — этот файл их не заменяет.

# --- Сборка сайта -------------------------------------------------------------
# node:22-slim (glibc), а не alpine: образ запуска — debian, и нативные модули
# Next (sharp, swc) из alpine-сборки в нём не заработали бы
FROM node:22-slim AS web-build
WORKDIR /srv
COPY app/apps/web/package.json app/apps/web/package-lock.json ./
RUN npm ci
COPY app/apps/web/ ./
# Адреса внутри контейнера постоянные — их можно вшить при сборке. Адрес сайта
# (PUBLIC_SITE_URL) и всё, что зависит от стенда, читается при запуске
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=/api/v1 \
    NEXT_PUBLIC_MEDIA_URL=/media \
    MEDIA_INTERNAL_URL=http://127.0.0.1:8000/media \
    API_URL=http://127.0.0.1:8000/api/v1
# Счётчики и подтверждения поисковиков вшиваются в браузерный код при сборке.
# Пусто — без счётчиков; задать можно аргументами сборки, если платформа их передаёт
ARG NEXT_PUBLIC_YANDEX_METRIKA_ID=""
ARG NEXT_PUBLIC_YANDEX_WEBVISOR="false"
ARG NEXT_PUBLIC_GA_ID=""
ARG NEXT_PUBLIC_YANDEX_VERIFICATION=""
ARG NEXT_PUBLIC_GOOGLE_VERIFICATION=""
ENV NEXT_PUBLIC_YANDEX_METRIKA_ID=$NEXT_PUBLIC_YANDEX_METRIKA_ID \
    NEXT_PUBLIC_YANDEX_WEBVISOR=$NEXT_PUBLIC_YANDEX_WEBVISOR \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_YANDEX_VERIFICATION=$NEXT_PUBLIC_YANDEX_VERIFICATION \
    NEXT_PUBLIC_GOOGLE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_VERIFICATION
RUN npm run build

# Клиент той же основной версии, что PostgreSQL платформы. pg_restore 17
# посылает SET transaction_timeout, которого в PostgreSQL 16 ещё нет.
FROM postgres:16 AS pg-tools

# --- Образ запуска ------------------------------------------------------------
FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# curl — для healthcheck платформы (без wget/curl деплой падает по таймауту);
# nginx — единый вход на 8080; redis-server — лимиты запросов и кэш настроек;
# ffmpeg — проверка и подготовка загруженного видео;
# postgresql-client — pg_dump/pg_restore для резервных копий из админки
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl nginx redis-server ffmpeg postgresql-client libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
# Next standalone нужен только сам node
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=pg-tools /usr/lib/postgresql/16/bin/pg_dump /usr/local/bin/pg_dump
COPY --from=pg-tools /usr/lib/postgresql/16/bin/pg_restore /usr/local/bin/pg_restore
COPY --from=pg-tools /usr/lib/postgresql/16/bin/psql /usr/local/bin/psql
RUN pg_dump --version && pg_restore --version && psql --version

WORKDIR /srv/api
COPY app/apps/api/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY app/apps/api/ ./

COPY --from=web-build /srv/.next/standalone /srv/web
COPY --from=web-build /srv/.next/static /srv/web/.next/static
COPY --from=web-build /srv/public /srv/web/public
COPY app/deploy/ /srv/deploy/

RUN useradd --create-home --uid 1001 app \
    && mkdir -p /var/lib/abrikosova/media \
    && chown -R app:app /var/lib/abrikosova \
    && chown -R app:app /srv \
    && chmod +x /srv/deploy/entrypoint.sh
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:8080/healthz || exit 1
CMD ["/srv/deploy/entrypoint.sh"]
