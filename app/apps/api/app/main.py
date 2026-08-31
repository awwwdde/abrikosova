from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.routers import admin, auth, catalog, health, shop

settings = get_settings()
setup_logging(settings.debug)

app = FastAPI(
    title="Abrikosova API",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # корзина живёт в httpOnly cookie cart_id
    allow_methods=["*"],
    allow_headers=["*"],
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
