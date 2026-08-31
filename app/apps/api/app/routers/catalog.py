"""Каталог — публичный API (02-api-contract.md, раздел «Каталог»).

Этап 1: пути и сигнатуры зафиксированы, тела — заглушки. Реализация — Этап 2.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/catalog", tags=["catalog"])

NOT_IMPLEMENTED = JSONResponse(
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    content={"detail": "Не реализовано: Этап 2"},
)

SortOption = Literal["price_asc", "price_desc", "name", "new"]


@router.get("/categories")
async def list_categories() -> JSONResponse:
    """Дерево активных категорий с подкатегориями — для меню и сайдбара каталога."""
    return NOT_IMPLEMENTED


@router.get("/products")
async def list_products(
    category: str | None = None,
    subcategory: str | None = None,
    search: str | None = None,
    sort: SortOption | None = None,
    is_featured: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> JSONResponse:
    """Список товаров с фильтрами, сортировкой и настоящей пагинацией.

    В старом коде список жёстко обрезался 12 позициями без возможности увидеть
    остальные (ANALYSIS.md, п. 2.1.8) — здесь именно постраничная выдача.
    """
    return NOT_IMPLEMENTED


@router.get("/products/{slug}")
async def get_product(slug: str) -> JSONResponse:
    """Карточка товара: поля, images[], related_products[] и fillings[],
    если подкатегория помечена applies_fillings."""
    return NOT_IMPLEMENTED
