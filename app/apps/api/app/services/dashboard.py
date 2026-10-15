"""Агрегаты главной админки (задание 011b).

Все «сегодня», «неделя» и «месяц» — дни кондитерской (`BUSINESS_TIMEZONE`), а не
UTC сервера: заказ, оформленный в 00:30 по Москве, относится к новому дню, хотя
в UTC это ещё вчерашний вечер. Границы дня переводятся в момент времени
с часовым поясом, и уже по нему фильтруется `created_at` (он хранится в UTC).

Отменённые заказы не входят ни в выручку, ни в «к выдаче», ни в популярное —
их считают только в строке «Отменено».
"""

import csv
import io
from collections.abc import Sequence
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_now
from app.core.config import get_settings
from app.models import (
    AdminUser,
    Category,
    ConsultationRequest,
    ConsultationStatus,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductImage,
    ProductVariant,
    Review,
    SubCategory,
)
from app.models.enums import Occasion
from app.schemas.custom_cakes import REQUEST_OCCASION_LABELS
from app.schemas.dashboard import (
    ActivityItem,
    Calendar,
    CategoryShare,
    CategoryShares,
    ConsultationBrief,
    Consultations,
    Counters,
    Dashboard,
    DayCount,
    LargeEvent,
    OrdersByDay,
    Plan,
    PlanItem,
    PopularProduct,
    Revenue,
    ReviewBrief,
    UpcomingDay,
)
from app.schemas.settings import BakerySettings
from app.services import bakery_settings, journal

PERIOD_DAYS = 7
MONTH_DAYS = 30
CHART_DAYS = 14
UPCOMING_DAYS = 3
PLAN_LIMIT = 50
ACTIVITY_LIMIT = 10

ORDER_STATUS_LABELS: dict[OrderStatus, str] = {
    OrderStatus.NEW: "Новый",
    OrderStatus.CONFIRMED: "Подтверждён",
    OrderStatus.IN_PROGRESS: "Готовится",
    OrderStatus.READY: "Готов к выдаче",
    OrderStatus.COMPLETED: "Выдан",
    OrderStatus.CANCELLED: "Отменён",
}

ACTIVE_CONSULTATION = (ConsultationStatus.NEW, ConsultationStatus.CONTACTED)


def business_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().business_timezone)


def day_start(day: date) -> datetime:
    """Начало дня кондитерской как момент времени (для сравнения с created_at)."""
    return datetime.combine(day, time.min, tzinfo=business_tz())


def created_between(first: date, last: date) -> ColumnElement[bool]:
    """Заказ оформлен в дни first…last включительно (по местному времени)."""
    return and_(
        Order.created_at >= day_start(first),
        Order.created_at < day_start(last + timedelta(days=1)),
    )


NOT_CANCELLED = Order.status != OrderStatus.CANCELLED


def phone_digits(column: Any) -> ColumnElement[str]:
    """Телефон только цифрами, «8…» приведено к «7…»: «+7 (916) 123-45-67»,
    «89161234567» и «7 916 123 45 67» — один и тот же клиент."""
    digits = func.regexp_replace(column, r"\D", "", "g")
    return func.regexp_replace(digits, r"^8(\d{10})$", r"7\1")


def _percent_round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


# --- Счётчики ---


async def counters(session: AsyncSession) -> Counters:
    orders_new = await session.scalar(
        select(func.count()).select_from(Order).where(Order.status == OrderStatus.NEW)
    )
    consultations_new = await session.scalar(
        select(func.count())
        .select_from(ConsultationRequest)
        .where(ConsultationRequest.status == ConsultationStatus.NEW)
    )
    reviews = await session.scalar(
        select(func.count()).select_from(Review).where(Review.is_published.is_(False))
    )
    return Counters(
        orders_new=orders_new or 0,
        consultations_new=consultations_new or 0,
        reviews_unpublished=reviews or 0,
    )


# --- Выручка ---


