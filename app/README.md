# Кондитерская Елены Абрикосовой — монорепо

Реализация по ТЗ из `../new/spec/`. Аудит старого сайта — `../new/analysis/ANALYSIS.md`,
старый Django-код лежит в `../old/` **только как референс** (бизнес-логика, тексты), код оттуда не переносится.

```
app/
├── apps/
│   ├── web/   # Next.js 15 (App Router) — публичный сайт + /admin
│   └── api/   # FastAPI + SQLAlchemy 2 (async)
└── docker-compose.yml   # postgres + redis + api + web — только для локальной разработки
```

## Быстрый старт

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
docker compose up --build
```

- web — http://localhost:3000
- api — http://localhost:8000, документация http://localhost:8000/docs
- healthcheck — http://localhost:8000/api/v1/health

## Без Docker

```bash
cd apps/api && python -m venv .venv && .venv/Scripts/activate && pip install -e ".[dev]" && uvicorn app.main:app --reload
cd apps/web && npm install && npm run dev
```

## Проверки

```bash
cd apps/web && npm run lint && npm run typecheck
cd apps/api && ruff check . && ruff format --check .
```
