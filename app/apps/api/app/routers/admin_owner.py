"""Разделы только для владельца (011c): журнал действий и настройки кондитерской.

Права — на бэкенде (`OwnerOnly` → 403 менеджеру), меню лишь прячет пункты.
Журнал — владельцу, потому что в нём действия всех сотрудников и журнал входов
с IP и устройствами; менеджеру хватает ленты «Последние действия» на главной.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import OwnerOnly
from app.models import Product
from app.schemas.common import Page
from app.schemas.dashboard import ActivityItem
from app.schemas.settings import BakerySettings
from app.services import audit, bakery_settings, journal, revalidate

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/journal", response_model=Page[ActivityItem])
async def get_journal(
    admin: OwnerOnly,
    session: SessionDep,
    tab: Literal["actions", "security"] = "actions",
    actor: Annotated[
        str | None,
        Query(pattern=r"^(\d+|site)$", description="id сотрудника или «site» — события сайта"),
    ] = None,
    kind: Annotated[
        Literal["catalog", "orders", "requests", "reviews", "pages", "staff", "system"] | None,
        Query(description="тип события (только для вкладки «Действия»)"),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ActivityItem]:
    """Лента целиком с фильтрами. Вкладка «Безопасность» — входы, выходы,
    блокировки и подозрения на кражу сессии (`entity="auth"`)."""
    filters = journal.JournalFilter(
        security=tab == "security",
        actor=actor,
        kind=kind if tab == "actions" else None,
    )
    items = await journal.items(
        session, admin, filters, limit=page_size, offset=(page - 1) * page_size
    )
    total = await journal.count(session, filters)
    return Page[ActivityItem](items=items, total=total, page=page, page_size=page_size)


@router.get("/settings", response_model=BakerySettings)
async def get_settings_page(admin: OwnerOnly, session: SessionDep) -> BakerySettings:
    return await bakery_settings.load(session)


@router.put("/settings", response_model=BakerySettings)
async def update_settings(
    data: BakerySettings,
    admin: OwnerOnly,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> BakerySettings:
    changes = await bakery_settings.save(session, data)
    if changes:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="settings",
            details={"changes": changes},
        )
    await session.commit()
    # Кэш сброшен и до коммита; повторно — чтобы параллельный запрос между
    # сбросом и коммитом не успел положить в кэш старые значения
    await bakery_settings.drop_cache()
    if any(key.startswith("cake_") for key in changes):
        # Цены «от X ₽», факты и калькулятор «Тортов на заказ» считаются из настроек (008b)
        background.add_task(revalidate.revalidate_paths, ["/custom-cakes"])
    if "inscription_price" in changes:
        # «+300 ₽» напечатано на страницах товаров с надписью — сбрасываем их кэш
        slugs = (
            await session.scalars(select(Product.slug).where(Product.allows_inscription.is_(True)))
        ).all()
        paths = sorted({path for slug in slugs for path in revalidate.catalog_paths(slug)})
        background.add_task(revalidate.revalidate_paths, paths)
    return data