async def _period_numbers(session: AsyncSession, first: date, last: date) -> dict[str, Any]:
    total, orders = (
        await session.execute(
            select(func.coalesce(func.sum(Order.total_price), 0), func.count()).where(
                created_between(first, last), NOT_CANCELLED
            )
        )
    ).one()
    cancelled = await session.scalar(
        select(func.count()).where(
            created_between(first, last), Order.status == OrderStatus.CANCELLED
        )
    )
    # Новый клиент — телефон, у которого первый заказ пришёлся на этот период
    first_orders = (
        select(phone_digits(Order.customer_phone).label("phone"))
        .group_by("phone")
        .having(func.min(Order.created_at) >= day_start(first))
        .having(func.min(Order.created_at) < day_start(last + timedelta(days=1)))
        .subquery()
    )
    new_customers = await session.scalar(select(func.count()).select_from(first_orders))
    total = Decimal(total)
    average = _percent_round(total / orders) if orders else Decimal(0)
    return {
        "total": total,
        "orders": orders,
        "average": average,
        "cancelled": cancelled or 0,
        "new_customers": new_customers or 0,
    }


async def revenue(session: AsyncSession, today: date) -> Revenue:
    first = today - timedelta(days=PERIOD_DAYS - 1)
    current = await _period_numbers(session, first, today)
    previous = await _period_numbers(
        session, first - timedelta(days=PERIOD_DAYS), first - timedelta(days=1)
    )
    return Revenue(
        period_start=first,
        period_end=today,
        total=current["total"],
        previous_total=previous["total"],
        orders=current["orders"],
        previous_orders=previous["orders"],
        average=current["average"],
        previous_average=previous["average"],
        cancelled=current["cancelled"],
        previous_cancelled=previous["cancelled"],
        new_customers=current["new_customers"],
        previous_new_customers=previous["new_customers"],
    )


# --- Заказы к выдаче по дням ---


async def _counts_by_desired_date(
    session: AsyncSession, first: date, last: date
) -> dict[date, int]:
    rows = await session.execute(
        select(Order.desired_date, func.count())
        .where(Order.desired_date >= first, Order.desired_date <= last, NOT_CANCELLED)
        .group_by(Order.desired_date)
    )
    return {day: count for day, count in rows.all()}


async def _wedding_days(session: AsyncSession, first: date, last: date) -> set[date]:
    rows = await session.scalars(
        select(ConsultationRequest.event_date).where(
            ConsultationRequest.event_date >= first,
            ConsultationRequest.event_date <= last,
            ConsultationRequest.occasion == Occasion.WEDDING,
            ConsultationRequest.status.in_(ACTIVE_CONSULTATION),
        )
    )
    return {day for day in rows.all() if day is not None}


async def _large_order_days(
    session: AsyncSession, first: date, last: date, limits: BakerySettings
) -> set[date]:
    rows = await session.scalars(
        select(Order.desired_date).where(
            Order.desired_date >= first,
            Order.desired_date <= last,
            Order.total_price >= limits.large_order_total,
            NOT_CANCELLED,
        )
    )
    return {day for day in rows.all() if day is not None}


async def orders_by_day(session: AsyncSession, today: date, limits: BakerySettings) -> OrdersByDay:
    first = today - timedelta(days=CHART_DAYS - 1)
    last = today + timedelta(days=UPCOMING_DAYS)
    counts = await _counts_by_desired_date(session, first, last)
    upcoming_first = today + timedelta(days=1)
    weddings = await _wedding_days(session, upcoming_first, last)
    large = await _large_order_days(session, upcoming_first, last, limits)
    days = [first + timedelta(days=i) for i in range(CHART_DAYS)]
    upcoming = [today + timedelta(days=i) for i in range(1, UPCOMING_DAYS + 1)]
    return OrdersByDay(
        days=[DayCount(day=day, count=counts.get(day, 0)) for day in days],
        today=counts.get(today, 0),
        yesterday=counts.get(today - timedelta(days=1), 0),
        upcoming=[
            UpcomingDay(
                day=day,
                count=counts.get(day, 0),
                has_wedding=day in weddings,
                has_large=day in large,
            )
            for day in upcoming
        ],
    )


