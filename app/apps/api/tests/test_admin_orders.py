"""Раздел «Заказы» и фото товара в админке (задание 011d)."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.core import clock
from app.core.db import SessionLocal
from app.models import AuditLogEntry, Order, ProductImage
from app.models.enums import DeliveryInterval, DeliveryMethod, OrderStatus
from app.services import dashboard

MSK = ZoneInfo("Europe/Moscow")
NBSP = " "


async def _order(
    catalog,
    *,
    status: OrderStatus = OrderStatus.NEW,
    desired: date | None = None,
    method: DeliveryMethod = DeliveryMethod.PICKUP,
    phone: str = "+7 (916) 555-12-34",
    name: str = "Зоя Заказова",
) -> Order:
    async with SessionLocal() as session:
        order = Order(
            order_number=f"T{uuid.uuid4().hex[:12].upper()}",
            customer_name=name,
            customer_phone=phone,
            delivery_method=method,
            delivery_address="Москва, Гжатская, 21" if method is DeliveryMethod.DELIVERY else None,
            consent_pd=True,
            subtotal=Decimal("1200"),
            total_price=Decimal("1200"),
            status=status,
            desired_date=desired,
            delivery_interval=DeliveryInterval.I_12_15,
        )
        order.items.append(catalog.order_item("gf-cookie", 2, "600"))
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order


async def _set_status(client, headers, order_id: int, status: str, **extra):
    return await client.patch(
        f"/api/v1/admin/orders/{order_id}", json={"status": status, **extra}, headers=headers
    )


# --- Переходы статусов ---


async def test_status_moves_forward_and_final_states_are_locked(
    client, admin_headers, catalog
) -> None:
    order = await _order(catalog)
    for status in ("confirmed", "in_progress", "ready", "completed"):
        response = await _set_status(client, admin_headers, order.id, status)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == status
        assert response.json()["items_summary"] == "gf-cookie ×2"

    # Из «Выдан» хода нет — ни назад, ни в отмену
    for status in ("new", "cancelled"):
        response = await _set_status(client, admin_headers, order.id, status)
        assert response.status_code == 409
        assert "выдан" in response.json()["detail"]


async def test_cancel_keeps_reason_in_order_but_not_in_journal(
    client, admin_headers, catalog
) -> None:
    order = await _order(catalog)
    response = await _set_status(
        client, admin_headers, order.id, "cancelled", reason="  Клиент перенёс праздник  "
    )
    assert response.status_code == 200, response.text

    detail = (await client.get(f"/api/v1/admin/orders/{order.id}", headers=admin_headers)).json()
    assert detail["status"] == "cancelled"
    assert detail["cancel_reason"] == "Клиент перенёс праздник"

    async with SessionLocal() as session:
        entry = await session.scalar(
            select(AuditLogEntry).where(
                AuditLogEntry.entity == "order",
                AuditLogEntry.entity_id == str(order.id),
                AuditLogEntry.action == "update_status",
            )
        )
    assert entry.details == {"status": "cancelled"}

    response = await _set_status(client, admin_headers, order.id, "confirmed")
    assert response.status_code == 409
    assert "отменён" in response.json()["detail"]


# --- Просмотр карточки в журнале ---


async def test_viewing_order_is_audited_but_hidden_from_dashboard_feed(
    client, admin_headers, catalog
) -> None:
    order = await _order(catalog)
    response = await client.get(f"/api/v1/admin/orders/{order.id}", headers=admin_headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["customer_phone"] == "+7 (916) 555-12-34"
    assert detail["items"][0]["name"] == "gf-cookie"
    assert detail["items"][0]["line_total"] == "1200.00"

    async with SessionLocal() as session:
        views = (
            await session.scalars(
                select(AuditLogEntry).where(
                    AuditLogEntry.entity == "order",
                    AuditLogEntry.entity_id == str(order.id),
                    AuditLogEntry.action == "view",
                )
            )
        ).all()
    assert len(views) == 1

    feed = (await client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()["activity"]
    assert not any("просмотрен" in item["text"] for item in feed)

    journal = (
        await client.get("/api/v1/admin/journal", params={"kind": "orders"}, headers=admin_headers)
    ).json()
    assert any(
        item["text"] == f"просмотрен заказ №{NBSP}{order.order_number}" for item in journal["items"]
    )


# --- Фильтры по дате получения ---


@pytest.fixture
def after_midnight(monkeypatch) -> date:
    """«Сейчас» — 00:30 по Москве 15 мая 2031: в UTC это ещё 14 мая."""
    now = datetime(2031, 5, 15, 0, 30, tzinfo=MSK)
    monkeypatch.setattr(clock, "local_now", lambda: now)
    monkeypatch.setattr(dashboard, "local_now", lambda: now)
    return now.date()


async def test_date_filters_use_business_day(client, admin_headers, catalog, after_midnight):
    today = after_midnight
    today_order = await _order(catalog, desired=today)
    yesterday_order = await _order(catalog, desired=today - timedelta(days=1))
    tomorrow_order = await _order(catalog, desired=today + timedelta(days=1), status="confirmed")
    week_order = await _order(
        catalog, desired=today + timedelta(days=6), method=DeliveryMethod.DELIVERY
    )

    async def numbers(**params) -> set[str]:
        response = await client.get("/api/v1/admin/orders", params=params, headers=admin_headers)
        assert response.status_code == 200, response.text
        return {item["order_number"] for item in response.json()["items"]}

    assert await numbers(period="today") == {today_order.order_number}
    assert await numbers(period="tomorrow") == {tomorrow_order.order_number}
    week = await numbers(period="week", page_size=100)
    assert {today_order.order_number, tomorrow_order.order_number, week_order.order_number} <= week
    assert yesterday_order.order_number not in week
    assert await numbers(period="week", method="delivery") == {week_order.order_number}
    custom = await numbers(
        date_from=(today - timedelta(days=1)).isoformat(), date_to=today.isoformat()
    )
    assert custom == {today_order.order_number, yesterday_order.order_number}

    # Счётчики вкладок — с теми же фильтрами даты
    data = (
        await client.get(
            "/api/v1/admin/orders", params={"period": "week", "tab": "work"}, headers=admin_headers
        )
    ).json()
    assert [item["order_number"] for item in data["items"]] == [tomorrow_order.order_number]
    assert data["counts"]["work"] == 1
    assert data["counts"]["new"] == 2
    assert data["counts"]["all"] == 3


async def test_export_has_selection_but_no_phones(client, admin_headers, catalog, after_midnight):
    order = await _order(catalog, desired=after_midnight, phone="+7 (999) 111-22-33")
    response = await client.get(
        "/api/v1/admin/orders/export.csv", params={"period": "today"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    body = response.content.decode("utf-8-sig")
    assert body.splitlines()[0] == (
        "Номер;Оформлен;Получение;Время;Способ;Клиент;Состав;Сумма, ₽;Статус"
    )
    line = next(row for row in body.splitlines() if row.startswith(order.order_number))
    assert "15.05.2031;12:00–15:00;Самовывоз;Зоя Заказова;gf-cookie ×2;1200.00;Новый" in line
    assert "111-22-33" not in body and "1112233" not in body


# --- Порядок фото товара ---


async def test_reorder_product_images(client, admin_headers, catalog) -> None:
    product_id = catalog.products["kids-cake"]
    async with SessionLocal() as session:
        images = [
            ProductImage(product_id=product_id, storage_key=f"products/t-{i}.webp", order=i)
            for i in range(3)
        ]
        session.add_all(images)
        await session.commit()
        ids = [image.id for image in images]

    reordered = [ids[2], ids[0], ids[1]]
    response = await client.put(
        f"/api/v1/admin/products/{product_id}/images/order",
        json={"ids": reordered},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert [image["id"] for image in response.json()] == reordered

    stale = await client.put(
        f"/api/v1/admin/products/{product_id}/images/order",
        json={"ids": reordered[:2]},
        headers=admin_headers,
    )
    assert stale.status_code == 409
