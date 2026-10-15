"""Списки админки в новом стиле (011e): каталог, разделы, заявки, отзывы.

Отдельный роутер подключается в main.py РАНЬШЕ `admin.router`: здесь пути вида
`/categories/order` и `/products/bulk`, а в admin.py — `/categories/{item_id}`;
при обратном порядке «order» попал бы в `{item_id}` и получил 422.
"""

from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import local_today
from app.core.db import get_session
from app.core.deps import CurrentAdmin
from app.models import (
    Category,
    ConsultationRequest,
    ConsultationSource,
    ConsultationStatus,
    CustomCake,
    Filling,
    GalleryItem,
    Product,
    ProductImage,
    Review,
    SubCategory,
)
from app.models.enums import RequestOccasion, ReviewSource
from app.schemas.admin import (
    ConsultationAdminOut,
    ConsultationListPage,
    ConsultationStatusUpdate,
    OrderIds,
    ProductAdminListItem,
    ProductBulkAction,
    ProductBulkResult,
    ReviewAdminOut,
    ReviewListPage,
)
from app.schemas.common import Page
from app.services import audit, revalidate

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _like(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# --- Каталог ---

Availability = Literal["today", "preorder", "out"]


def _availability(value: Availability) -> Any:
    if value == "out":
        return Product.is_available.is_(False)
    if value == "preorder":
        return and_(Product.is_available.is_(True), Product.effective_lead_time_days > 0)
    # «Закончилось сегодня» (006b) — уже не «готово сегодня», а под заказ на завтра
    return and_(Product.is_available.is_(True), Product.effective_lead_time_days == 0)


@router.get("/products", response_model=Page[ProductAdminListItem])
async def list_products(
    admin: CurrentAdmin,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=100)] = None,
    category_id: int | None = None,
    subcategory_id: int | None = None,
    availability: Availability | None = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ProductAdminListItem]:
    """Каталог с фильтрами (011e): поиск, раздел → подраздел, наличие, видимость."""
    query = select(Product)
    if search and search.strip():
        query = query.where(Product.name.ilike(_like(search.strip()), escape="\\"))
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    if subcategory_id is not None:
        query = query.where(Product.subcategory_id == subcategory_id)
    if availability is not None:
        query = query.where(_availability(availability))
    if is_active is not None:
        query = query.where(Product.is_active.is_(is_active))

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    products = (
        await session.scalars(
            query.options(selectinload(Product.variants))
            .order_by(Product.order, Product.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    ids = [p.id for p in products]
    images = dict(
        (
            await session.execute(
                select(ProductImage.product_id, ProductImage.storage_key).where(
                    ProductImage.product_id.in_(ids), ProductImage.is_main.is_(True)
                )
            )
        ).all()
    )
    categories = dict((await session.execute(select(Category.id, Category.name))).all())
    subcategories = dict((await session.execute(select(SubCategory.id, SubCategory.name))).all())
    return Page(
        items=[
            ProductAdminListItem.model_validate(p).model_copy(
                update={
                    "main_image": images.get(p.id),
                    "category_name": categories.get(p.category_id, ""),
                    "subcategory_name": subcategories.get(p.subcategory_id, ""),
                }
            )
            for p in products
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


BULK_CHANGES: dict[str, dict[str, bool]] = {
    "hide": {"is_active": False},
    "show": {"is_active": True},
    "unavailable": {"is_available": False},
    "available": {"is_available": True},
    # Дата «закончилось» ставится на сегодняшний день кондитерской (Product.sold_out_today)
    "sold_out": {"sold_out_today": True},
    "back_in_stock": {"sold_out_today": False},
}


@router.post("/products/bulk", response_model=ProductBulkResult)
async def bulk_update_products(
    data: ProductBulkAction,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> ProductBulkResult:
    """Скрыть, показать, снять с наличия — для одного или многих товаров (011e).

    Один запрос и одна транзакция, но в журнал — запись на каждый товар со своим
    «было → стало»: в ленте видно, что именно скрыли, а не «изменено 12 товаров».
    Переключатель «на сайте» в строке списка — тот же запрос с одним id.
    """
    products = list((await session.scalars(select(Product).where(Product.id.in_(data.ids)))).all())
    if len(products) != len(set(data.ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Часть товаров не найдена"
        )
    updated = 0
    slugs: list[str] = []
    for product in products:
        details = audit.apply_changes(product, BULK_CHANGES[data.action])
        if details is None:
            continue
        updated += 1
        slugs.append(product.slug)
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="product",
            entity_id=product.id,
            details=details,
        )
    await session.commit()
    paths = {path for slug in slugs for path in revalidate.catalog_paths(slug)}
    if paths:
        background.add_task(revalidate.revalidate_paths, sorted(paths))
    return ProductBulkResult(updated=updated)


@router.put("/categories/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_categories(
    data: OrderIds, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    """Порядок разделов — весь список id (перетаскивание или стрелки)."""
    rows = list((await session.scalars(select(Category))).all())
    by_id = {row.id: row for row in rows}
    if sorted(data.ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Список разделов изменился, обновите страницу",
        )
    for index, item_id in enumerate(data.ids):
        by_id[item_id].order = index
    await audit.record(session, request, admin, action="reorder", entity="category")
    await session.commit()


@router.put("/categories/{category_id}/subcategories/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_subcategories(
    category_id: int, data: OrderIds, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    rows = list(
        (
            await session.scalars(select(SubCategory).where(SubCategory.category_id == category_id))
        ).all()
    )
    by_id = {row.id: row for row in rows}
    if sorted(data.ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Список подразделов изменился, обновите страницу",
        )
    for index, item_id in enumerate(data.ids):
        by_id[item_id].order = index
    await audit.record(
        session, request, admin, action="reorder", entity="subcategory", entity_id=category_id
    )
    await session.commit()


# --- Порядок работ, начинок и тортов на заказ (011f) ---

ORDERED: dict[str, tuple[Any, str, tuple[str, ...]]] = {
    "gallery": (GalleryItem, "gallery_item", ("/", "/gallery")),
    "fillings": (Filling, "filling", ("/", "/custom-cakes")),
    "custom-cakes": (CustomCake, "custom_cake", ("/", "/custom-cakes")),
}


async def _reorder(
    kind: str,
    data: OrderIds,
    admin: Any,
    session: AsyncSession,
    request: Request,
    background: BackgroundTasks,
) -> None:
    """Порядок — весь список id: так два сотрудника не перемешают его, двигая
    одновременно; устаревший список — 409 «обновите страницу»."""
    model, entity, paths = ORDERED[kind]
    rows = list((await session.scalars(select(model))).all())
    by_id = {row.id: row for row in rows}
    if sorted(data.ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Список изменился, обновите страницу"
        )
    for index, item_id in enumerate(data.ids):
        by_id[item_id].order = index
    await audit.record(session, request, admin, action="reorder", entity=entity)
    await session.commit()
    background.add_task(revalidate.revalidate_paths, list(paths))


@router.put("/gallery/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_gallery(
    data: OrderIds,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    await _reorder("gallery", data, admin, session, request, background)


@router.put("/fillings/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_fillings(
    data: OrderIds,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    await _reorder("fillings", data, admin, session, request, background)


@router.put("/custom-cakes/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_custom_cakes(
    data: OrderIds,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    await _reorder("custom-cakes", data, admin, session, request, background)


# --- Заявки на торты ---

CONSULTATION_TABS: dict[str, tuple[ConsultationStatus, ...] | None] = {
    "all": None,
    "new": (ConsultationStatus.NEW,),
    "work": (ConsultationStatus.CONTACTED,),
    "closed": (ConsultationStatus.COMPLETED,),
}

# «Взять в работу» → «Закрыть». Закрытая заявка — последний шаг: если клиент вернулся,
# это новая заявка, а не воскрешение старой (её могли уже обезличить по сроку)
CONSULTATION_FLOW: dict[ConsultationStatus, set[ConsultationStatus]] = {
    ConsultationStatus.NEW: {ConsultationStatus.CONTACTED, ConsultationStatus.COMPLETED},
    ConsultationStatus.CONTACTED: {ConsultationStatus.COMPLETED},
    ConsultationStatus.COMPLETED: set(),
}


def _consultation_query(
    *,
    occasion: RequestOccasion | None,
    source: ConsultationSource | None,
    period: str | None,
    date_from: date | None,
    date_to: date | None,
) -> Select[Any]:
    query = select(ConsultationRequest)
    if occasion is not None:
        query = query.where(ConsultationRequest.occasion == occasion)
    if source is not None:
        query = query.where(ConsultationRequest.source == source)
    today = local_today()
    span: tuple[date, date] | None = None
    if period == "today":
        span = (today, today)
    elif period == "tomorrow":
        span = (today + timedelta(days=1), today + timedelta(days=1))
    elif period == "week":
        span = (today, today + timedelta(days=6))
    elif date_from or date_to:
        span = (date_from or date.min, date_to or date.max)
    if span is not None:
        query = query.where(
            ConsultationRequest.event_date >= span[0], ConsultationRequest.event_date <= span[1]
        )
    return query


@router.get("/consultations", response_model=ConsultationListPage)
async def list_consultations(
    admin: CurrentAdmin,
    session: SessionDep,
    tab: Literal["all", "new", "work", "closed"] = "all",
    occasion: RequestOccasion | None = None,
    source: ConsultationSource | None = None,
    period: Literal["today", "tomorrow", "week"] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ConsultationListPage:
    """Заявки (011e): вкладки по статусу со счётчиками, повод, дата события (по дню
    кондитерской), источник. Новые сверху."""
    base = _consultation_query(
        occasion=occasion, source=source, period=period, date_from=date_from, date_to=date_to
    )
    statuses = CONSULTATION_TABS[tab]
    query = base.where(ConsultationRequest.status.in_(statuses)) if statuses else base
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = (
        await session.scalars(
            query.order_by(ConsultationRequest.created_at.desc(), ConsultationRequest.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    by_status = await _status_counts(session, base)
    return ConsultationListPage(
        items=[ConsultationAdminOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        counts={
            name: sum(by_status.values())
            if group is None
            else sum(by_status.get(item, 0) for item in group)
            for name, group in CONSULTATION_TABS.items()
        },
    )


async def _status_counts(session: AsyncSession, base: Select[Any]) -> dict[ConsultationStatus, int]:
    sub = base.subquery()
    rows = await session.execute(select(sub.c.status, func.count()).group_by(sub.c.status))
    return {ConsultationStatus(row[0]): row[1] for row in rows.all()}


@router.get("/consultations/{request_id}", response_model=ConsultationAdminOut)
async def get_consultation(
    request_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> ConsultationAdminOut:
    """Карточка заявки. Просмотр — в журнал (152-ФЗ, как у заказов); в ленте главной
    просмотры не показываются."""
    row = await session.get(ConsultationRequest, request_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    result = ConsultationAdminOut.model_validate(row)
    await audit.record(
        session, request, admin, action="view", entity="consultation", entity_id=request_id
    )
    await session.commit()
    return result


@router.patch("/consultations/{request_id}", response_model=ConsultationAdminOut)
async def update_consultation(
    request_id: int,
    data: ConsultationStatusUpdate,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
) -> ConsultationAdminOut:
    row = await session.get(ConsultationRequest, request_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    if data.status != row.status and data.status not in CONSULTATION_FLOW[row.status]:
        message = (
            "Заявка уже закрыта. Если клиент вернулся, это новая заявка"
            if row.status is ConsultationStatus.COMPLETED
            else "Заявку в работе нельзя вернуть в новые"
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    row.status = data.status
    await audit.record(
        session,
        request,
        admin,
        action="update_status",
        entity="consultation",
        entity_id=request_id,
        details={"status": data.status.value},
    )
    await session.commit()
    await session.refresh(row)
    return ConsultationAdminOut.model_validate(row)


# --- Отзывы ---

REVIEW_TABS = ("pending", "published", "all")


@router.get("/reviews", response_model=ReviewListPage)
async def list_reviews(
    admin: CurrentAdmin,
    session: SessionDep,
    tab: Literal["pending", "published", "all"] = "pending",
    product_id: int | None = None,
    source: ReviewSource | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ReviewListPage:
    """Отзывы (011e): «Ждут публикации / Опубликованы / Все», товар, источник."""
    base = select(Review)
    if product_id is not None:
        base = base.where(Review.product_id == product_id)
    if source is not None:
        base = base.where(Review.source == source)
    query = base
    if tab == "pending":
        query = query.where(Review.is_published.is_(False))
    elif tab == "published":
        query = query.where(Review.is_published.is_(True))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = (
        await session.scalars(
            query.order_by(Review.created_at.desc(), Review.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    names = dict(
        (
            await session.execute(
                select(Product.id, Product.name).where(
                    Product.id.in_([r.product_id for r in rows if r.product_id])
                )
            )
        ).all()
    )
    sub = base.subquery()
    published = dict(
        (
            await session.execute(
                select(sub.c.is_published, func.count()).group_by(sub.c.is_published)
            )
        ).all()
    )
    return ReviewListPage(
        items=[
            ReviewAdminOut.model_validate(r).model_copy(
                update={"product_name": names.get(r.product_id) if r.product_id else None}
            )
            for r in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        counts={
            "pending": published.get(False, 0),
            "published": published.get(True, 0),
            "all": sum(published.values()),
        },
    )


def review_moment(day: date) -> datetime:
    """Дата отзыва → момент в полдень UTC, как в сиде: день не «уезжает» ни в
    одном часовом поясе России."""
    return datetime.combine(day, time(12), tzinfo=UTC)
