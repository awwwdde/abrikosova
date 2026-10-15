"""Главная админки, счётчики, поиск и роли (задание 011b).

Время подменяется на март 2031 года: в общей тестовой базе лежат заказы
разработки, а в 2031-м их нет — агрегаты за «неделю» считаются только по заказам
этого файла.
"""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import delete

from app.core import clock
from app.core.db import SessionLocal
from app.models import (
    ConsultationRequest,
    Order,
    Review,
)
from app.models.enums import (
    ConsultationSource,
    DeliveryInterval,
    DeliveryMethod,
    Occasion,
    OrderStatus,
)
from app.services import dashboard

MSK = ZoneInfo("Europe/Moscow")
TODAY = date(2031, 3, 12)  # среда


def msk(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=MSK)


@pytest.fixture
def frozen(monkeypatch) -> datetime:
    """«Сейчас» — 12 марта 2031, 12:00 по Москве."""
    now = msk(TODAY, 12)
    monkeypatch.setattr(clock, "local_now", lambda: now)
    monkeypatch.setattr(dashboard, "local_now", lambda: now)
    return now


class Orders:
    """Создаёт заказы с позициями; уборку делает фикстура catalog (заказы держат товары)."""

    def __init__(self, catalog) -> None:
        self.catalog = catalog
        self.numbers: list[str] = []

    async def add(
        self,
        *,
        created: datetime,
        total: str = "1000",
        status: OrderStatus = OrderStatus.CONFIRMED,
        phone: str = "+7 (900) 000-00-00",
        name: str = "Тест Клиент",
        desired: date | None = None,
        interval: DeliveryInterval | None = None,
        items: dict[str, int] | None = None,
    ) -> Order:
        number = f"T{uuid.uuid4().hex[:12]}"
        async with SessionLocal() as session:
            order = Order(
                order_number=number,
                customer_name=name,
                customer_phone=phone,
                delivery_method=DeliveryMethod.PICKUP,
                consent_pd=True,
                subtotal=Decimal(total),
                total_price=Decimal(total),
                status=status,
                desired_date=desired,
                delivery_interval=interval,
                created_at=created,
            )
            for slug, quantity in (items or {"gf-cookie": 1}).items():
                order.items.append(self.catalog.order_item(slug, quantity, "100"))
            session.add(order)
            await session.commit()
            await session.refresh(order)
        self.numbers.append(number)
        return order


@pytest.fixture
def orders(catalog) -> Orders:
    return Orders(catalog)


