"""Главная админки и общий поиск (задание 011b).

Отдельный роутер, а не продолжение `admin.py`: там разделы с CRUD, а здесь только
чтение сводок, и файл и без того перерос тысячу строк. Префикс тот же — `/admin`,
права те же: обе роли видят главную, счётчики и поиск (заказы и заявки — общая
работа владельца и менеджера).
"""

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_now, local_today
from app.core.config import get_settings
from app.core.db import get_session
from app.core.deps import CurrentAdmin
from app.models import ConsultationRequest, Order, Product
from app.schemas.dashboard import (
    BusinessClock,
    Calendar,
    Counters,
    Dashboard,
    SearchConsultation,
    SearchOrder,
    SearchProduct,
    SearchResults,
)
from app.services import bakery_settings, dashboard

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

SEARCH_LIMIT = 5
# С какого числа цифр запрос считается номером телефона: «12» встречается
# в любом номере, а с трёх цифр совпадения уже осмысленные
PHONE_MIN_DIGITS = 3


@router.get("/dashboard", response_model=Dashboard)
async def get_dashboard(admin: CurrentAdmin, session: SessionDep) -> Dashboard:
    """Вся главная одним запросом: на экране десяток блоков, и десяток запросов
    с вкладки при каждом открытии главной — лишняя задержка и нагрузка."""
    return await dashboard.build(session, admin)


@router.get("/dashboard/calendar", response_model=Calendar)
async def get_calendar(
    admin: CurrentAdmin,
    session: SessionDep,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$", description="ГГГГ-ММ")] = None,
) -> Calendar:
    """Календарь другого месяца — при перелистывании, без пересчёта всей главной."""
    today = local_today()
    limits = await bakery_settings.load(session)
    return await dashboard.calendar(session, today, dashboard.parse_month(month, today), limits)


def _csv_response(name: str, body: bytes) -> Response:
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
    )


@router.get("/dashboard/report.csv", response_class=Response)
async def week_report(admin: CurrentAdmin, session: SessionDep) -> Response:
    return _csv_response(*await dashboard.week_report(session, local_today()))


@router.get("/dashboard/popular.csv", response_class=Response)
async def popular_report(admin: CurrentAdmin, session: SessionDep) -> Response:
    return _csv_response(*await dashboard.popular_report(session, local_today()))


@router.get("/clock", response_model=BusinessClock)
async def get_clock(admin: CurrentAdmin) -> BusinessClock:
    """«Сегодня» кондитерской (011d): по нему карточка товара подсказывает ближайшую
    дату для покупателя. Браузер в другом поясе посчитал бы её на день раньше."""
    return BusinessClock(
        today=local_today(), now=local_now(), timezone=get_settings().business_timezone
    )


@router.get("/counters", response_model=Counters)
async def get_counters(admin: CurrentAdmin, session: SessionDep) -> Counters:
    """Счётчики меню и колокольчика. Лёгкий: три count, вкладка опрашивает его раз в минуту."""
    return await dashboard.counters(session)


@router.get("/search", response_model=SearchResults)
async def search(
    admin: CurrentAdmin,
    session: SessionDep,
    q: Annotated[str, Query(min_length=2, max_length=100)],
) -> SearchResults:
    """Поиск по заказам (номер, имя, телефон), товарам и заявкам — до 5 каждого.

    Телефон ищется по цифрам: в базе он хранится так, как его ввёл клиент
    («+7 (916) 123-45-67»), а ищут обычно куском номера без скобок и пробелов.
    """
    text = q.strip()
    # % и _ во вводе — обычные символы, а не шаблон LIKE
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    by_phone = len(digits) >= PHONE_MIN_DIGITS

    order_filters = [
        Order.order_number.ilike(pattern, escape="\\"),
        Order.customer_name.ilike(pattern, escape="\\"),
    ]
    request_filters = [ConsultationRequest.name.ilike(pattern, escape="\\")]
    if by_phone:
        order_filters.append(dashboard.phone_digits(Order.customer_phone).contains(digits))
        request_filters.append(dashboard.phone_digits(ConsultationRequest.phone).contains(digits))

    orders = (
        await session.scalars(
            select(Order)
            .where(or_(*order_filters))
            .order_by(Order.created_at.desc())
            .limit(SEARCH_LIMIT)
        )
    ).all()
    products = (
        await session.scalars(
            select(Product)
            .where(Product.name.ilike(pattern, escape="\\"))
            .order_by(Product.is_active.desc(), Product.name)
            .limit(SEARCH_LIMIT)
        )
    ).all()
    requests = (
        await session.scalars(
            select(ConsultationRequest)
            .where(or_(*request_filters))
            .order_by(ConsultationRequest.created_at.desc())
            .limit(SEARCH_LIMIT)
        )
    ).all()
    return SearchResults(
        orders=[
            SearchOrder(
                id=o.id,
                order_number=o.order_number,
                customer_name=o.customer_name,
                customer_phone=o.customer_phone,
            )
            for o in orders
        ],
        products=[SearchProduct(id=p.id, name=p.name) for p in products],
        consultations=[SearchConsultation(id=r.id, name=r.name, phone=r.phone) for r in requests],
    )
