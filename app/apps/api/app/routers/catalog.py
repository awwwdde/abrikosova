"""Каталог — публичный API (02-api-contract.md, раздел «Каталог»)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.catalog import CategoryOut, ProductDetail, ProductListItem
from app.schemas.common import Page
from app.services import catalog as service

router = APIRouter(prefix="/catalog", tags=["catalog"])

SortOption = Literal["price_asc", "price_desc", "name", "new"]


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: Annotated[AsyncSession, Depends(get_session)]):
    """Дерево активных категорий с подкатегориями — для меню и сайдбара каталога."""
    return await service.list_categories(session)


@router.get("/products", response_model=Page[ProductListItem])
async def list_products(
    session: Annotated[AsyncSession, Depends(get_session)],
    category: str | None = None,
    subcategory: str | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    sort: SortOption | None = None,
    is_featured: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[ProductListItem]:
    """Список товаров с фильтрами, сортировкой и настоящей пагинацией.

    В старом коде список жёстко обрезался 12 позициями без возможности увидеть
    остальные (ANALYSIS.md, п. 2.1.8) — здесь именно постраничная выдача.
    """
    items, total = await service.list_products(
        session,
        category=category,
        subcategory=subcategory,
        search=search,
        sort=sort,
        is_featured=is_featured,
        page=page,
        page_size=page_size,
    )
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/products/{slug}", response_model=ProductDetail)
async def get_product(
    slug: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductDetail:
    product = await service.get_product_detail(session, slug)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
    return product
