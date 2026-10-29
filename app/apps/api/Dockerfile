# syntax=docker/dockerfile:1
# Многостадийная сборка: target dev — для docker-compose, target runner — для Timeweb Cloud App Platform.
# Build context на App Platform: app/apps/api (см. new/spec/06-implementation-plan.md, Этап 9).

FROM python:3.13-slim AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /srv
# postgresql-client даёт pg_dump и pg_restore — без них резервное копирование
# из админки не работает
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update -qq \
    && apt-get install -qq -y --no-install-recommends postgresql-client ffmpeg \
    && mkdir -p /var/lib/abrikosova/media \
    && chown -R 1001:1001 /var/lib/abrikosova

FROM base AS deps
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && pip install ".[dev,migration]"

FROM deps AS dev
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers", "--reload"]

FROM base AS runner
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && pip install .
COPY . .
RUN useradd --create-home --uid 1001 appuser && chown -R appuser:appuser /srv /var/lib/abrikosova
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
