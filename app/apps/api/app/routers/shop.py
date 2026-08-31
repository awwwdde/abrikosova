"""Торты на заказ, галерея, отзывы, контент страниц, контакты, корзина, заказы.

Этап 1: зафиксированы пути и HTTP-методы по 02-api-contract.md. Реализация — Этап 2.
Все мутации — строго не через GET (ANALYSIS.md, п. 2.1.4).
"""

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.models.enums import PageKey
from app.routers._stub import not_implemented

STAGE = "Этап 2"

custom_cakes_router = APIRouter(prefix="/custom-cakes", tags=["custom-cakes"])
content_router = APIRouter(tags=["content"])
contacts_router = APIRouter(prefix="/contacts", tags=["contacts"])
cart_router = APIRouter(prefix="/cart", tags=["cart"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])


# --- Торты на заказ ---


@custom_cakes_router.get("")
async def get_custom_cakes_page() -> JSONResponse:
    """Активные позиции + начинки + контент страницы PageContent[custom_cakes]."""
    return not_implemented(STAGE)


@custom_cakes_router.post("/consultation", status_code=201)
async def create_consultation() -> JSONResponse:
    """Заявка на консультацию, source=custom_cake. consent_pd обязателен."""
    return not_implemented(STAGE)


# --- Галерея, отзывы, статичные страницы ---


@content_router.get("/gallery")
async def list_gallery(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> JSONResponse:
    return not_implemented(STAGE)


@content_router.get("/reviews")
async def list_reviews(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> JSONResponse:
    """Только опубликованные отзывы (is_published=true)."""
    return not_implemented(STAGE)


@content_router.get("/pages/{page_key}")
async def get_page_content(page_key: PageKey) -> JSONResponse:
    return not_implemented(STAGE)


# --- Форма обратной связи ---


@contacts_router.post("/feedback", status_code=201)
async def create_feedback() -> JSONResponse:
    """Пишет в ту же таблицу, что и консультация, но с source=contact_page."""
    return not_implemented(STAGE)


# --- Корзина (гостевая, httpOnly cookie cart_id) ---


@cart_router.get("")
async def get_cart() -> JSONResponse:
    return not_implemented(STAGE)


@cart_router.post("/items", status_code=201)
async def add_cart_item() -> JSONResponse:
    return not_implemented(STAGE)


@cart_router.patch("/items/{product_id}")
async def update_cart_item(product_id: int) -> JSONResponse:
    """quantity <= 0 удаляет позицию."""
    return not_implemented(STAGE)


@cart_router.delete("/items/{product_id}")
async def delete_cart_item(product_id: int) -> JSONResponse:
    return not_implemented(STAGE)


@cart_router.delete("")
async def clear_cart() -> JSONResponse:
    return not_implemented(STAGE)


# --- Заказы ---


@orders_router.post("", status_code=201)
async def create_order() -> JSONResponse:
    """Сумма пересчитывается на сервере по актуальным ценам — сумме от клиента не доверяем."""
    return not_implemented(STAGE)


@orders_router.get("/{order_number}")
async def get_order(order_number: str) -> JSONResponse:
    """Публично по номеру заказа — для страницы подтверждения."""
    return not_implemented(STAGE)