# --- Что заказывают ---


async def _category_shares(session: AsyncSession, first: date, last: date) -> list[CategoryShare]:
    rows = await session.execute(
        select(Category.name, func.sum(OrderItem.quantity))
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .join(Category, Category.id == Product.category_id)
        .where(created_between(first, last), NOT_CANCELLED)
        .group_by(Category.name)
        .order_by(func.sum(OrderItem.quantity).desc(), Category.name)
    )
    return [CategoryShare(name=name, items=int(items)) for name, items in rows.all()]


async def categories(session: AsyncSession, today: date) -> CategoryShares:
    return CategoryShares(
        week=await _category_shares(session, today - timedelta(days=PERIOD_DAYS - 1), today),
        month=await _category_shares(session, today - timedelta(days=MONTH_DAYS - 1), today),
    )


# --- План выдачи ---


async def item_summaries(session: AsyncSession, order_ids: Sequence[int]) -> dict[int, str]:
    """«Медовик ×2, Медовик целый 2 кг» для каждого заказа — в списке заказов и
    на главной админки одной функцией.

    Название и подпись варианта — снапшоты из заказа: переименование товара
    историю не меняет. Подпись варианта добавляется, если у товара больше
    одного варианта: у пирожного с единственным «100 г» она лишняя.
    """
    if not order_ids:
        return {}
    variants_count = (
        select(func.count(ProductVariant.id))
        .where(ProductVariant.product_id == OrderItem.product_id)
        .correlate(OrderItem)
        .scalar_subquery()
    )
    rows = await session.execute(
        select(
            OrderItem.order_id,
            OrderItem.product_name,
            OrderItem.variant_label,
            OrderItem.quantity,
            variants_count,
        )
        .where(OrderItem.order_id.in_(order_ids))
        .order_by(OrderItem.order_id, OrderItem.id)
    )
    parts: dict[int, list[str]] = {}
    for order_id, name, label, quantity, variants in rows.all():
        title = f"{name} {label}" if variants > 1 else name
        parts.setdefault(order_id, []).append(f"{title} ×{quantity}" if quantity > 1 else title)
    return {order_id: ", ".join(items) for order_id, items in parts.items()}


async def _plan_for(session: AsyncSession, day: date) -> list[PlanItem]:
    orders = (
        await session.scalars(
            select(Order)
            .where(Order.desired_date == day, NOT_CANCELLED)
            # Без интервала — в конце дня: время не согласовано, это видно сразу
            .order_by(Order.delivery_interval.is_(None), Order.delivery_interval, Order.id)
            .limit(PLAN_LIMIT)
        )
    ).all()
    summaries = await item_summaries(session, [order.id for order in orders])
    return [
        PlanItem(
            id=order.id,
            order_number=order.order_number,
            customer_name=order.customer_name,
            items=summaries.get(order.id, ""),
            delivery_method=order.delivery_method,
            delivery_interval=order.delivery_interval,
            status=order.status,
        )
        for order in orders
    ]


async def plan(session: AsyncSession, today: date) -> Plan:
    return Plan(
        today=await _plan_for(session, today),
        tomorrow=await _plan_for(session, today + timedelta(days=1)),
    )


# --- Заявки, популярное, отзывы ---


async def consultations(session: AsyncSession, limit: int = 3) -> Consultations:
    active = ConsultationRequest.status.in_(ACTIVE_CONSULTATION)
    rows = (
        await session.scalars(
            select(ConsultationRequest)
            .where(active)
            .order_by(ConsultationRequest.created_at.desc(), ConsultationRequest.id.desc())
            .limit(limit)
        )
    ).all()
    total = await session.scalar(
        select(func.count()).select_from(ConsultationRequest).where(active)
    )
    return Consultations(
        items=[ConsultationBrief.model_validate(row, from_attributes=True) for row in rows],
        more=max(0, (total or 0) - len(rows)),
    )


