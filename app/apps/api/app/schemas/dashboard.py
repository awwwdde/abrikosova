"""Главная админки (задание 011b): сводка одним запросом, счётчики меню, поиск.

Деньги — Decimal (в JSON строкой, как везде в API), доли — целые проценты.
Все «сегодня» и «неделя» считаются в часовом поясе кондитерской.
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import (
    ConsultationStatus,
    DeliveryInterval,
    DeliveryMethod,
    Occasion,
    OrderStatus,
)


class BusinessClock(BaseModel):
    today: date
    now: datetime
    # IANA-имя пояса кондитерской (011g): админка форматирует даты в нём, а не в
    # поясе браузера и не в зашитой на фронтенде константе
    timezone: str


class Counters(BaseModel):
    """Счётчики меню и колокольчика: то, что ждёт реакции."""

    orders_new: int
    consultations_new: int
    reviews_unpublished: int


class Revenue(BaseModel):
    """Выручка и показатели за 7 дней против предыдущих 7."""

    period_start: date
    period_end: date
    total: Decimal
    previous_total: Decimal
    orders: int
    previous_orders: int
    average: Decimal
    previous_average: Decimal
    cancelled: int
    previous_cancelled: int
    new_customers: int
    previous_new_customers: int


class DayCount(BaseModel):
    day: date
    count: int


class UpcomingDay(BaseModel):
    day: date
    count: int
    # «Свадьба» / «крупный заказ» — чтобы заранее видеть тяжёлые дни
    has_wedding: bool
    has_large: bool


class OrdersByDay(BaseModel):
    """Заказы к выдаче по желаемой дате."""

    days: list[DayCount]  # 14 дней, последний — сегодня
    today: int
    yesterday: int
    upcoming: list[UpcomingDay]  # ближайшие 3 дня после сегодня


class CategoryShare(BaseModel):
    name: str
    items: int


class CategoryShares(BaseModel):
    week: list[CategoryShare]
    month: list[CategoryShare]


class PlanItem(BaseModel):
    id: int
    order_number: str
    customer_name: str
    items: str
    delivery_method: DeliveryMethod
    delivery_interval: DeliveryInterval | None
    status: OrderStatus


class Plan(BaseModel):
    today: list[PlanItem]
    tomorrow: list[PlanItem]


class ConsultationBrief(BaseModel):
    id: int
    name: str
    occasion: Occasion | None
    event_date: date | None
    guests_count: int | None
    status: ConsultationStatus
    created_at: datetime


class Consultations(BaseModel):
    items: list[ConsultationBrief]
    more: int


class PopularProduct(BaseModel):
    id: int
    name: str
    slug: str
    category: str
    subcategory: str
    image_key: str | None
    sold: int
    is_active: bool
    is_available: bool
    lead_time_days: int


class LargeEvent(BaseModel):
    """Крупное событие для календаря: заявка (свадьба, много гостей) или большой заказ."""

    day: date
    label: str
    href: str


class Calendar(BaseModel):
    month: str  # YYYY-MM
    days: list[DayCount]  # только дни, где есть заказы
    large: list[LargeEvent]


class ActivityItem(BaseModel):
    id: int
    # «Ольга Т.», «Сайт»; роль — только у менеджеров («(менеджер)» в ленте)
    actor: str
    actor_role: str | None
    is_you: bool
    is_site: bool = False
    at: datetime
    text: str
    # Для событий входа: «Chrome на Windows, IP 10.0.0.1»
    meta: str | None = None


class ReviewBrief(BaseModel):
    id: int
    author_name: str
    rating: int | None
    text: str
    created_at: datetime


class Dashboard(BaseModel):
    today: date
    now: datetime
    counters: Counters
    revenue: Revenue
    orders_by_day: OrdersByDay
    categories: CategoryShares
    plan: Plan
    consultations: Consultations
    popular: list[PopularProduct]
    calendar: Calendar
    activity: list[ActivityItem]
    reviews: list[ReviewBrief]


class SearchOrder(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_phone: str


class SearchProduct(BaseModel):
    id: int
    name: str


class SearchConsultation(BaseModel):
    id: int
    name: str
    phone: str


class SearchResults(BaseModel):
    orders: list[SearchOrder]
    products: list[SearchProduct]
    consultations: list[SearchConsultation]
