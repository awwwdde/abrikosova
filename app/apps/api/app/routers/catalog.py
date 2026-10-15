"""Каталог — публичный API (02-api-contract.md, раздел «Каталог»)."""

from dataclasses import replace
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import (
    Availability,
    DietaryTag,
    LegacyKind,
    Occasion,
    PortionsRange,
    Recipient,
)
from app.schemas.catalog import (
    CatalogFilters,
    CatalogSitemap,
    CategoryOut,
    LegacyTarget,
    ProductDetail,
    ProductListItem,
)
from app.schemas.common import Page
from app.services import catalog as service
from app.services import legacy

router = APIRouter(prefix="/catalog", tags=["catalog"])
legacy_router = APIRouter(prefix="/legacy", tags=["legacy"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
# «По названию» убрано: в выпадающем списке макета его нет (005a)
SortOption = Literal["today_first", "price_asc", "price_desc", "new"]
Price = Annotated[Decimal | None, Query(ge=0, max_digits=10, decimal_places=2)]


async def catalog_query(
    category: str | None = None,
    subcategory: str | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    is_featured: bool | None = None,
    availability: Availability | None = None,
    # Мультизначения передаются повтором параметра: ?occasion=tea&occasion=birthday
    dietary: Annotated[list[DietaryTag], Query()] = [],  # noqa: B006 — FastAPI копирует default
    recipient: Annotated[list[Recipient], Query()] = [],  # noqa: B006
    occasion: Annotated[list[Occasion], Query()] = [],  # noqa: B006
    portions: Annotated[list[PortionsRange], Query()] = [],  # noqa: B006
    price_min: Price = None,
    price_max: Price = None,
) -> service.ProductQuery:
    """Параметры выбора — общие для списка товаров и счётчиков фильтров:
    панель должна считать ровно то, что потом покажет список."""
    if price_min is not None and price_max is not None and price_min > price_max:
        raise HTTPException(
            status_code=422,  # константа переименована в новых Starlette — число однозначно
            detail="Минимальная цена больше максимальной",
        )
    if Occasion.KIDS in occasion:
        # В каталоге «детский» — это «Кому: для детей» (005a); повод `kids`
        # остался только у работ в галерее
        raise HTTPException(
            status_code=422, detail="Для детских позиций используйте recipient=kids"
        )
    return service.ProductQuery(
        category=category,
        subcategory=subcategory,
        search=search,
        is_featured=is_featured,
        availability=availability,
        dietary=dietary,
        recipients=recipient,
        occasions=occasion,
        portions=portions,
        price_min=price_min,
        price_max=price_max,
    )


QueryDep = Annotated[service.ProductQuery, Depends(catalog_query)]


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: SessionDep):
    """Дерево активных категорий с подкатегориями — для меню и вкладок каталога."""
    return await service.list_categories(session)


@router.get("/filters", response_model=CatalogFilters)
async def get_filters(session: SessionDep, params: QueryDep) -> CatalogFilters:
    """Панель фильтров: значения, подписи и счётчики по текущему выбору.

    Принимает те же параметры, что `/catalog/products`. Подписи отдаёт бэкенд,
    чтобы сайт и админка не держали каждый свою копию.
    """
    return await service.get_filters(session, params)


@router.get("/products", response_model=Page[ProductListItem])
async def list_products(
    session: SessionDep,
    params: QueryDep,
    sort: SortOption | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[ProductListItem]:
    """Список товаров со сквозными фильтрами, сортировкой и настоящей пагинацией.

    Состав — через И, остальные группы — через ИЛИ внутри группы. Сортировка
    по умолчанию — «Сначала готовое сегодня». В старом коде список жёстко
    обрезался 12 позициями (ANALYSIS.md, п. 2.1.8) — здесь постраничная выдача.
    """
    params = replace(params, sort=sort, page=page, page_size=page_size)
    items, total = await service.list_products(session, params)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/products/{slug}", response_model=ProductDetail)
async def get_product(slug: str, session: SessionDep) -> ProductDetail:
    product = await service.get_product_detail(session, slug)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
    return product


@router.get("/sitemap", response_model=CatalogSitemap)
async def get_sitemap(session: SessionDep) -> CatalogSitemap:
    """Слаги и даты для sitemap.xml сайта: категории, подкатегории и товары (012)."""
    return await legacy.sitemap(session)


@legacy_router.get("/resolve", response_model=LegacyTarget)
async def resolve_legacy(
    kind: LegacyKind,
    key: Annotated[str, Query(min_length=1, max_length=500)],
    session: SessionDep,
) -> LegacyTarget:
    """Новый адрес для адреса старого сайта (012). 404 — соответствия нет.

    Публичный и без авторизации: его спрашивает middleware сайта, когда приходит
    старый адрес. Ответ не раскрывает ничего, чего нет на самом сайте.
    """
    target = await legacy.resolve(session, kind, key)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соответствия нет")
    return target
