from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.redis import close_redis
from app.routers import admin, auth, catalog, health, shop
from app.services.storage import ensure_bucket

settings = get_settings()
setup_logging(settings.debug)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Локальный MinIO стартует пустым — заводим бакет, если его ещё нет
    await ensure_bucket()
    yield
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
