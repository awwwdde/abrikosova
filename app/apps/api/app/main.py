import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.redis import close_redis
from app.core.scheduler import shutdown as stop_scheduler
from app.core.scheduler import start as start_scheduler
from app.routers import admin, auth, catalog, health, shop
from app.services.storage import ensure_bucket

settings = get_settings()
setup_logging(settings.debug, sql_echo=settings.sql_echo)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Локальный MinIO стартует пустым — заводим бакет, если его ещё нет
    await ensure_bucket()
    start_scheduler()
    yield
    stop_scheduler()
    await close_redis()


# На проде интерактивная документация выключена: она раскрывает полную карту API,
# включая admin-раздел, любому анонимному посетителю.
_is_prod = settings.environment == "production"

app = FastAPI(
    title="Abrikosova API",
    version="0.1.0",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
    lifespan=lifespan,
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Нарушение ограничения БД — это конфликт данных, а не падение сервера.

    Типичные случаи из админки: занятый slug или удаление категории, в которой
    есть товары из заказов. Без обработчика админка получала бы 500 и не могла
    объяснить владелице, что не так. Текст ошибки PostgreSQL наружу не отдаём —
    в нём имена таблиц и значения полей; он уходит только в лог.
    """
    # В лог — только имя ограничения. Полный текст PostgreSQL содержит значения
    # полей («Key (phone)=(...)»), а логи не должны множить персональные данные.
    constraint = getattr(exc.orig.__cause__, "constraint_name", None) if exc.orig else None
    logger.warning(
        "Нарушено ограничение БД %s: %s %s", constraint, request.method, request.url.path
    )
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": "Конфликт данных: такое значение уже занято "
            "или на запись ссылаются другие данные"
        },
    )


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    # Закрытый список источников: wildcard несовместим с allow_credentials,
    # а корзина и refresh-токен ездят именно в cookie
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    max_age=600,
)

API_PREFIX = "/api/v1"

for _router in (
    health.router,
    catalog.router,
    shop.custom_cakes_router,
    shop.content_router,
    shop.contacts_router,
    shop.cart_router,
    shop.orders_router,
    auth.router,
    admin.router,
):
    app.include_router(_router, prefix=API_PREFIX)
