"""Раздел «Заказы» в админке (011d): фильтры, вкладки, переходы статусов, CSV.

Даты фильтра — дни кондитерской (`local_today`), а не UTC сервера: «сегодня»
в 00:30 по Москве — это уже новый день, хотя в UTC ещё вчерашний вечер.
Фильтр идёт по желаемой дате получения (`desired_date`): менеджеру важно,
что выдавать, а не когда оформили.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy import ColumnElement, Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_today
from app.models import Order, OrderStatus
from app.models.enums import DeliveryInterval, DeliveryMethod

Period = Literal["today", "tomorrow", "week"]
Tab = Literal["all", "new", "work", "ready", "done"]

# Вкладки концепта: «В работе» = подтверждён + готовится, «Выданы» = выдан + отменён
TABS: dict[str, tuple[OrderStatus, ...] | None] = {
    "all": None,
    "new": (OrderStatus.NEW,),
    "work": (OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS),
    "ready": (OrderStatus.READY,),
    "done": (OrderStatus.COMPLETED, OrderStatus.CANCELLED),
}

# Из выданного или отменённого заказа хода нет: выдачу не «отменишь», а
# отменённый заказ клиент уже не ждёт. Ошибку исправляют новым заказом.
FINAL = frozenset({OrderStatus.COMPLETED, OrderStatus.CANCELLED})

NEXT_STEP: dict[OrderStatus, OrderStatus] = {
    OrderStatus.NEW: OrderStatus.CONFIRMED,
    OrderStatus.CONFIRMED: OrderStatus.IN_PROGRESS,
    OrderStatus.IN_PROGRESS: OrderStatus.READY,
    OrderStatus.READY: OrderStatus.COMPLETED,
}


class TransitionError(Exception):
    """Переход статуса невозможен — роутер отвечает 409."""


def check_transition(current: OrderStatus, new: OrderStatus) -> None:
    if current in FINAL and new != current:
        label = "выдан" if current is OrderStatus.COMPLETED else "отменён"
        raise TransitionError(f"Заказ уже {label}, его статус больше не меняется")


@dataclass(frozen=True)
class OrderFilters:
    period: Period | None = None
    date_from: date | None = None
    date_to: date | None = None
    method: DeliveryMethod | None = None

    def date_range(self) -> tuple[date, date] | None:
        today = local_today()
        if self.period == "today":
            return today, today
        if self.period == "tomorrow":
            tomorrow = today + timedelta(days=1)
            return tomorrow, tomorrow
        if self.period == "week":
            return today, today + timedelta(days=6)
        if self.date_from or self.date_to:
            return self.date_from or date.min, self.date_to or date.max
        return None

    def conditions(self) -> list[ColumnElement[bool]]:
        result: list[ColumnElement[bool]] = []
        span = self.date_range()
        if span is not None:
            result.append(and_(Order.desired_date >= span[0], Order.desired_date <= span[1]))
        if self.method is not None:
            result.append(Order.delivery_method == self.method)
        return result


def base_query(filters: OrderFilters, tab: str = "all") -> Select[Any]:
    query = select(Order).where(*filters.conditions())
    statuses = TABS.get(tab)
    if statuses:
        query = query.where(Order.status.in_(statuses))
    return query


async def tab_counts(session: AsyncSession, filters: OrderFilters) -> dict[str, int]:
    rows = await session.execute(
        select(Order.status, func.count()).where(*filters.conditions()).group_by(Order.status)
    )
    by_status = {status: count for status, count in rows.all()}
    return {
        tab: sum(by_status.values())
        if statuses is None
        else sum(by_status.get(status, 0) for status in statuses)
        for tab, statuses in TABS.items()
    }


def interval_label(interval: DeliveryInterval | None) -> str:
    """«09-12» → «09:00–12:00»; без интервала — пусто."""
    if interval is None:
        return ""
    start, end = interval.value.split("-")
    return f"{start}:00–{end}:00"
