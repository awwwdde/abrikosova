"""Каталог — публичный API (02-api-contract.md, раздел «Каталог»)."""

from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import Availability, DietaryTag, Occasion, PortionsRange
from app.schemas.catalog import CatalogFilters, CategoryOut, ProductDetail, ProductListItem
from app.schemas.common import Page
from app.services import catalog as service

router = APIRouter(prefix="/catalog", tags=["catalog"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SortOption = Literal["price_asc", "price_desc", "name", "new"]
Price = Annotated[Decimal | None, Query(ge=0, max_digits=10, decimal_places=2)]


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: SessionDep):
    """Дерево активных категорий с подкатегориями — для меню и сайдбара каталога."""
    return await service.list_categories(session)


@router.get("/filters", response_model=CatalogFilters)
async def get_filters(session: SessionDep, category: str | None = None) -> CatalogFilters:
    """Справочник сквозных фильтров с подписями и границы цены.

    Подписи отдаёт бэкенд, чтобы сайт и админка не держали каждый свою копию.
    """
    return await service.get_filters(session, category)


@router.get("/products", response_model=Page[ProductListItem])
async def list_products(
    session: SessionDep,
    category: str | None = None,
    subcategory: str | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    sort: SortOption | None = None,
    is_featured: bool | None = None,
    # Мультизначения передаются повтором параметра: ?occasion=kids&occasion=birthday
    occasion: Annotated[list[Occasion], Query()] = [],  # noqa: B006 — FastAPI копирует default
    dietary: Annotated[list[DietaryTag], Query()] = [],  # noqa: B006
    portions: Annotated[list[PortionsRange], Query()] = [],  # noqa: B006
    availability: Availability | None = None,
    price_min: Price = None,
    price_max: Price = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[ProductListItem]:
    """Список товаров со сквозными фильтрами, сортировкой и настоящей пагинацией.

    Повод и порции объединяются через ИЛИ, ограничения в питании — через И.
    В старом коде список жёстко обрезался 12 позициями без возможности увидеть
    остальные (ANALYSIS.md, п. 2.1.8) — здесь именно постраничная выдача.
    """
    if price_min is not None and price_max is not None and price_min > price_max:
        raise HTTPException(
            status_code=422,  # константа переименована в новых Starlette — число однозначно
            detail="Минимальная цена больше максимальной",
        )

    params = service.ProductQuery(
        category=category,
        subcategory=subcategory,
        search=search,
        sort=sort,
        is_featured=is_featured,
        occasions=occasion,
        dietary=dietary,
        portions=portions,
        availability=availability,
        price_min=price_min,
        price_max=price_max,
        page=page,
        page_size=page_size,
    )
    items, total = await service.list_products(session, params)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/products/{slug}", response_model=ProductDetail)
async def get_product(slug: str, session: SessionDep) -> ProductDetail:
    product = await service.get_product_detail(session, slug)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
    return product