def _popular_query(first: date, last: date) -> Any:
    sold = func.sum(OrderItem.quantity).label("sold")
    return (
        select(
            Product.id,
            Product.name,
            Product.slug,
            Category.name.label("category"),
            SubCategory.name.label("subcategory"),
            Product.is_active,
            Product.is_available,
            Product.effective_lead_time_days.label("lead_time_days"),
            sold,
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .join(Category, Category.id == Product.category_id)
        .join(SubCategory, SubCategory.id == Product.subcategory_id)
        .where(created_between(first, last), NOT_CANCELLED)
        .group_by(Product.id, Category.name, SubCategory.name)
        .order_by(sold.desc(), Product.name)
    )


async def popular(
    session: AsyncSession, today: date, limit: int | None = 4
) -> list[PopularProduct]:
    query = _popular_query(today - timedelta(days=PERIOD_DAYS - 1), today)
    if limit is not None:
        query = query.limit(limit)
    rows = (await session.execute(query)).all()
    images = dict(
        (
            await session.execute(
                select(ProductImage.product_id, ProductImage.storage_key).where(
                    ProductImage.product_id.in_([row.id for row in rows]),
                    ProductImage.is_main.is_(True),
                )
            )
        ).all()
    )
    return [
        PopularProduct(
            id=row.id,
            name=row.name,
            slug=row.slug,
            category=row.category,
            subcategory=row.subcategory,
            image_key=images.get(row.id),
            sold=int(row.sold),
            is_active=row.is_active,
            is_available=row.is_available,
            lead_time_days=row.lead_time_days,
        )
        for row in rows
    ]


async def reviews(session: AsyncSession, limit: int = 3) -> list[ReviewBrief]:
    rows = (
        await session.scalars(
            select(Review)
            .where(Review.is_published.is_(False))
            .order_by(Review.created_at.desc(), Review.id.desc())
            .limit(limit)
        )
    ).all()
    return [ReviewBrief.model_validate(row, from_attributes=True) for row in rows]


# --- Календарь ---


def parse_month(value: str | None, today: date) -> date:
    """«2026-10» → 1 октября 2026. Пусто или мусор — текущий месяц."""
    if value:
        try:
            year, month = (int(part) for part in value.split("-", 1))
            return date(year, month, 1)
        except ValueError:
            pass
    return today.replace(day=1)


async def large_events(
    session: AsyncSession, today: date, limits: BakerySettings, limit: int = 2
) -> list[LargeEvent]:
    """Ближайшие крупные события: свадьбы и банкеты из заявок, большие заказы.
    Пороги — из настроек кондитерской (011c)."""
    requests = (
        await session.scalars(
            select(ConsultationRequest)
            .where(
                ConsultationRequest.event_date >= today,
                ConsultationRequest.status.in_(ACTIVE_CONSULTATION),
                or_(
                    ConsultationRequest.occasion == Occasion.WEDDING,
                    ConsultationRequest.guests_count >= limits.large_event_guests,
                ),
            )
            .order_by(ConsultationRequest.event_date, ConsultationRequest.id)
            .limit(limit)
        )
    ).all()
    orders = (
        await session.scalars(
            select(Order)
            .where(
                Order.desired_date >= today,
                Order.total_price >= limits.large_order_total,
                NOT_CANCELLED,
            )
            .order_by(Order.desired_date, Order.id)
            .limit(limit)
        )
    ).all()
    events: list[LargeEvent] = []
    for request in requests:
        what = REQUEST_OCCASION_LABELS[request.occasion] if request.occasion else "Заявка"
        guests = f", {request.guests_count} гостей" if request.guests_count else ""
        events.append(
            LargeEvent(
                day=request.event_date,  # type: ignore[arg-type]  # отфильтровано выше
                label=f"{what}{guests}",
                href=f"/admin/consultations/{request.id}",
            )
        )
    for order in orders:
        total = f"{int(order.total_price):,}".replace(",", " ")
        events.append(
            LargeEvent(
                day=order.desired_date,  # type: ignore[arg-type]
                label=f"Заказ № {order.order_number}, {total} ₽",
                href=f"/admin/orders/{order.id}",
            )
        )
    events.sort(key=lambda event: event.day)
    return events[:limit]


async def calendar(
    session: AsyncSession, today: date, month: date, limits: BakerySettings
) -> Calendar:
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    counts = await _counts_by_desired_date(session, month, next_month - timedelta(days=1))
    return Calendar(
        month=month.strftime("%Y-%m"),
        days=[DayCount(day=day, count=count) for day, count in sorted(counts.items())],
        large=await large_events(session, today, limits),
    )


# --- Последние действия ---


async def activity(
    session: AsyncSession, viewer: AdminUser, limit: int = ACTIVITY_LIMIT
) -> list[ActivityItem]:
    """Лента главной — та же выборка и тексты, что в разделе «Журнал» (011c), без
    событий входа: это журнал безопасности, у него своя вкладка."""
    return await journal.items(session, viewer, journal.JournalFilter(hide_views=True), limit=limit)


# --- Сводка целиком ---


async def build(session: AsyncSession, viewer: AdminUser) -> Dashboard:
    now = local_now()
    today = now.date()
    limits = await bakery_settings.load(session)
    return Dashboard(
        today=today,
        now=now,
        counters=await counters(session),
        revenue=await revenue(session, today),
        orders_by_day=await orders_by_day(session, today, limits),
        categories=await categories(session, today),
        plan=await plan(session, today),
        consultations=await consultations(session),
        popular=await popular(session, today),
        calendar=await calendar(session, today, today.replace(day=1), limits),
        activity=await activity(session, viewer),
        reviews=await reviews(session),
    )


# --- CSV ---


def _csv_cell(value: Any) -> Any:
    # Кавычки CSV защищают разделители, но Excel всё равно исполняет формулы.
    # Учитываем пробелы и управляющие символы перед знаком формулы.
    if isinstance(value, str):
        leading = value.lstrip("\ufeff \t\r\n\v\f")
        if leading.startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
            return "'" + value
    return value


def to_csv(header: list[str], rows: list[list[Any]]) -> bytes:
    """CSV для Excel: «;» как разделитель (русская локаль Excel) и BOM, иначе
    кириллица откроется кракозябрами."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([_csv_cell(cell) for cell in header])
    writer.writerows([_csv_cell(cell) for cell in row] for row in rows)
    return ("﻿" + buffer.getvalue()).encode("utf-8")


async def week_report(session: AsyncSession, today: date) -> tuple[str, bytes]:
    """Заказы за 7 дней: номер, дата, клиент, сумма, статус. Без телефона —
    файл уходит из системы, и лишние ПДн в нём не нужны."""
    first = today - timedelta(days=PERIOD_DAYS - 1)
    orders = (
        await session.scalars(
            select(Order).where(created_between(first, today)).order_by(Order.created_at)
        )
    ).all()
    tz = business_tz()
    rows = [
        [
            order.order_number,
            order.created_at.astimezone(tz).strftime("%d.%m.%Y %H:%M"),
            order.customer_name,
            str(order.total_price),
            ORDER_STATUS_LABELS[order.status],
        ]
        for order in orders
    ]
    name = f"zakazy-{first:%Y-%m-%d}-{today:%Y-%m-%d}.csv"
    return name, to_csv(["Номер", "Оформлен", "Клиент", "Сумма, ₽", "Статус"], rows)


def availability_label(product: PopularProduct) -> str:
    if not product.is_active or not product.is_available:
        return "Нет в наличии"
    if product.lead_time_days > 0:
        return f"Под заказ, {product.lead_time_days} дн."
    return "В наличии"


async def popular_report(session: AsyncSession, today: date) -> tuple[str, bytes]:
    first = today - timedelta(days=PERIOD_DAYS - 1)
    products = await popular(session, today, limit=None)
    rows = [
        [p.name, f"{p.category} · {p.subcategory}", p.sold, availability_label(p)] for p in products
    ]
    name = f"populyarnoe-{first:%Y-%m-%d}-{today:%Y-%m-%d}.csv"
    return name, to_csv(["Товар", "Раздел", "Продано, шт.", "Наличие"], rows)
