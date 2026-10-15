"""Срок изготовления и дата получения заказа.

«Готовим за три дня» — обещание покупателю. Заказ, который физически нельзя
выполнить к названной дате, не должен приниматься: иначе провал случится
в день праздника, а не в момент оформления.
"""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.core import clock
from app.core.clock import local_today

MOSCOW = ZoneInfo("Europe/Moscow")

ORDER = {
    "customer_name": "Марина",
    "customer_phone": "+7 900 123-45-67",
    "customer_email": "marina@example.ru",
    "delivery_method": "pickup",
    "consent_pd": True,
    # Дата и окно обязательны (007b): по умолчанию — через 5 дней, подходит и витрине
    # «сегодня», и тортам под заказ за 3 дня
    "desired_date": (
        datetime.now(ZoneInfo("Europe/Moscow")).date() + timedelta(days=5)
    ).isoformat(),
    "delivery_interval": "12-15",
}


@pytest.fixture(autouse=True)
def _midday(monkeypatch) -> None:
    """10:00 по Москве: окна сегодняшнего дня ещё открыты. Без этого тесты
    зависели бы от того, в котором часу их запустили (вечером окон на сегодня нет)."""
    today = datetime.now(MOSCOW).date()
    monkeypatch.setattr(clock, "local_now", lambda: datetime.combine(today, time(10), MOSCOW))


async def _fill_cart(client, variant_id: int) -> dict:
    response = await client.post("/api/v1/cart/items", json={"variant_id": variant_id})
    assert response.status_code == 201, response.text
    return response.json()


async def test_cart_reports_earliest_date(client, catalog) -> None:
    cart = await _fill_cart(client, catalog.variants["gf-cookie"])
    assert cart["earliest_date"] == local_today().isoformat()

    cart = await _fill_cart(client, catalog.variants["kids-cake"])
    # Решает самая долгая позиция в корзине
    assert cart["earliest_date"] == (local_today() + timedelta(days=3)).isoformat()


async def test_preorder_date_too_early_reports_earliest(client, catalog) -> None:
    await _fill_cart(client, catalog.variants["kids-cake"])

    response = await client.post(
        "/api/v1/orders", json=ORDER | {"desired_date": local_today().isoformat()}
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["earliest_date"] == (local_today() + timedelta(days=3)).isoformat()


async def test_date_before_lead_time_is_rejected(client, catalog) -> None:
    await _fill_cart(client, catalog.variants["kids-cake"])
    too_early = (local_today() + timedelta(days=1)).isoformat()

    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": too_early})

    assert response.status_code == 422


async def test_order_with_valid_date_and_interval(client, catalog) -> None:
    await _fill_cart(client, catalog.variants["kids-cake"])
    date = (local_today() + timedelta(days=3)).isoformat()

    response = await client.post(
        "/api/v1/orders", json=ORDER | {"desired_date": date, "delivery_interval": "12-15"}
    )
    assert response.status_code == 201, response.text

    created = response.json()
    # Страница заказа — только с токеном из ответа оформления (007a)
    order = (
        await client.get(
            f"/api/v1/orders/{created['order_number']}", params={"t": created["token"]}
        )
    ).json()
    assert order["desired_date"] == date
    assert order["delivery_interval"] == "12-15"


async def test_date_and_window_are_required_even_for_ready_today(client, catalog) -> None:
    """007b: кондитеру нужно знать, когда человек придёт, — даже если всё «сегодня»."""
    await _fill_cart(client, catalog.variants["gf-cookie"])

    for missing in ("desired_date", "delivery_interval"):
        body = {key: value for key, value in ORDER.items() if key != missing}
        response = await client.post("/api/v1/orders", json=body)
        assert response.status_code == 422, missing
        assert missing in response.text

    today = {"desired_date": local_today().isoformat(), "delivery_interval": "15-18"}
    response = await client.post("/api/v1/orders", json=ORDER | today)
    assert response.status_code == 201, response.text


async def test_unknown_interval_is_rejected(client, catalog) -> None:
    await _fill_cart(client, catalog.variants["gf-cookie"])

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
    await _fill_cart(client, catalog.variants["gf-cookie"])

    response = await client.post("/api/v1/orders", json=ORDER)

    assert response.status_code == 201, response.text
    assert response.json()["order_number"].startswith("20260115-")
