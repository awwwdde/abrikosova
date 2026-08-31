# Многостадийная сборка: target dev — для docker-compose, target runner — для Timeweb Cloud App Platform.
# Build context на App Platform: app/apps/api (см. new/spec/06-implementation-plan.md, Этап 9).

FROM python:3.13-slim AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /srv

FROM base AS deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir ".[dev]"

FROM deps AS dev
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS runner
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY . .
RUN useradd --create-home --uid 1001 appuser && chown -R appuser:appuser /srv
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
