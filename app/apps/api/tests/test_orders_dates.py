"""Срок изготовления и дата получения заказа.

«Готовим за три дня» — обещание покупателю. Заказ, который физически нельзя
выполнить к названной дате, не должен приниматься: иначе провал случится
в день праздника, а не в момент оформления.
"""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core import clock
from app.core.clock import local_today

ORDER = {
    "customer_name": "Марина",
    "customer_phone": "+7 900 123-45-67",
    "delivery_method": "pickup",
    "consent_pd": True,
}


async def _fill_cart(client, product_id: int) -> dict:
    response = await client.post("/api/v1/cart/items", json={"product_id": product_id})
    assert response.status_code == 201, response.text
    return response.json()


async def test_cart_reports_earliest_date(client, catalog) -> None:
    cart = await _fill_cart(client, catalog.products["gf-cookie"])
    assert cart["earliest_date"] == local_today().isoformat()

    cart = await _fill_cart(client, catalog.products["kids-cake"])
    # Решает самая долгая позиция в корзине
    assert cart["earliest_date"] == (local_today() + timedelta(days=3)).isoformat()


async def test_preorder_requires_date(client, catalog) -> None:
    await _fill_cart(client, catalog.products["kids-cake"])

    response = await client.post("/api/v1/orders", json=ORDER)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["earliest_date"] == (local_today() + timedelta(days=3)).isoformat()


async def test_date_before_lead_time_is_rejected(client, catalog) -> None:
    await _fill_cart(client, catalog.products["kids-cake"])
    too_early = (local_today() + timedelta(days=1)).isoformat()

    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": too_early})

    assert response.status_code == 422


async def test_order_with_valid_date_and_interval(client, catalog) -> None:
    await _fill_cart(client, catalog.products["kids-cake"])
    date = (local_today() + timedelta(days=3)).isoformat()

    response = await client.post(
        "/api/v1/orders", json=ORDER | {"desired_date": date, "delivery_interval": "12-15"}
    )
    assert response.status_code == 201, response.text

    order = (await client.get(f"/api/v1/orders/{response.json()['order_number']}")).json()
    assert order["desired_date"] == date
    assert order["delivery_interval"] == "12-15"


async def test_ready_today_item_needs_no_date(client, catalog) -> None:
    await _fill_cart(client, catalog.products["gf-cookie"])

    response = await client.post("/api/v1/orders", json=ORDER)

    assert response.status_code == 201, response.text


async def test_unknown_interval_is_rejected(client, catalog) -> None:
    await _fill_cart(client, catalog.products["gf-cookie"])

    response = await client.post("/api/v1/orders", json=ORDER | {"delivery_interval": "00-24"})

    assert response.status_code == 422


async def test_order_number_uses_business_date_after_midnight(client, catalog, monkeypatch) -> None:
    """00:30 по Москве — это ещё 21:30 предыдущего дня по UTC.

    Номер заказа должен нести московскую дату: по ней Елена ищет заказ
    «оформленный сегодня ночью», и UTC-дата сбивала бы на сутки.
    """
    msk_night = datetime(2026, 1, 15, 0, 30, tzinfo=ZoneInfo("Europe/Moscow"))
    assert msk_night.astimezone(UTC).date().isoformat() == "2026-01-14"
    monkeypatch.setattr(clock, "local_now", lambda: msk_night)
    await _fill_cart(client, catalog.products["gf-cookie"])

    response = await client.post("/api/v1/orders", json=ORDER)

    assert response.status_code == 201, response.text
    assert response.json()["order_number"].startswith("20260115-")