async def test_day_boundaries_follow_business_timezone(
    client, admin_headers, orders, monkeypatch
) -> None:
    """23:30 по Москве — ещё этот день, 00:30 — уже следующий, хотя в UTC оба
    момента приходятся на один и тот же вечер (20:30 и 21:30 UTC)."""
    late = await orders.add(created=msk(TODAY, 23, 30))
    after_midnight = await orders.add(created=msk(TODAY + timedelta(days=1), 0, 30))
    assert late.created_at.date() == after_midnight.created_at.astimezone(ZoneInfo("UTC")).date()

    async with SessionLocal() as session:
        today = await dashboard._period_numbers(session, TODAY, TODAY)
        tomorrow = await dashboard._period_numbers(
            session, TODAY + timedelta(days=1), TODAY + timedelta(days=1)
        )
    assert today["orders"] == 1
    assert tomorrow["orders"] == 1

    # Старая сводка тоже считает «сегодня» от полуночи по Москве: в 01:00 следующего
    # дня сегодняшний заказ — только тот, что после полуночи
    night = msk(TODAY + timedelta(days=1), 1)
    monkeypatch.setattr(clock, "local_now", lambda: night)
    response = await client.get("/api/v1/admin", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["orders_today"] == 1


async def test_dashboard_aggregates(client, admin_headers, orders, catalog, frozen) -> None:
    previous_week = TODAY - timedelta(days=9)
    # Неделя: два заказа и отмена; прошлая неделя — один заказ того же клиента
    await orders.add(
        created=msk(previous_week, 10),
        total="2000",
        phone="8 900 111-22-33",
        items={"gf-cookie": 1},
    )
    await orders.add(
        created=msk(TODAY - timedelta(days=1), 15),
        total="3000",
        phone="+7 (900) 111-22-33",  # тот же телефон в другом формате — не новый клиент
        desired=TODAY,
        interval=DeliveryInterval.I_15_18,
        items={"kids-cake": 1, "gf-cookie": 2},
    )
    first_time = await orders.add(
        created=msk(TODAY, 9),
        total="12000",
        phone="+7 900 444-55-66",
        name="Мария Смирнова",
        desired=TODAY + timedelta(days=2),
        items={"kids-cake": 3},
    )
    await orders.add(
        created=msk(TODAY, 10),
        total="5000",
        status=OrderStatus.CANCELLED,
        desired=TODAY,
        items={"gift-box": 4},
    )
    morning = await orders.add(
        created=msk(TODAY, 11),
        total="900",
        desired=TODAY,
        interval=DeliveryInterval.I_09_12,
        items={"gf-cookie": 1},
    )
    async with SessionLocal() as session:
        wedding = ConsultationRequest(
            name="Ирина Тест",
            phone="+7 900 777-88-99",
            consent_pd=True,
            source=ConsultationSource.CUSTOM_CAKE,
            occasion=Occasion.WEDDING,
            event_date=TODAY + timedelta(days=3),
            guests_count=60,
        )
        review = Review(author_name="Анна Тест", text="Очень вкусно", rating=5)
        session.add_all([wedding, review])
        await session.commit()
        cleanup = (wedding.id, review.id)

    try:
        response = await client.get("/api/v1/admin/dashboard", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["today"] == TODAY.isoformat()

        revenue = data["revenue"]
        assert revenue["period_start"] == (TODAY - timedelta(days=6)).isoformat()
        assert Decimal(revenue["total"]) == Decimal("15900")
        assert revenue["orders"] == 3
        assert Decimal(revenue["average"]) == Decimal("5300")
        assert revenue["cancelled"] == 1
        assert Decimal(revenue["previous_total"]) == Decimal("2000")
        assert revenue["previous_orders"] == 1
        # Новые за неделю: Мария и клиент отменённого/утреннего заказа (общий телефон);
        # «8 900 111-22-33» и «+7 (900) 111-22-33» — один клиент из прошлой недели
        assert revenue["new_customers"] == 2

        by_day = data["orders_by_day"]
        assert len(by_day["days"]) == 14
        assert by_day["days"][-1] == {"day": TODAY.isoformat(), "count": 2}
        assert by_day["today"] == 2  # отменённый не считается
        upcoming = {item["day"]: item for item in by_day["upcoming"]}
        assert upcoming[(TODAY + timedelta(days=2)).isoformat()]["has_large"] is True
        assert upcoming[(TODAY + timedelta(days=3)).isoformat()]["has_wedding"] is True

        # Что заказывают: по количеству позиций, отменённые не входят
        week = {item["name"]: item["items"] for item in data["categories"]["week"]}
        category = next(iter(week))
        assert week[category] == 1 + 2 + 3 + 1

        plan = data["plan"]["today"]
        assert [item["order_number"] for item in plan] == [
            morning.order_number,
            orders.numbers[1],
        ]
        assert plan[1]["items"] == "kids-cake, gf-cookie ×2"

        popular = data["popular"]
        assert [(p["name"], p["sold"]) for p in popular[:2]] == [
            ("kids-cake", 4),
            ("gf-cookie", 3),
        ]
        assert all(p["name"] != "gift-box" for p in popular)

        calendar = data["calendar"]
        assert calendar["month"] == "2031-03"
        assert {"day": TODAY.isoformat(), "count": 2} in calendar["days"]
        labels = [event["label"] for event in calendar["large"]]
        assert labels[0].startswith(f"Заказ № {first_time.order_number}")
        assert labels[1] == "Свадьба, 60 гостей"

        assert any(c["id"] == cleanup[0] for c in data["consultations"]["items"])
        assert any(r["id"] == cleanup[1] for r in data["reviews"])
        assert data["counters"]["reviews_unpublished"] >= 1

        # Другой месяц календаря — отдельным запросом
        april = await client.get(
            "/api/v1/admin/dashboard/calendar", params={"month": "2031-04"}, headers=admin_headers
        )
        assert april.json()["month"] == "2031-04"
        assert april.json()["days"] == []
    finally:
        async with SessionLocal() as session:
            await session.execute(
                delete(ConsultationRequest).where(ConsultationRequest.id == cleanup[0])
            )
            await session.execute(delete(Review).where(Review.id == cleanup[1]))
            await session.commit()


async def test_week_report_csv_has_no_phones(client, admin_headers, orders, frozen) -> None:
    order = await orders.add(
        created=msk(TODAY, 9), total="2500", phone="+7 900 123-45-67", name="Ольга Тестова"
    )
    response = await client.get("/api/v1/admin/dashboard/report.csv", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    body = response.content.decode("utf-8-sig")
    assert body.splitlines()[0] == "Номер;Оформлен;Клиент;Сумма, ₽;Статус"
    assert f"{order.order_number};12.03.2031 09:00;Ольга Тестова;2500.00;Подтверждён" in body
    assert "123-45-67" not in body and "1234567" not in body

    popular = await client.get("/api/v1/admin/dashboard/popular.csv", headers=admin_headers)
    assert popular.status_code == 200
    assert "gf-cookie" in popular.content.decode("utf-8-sig")


async def test_search_by_number_name_and_phone_digits(
    client, admin_headers, orders, catalog
) -> None:
    order = await orders.add(
        created=msk(TODAY, 9), phone="+7 (916) 555-12-34", name="Зинаида Поисковая"
    )

    async def found(q: str) -> list[str]:
        response = await client.get("/api/v1/admin/search", params={"q": q}, headers=admin_headers)
        assert response.status_code == 200
        return [o["order_number"] for o in response.json()["orders"]]

    assert order.order_number in await found(order.order_number)
    assert order.order_number in await found("зинаида поиск")
    assert order.order_number in await found("5551234")
    assert order.order_number in await found("8 916 555-12-34")
    assert order.order_number in await found("916 555 12")
    assert order.order_number not in await found("5559999")

    products = await client.get(
        "/api/v1/admin/search", params={"q": "kids-ca"}, headers=admin_headers
    )
    assert any(p["id"] == catalog.products["kids-cake"] for p in products.json()["products"])

    too_short = await client.get("/api/v1/admin/search", params={"q": "a"}, headers=admin_headers)
    assert too_short.status_code == 422

    # % в запросе — обычный символ, а не «любая строка»
    assert await found("%%") == []


async def test_manager_sees_dashboard_but_not_owner_sections(client, manager_headers) -> None:
    for path in ("/api/v1/admin/dashboard", "/api/v1/admin/counters"):
        assert (await client.get(path, headers=manager_headers)).status_code == 200
    search = await client.get("/api/v1/admin/search", params={"q": "торт"}, headers=manager_headers)
    assert search.status_code == 200
    for path in ("/api/v1/admin/users", "/api/v1/admin/backups"):
        assert (await client.get(path, headers=manager_headers)).status_code == 403


async def test_dashboard_requires_login(client) -> None:
    for path in ("/api/v1/admin/dashboard", "/api/v1/admin/counters", "/api/v1/admin/search?q=ab"):
        assert (await client.get(path)).status_code == 401


async def test_clock_reports_business_timezone(client, admin_headers) -> None:
    """011g: пояс кондитерской отдаётся админке — даты в ней не зависят от пояса браузера."""
    from app.core.config import get_settings

    response = await client.get("/api/v1/admin/clock", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["timezone"] == get_settings().business_timezone
