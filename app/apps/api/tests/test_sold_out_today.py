"""«Закончилось сегодня» и надпись до 24 знаков (006b).

Закончившийся сегодня товар продаётся «под заказ на завтра»: одна правда о сроке —
карточка, фасет «Срок», корзина (`earliest_date`) и проверка даты заказа. В полночь
по Москве он сам снова «в наличии» — проверяем подменой `clock.local_now`.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select, update

from app.core import clock
from app.core.clock import local_today
from app.core.db import SessionLocal
from app.models import AuditLogEntry, CartItem, Product
from app.services import journal

MOSCOW = ZoneInfo("Europe/Moscow")
TODAY = datetime.now(MOSCOW).date()

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


def _at(monkeypatch, day, hour: int, minute: int = 0) -> None:
    moment = datetime.combine(day, time(hour, minute), MOSCOW)
    monkeypatch.setattr(clock, "local_now", lambda: moment)


@pytest.fixture(autouse=True)
def _midday(monkeypatch) -> None:
    """10:00 по Москве: окна сегодняшнего дня ещё открыты (как в test_orders_dates)."""
    _at(monkeypatch, TODAY, 10)


async def _slug(product_id: int) -> str:
    async with SessionLocal() as session:
        return await session.scalar(select(Product.slug).where(Product.id == product_id))


async def _sold_out(product_id: int, day) -> None:
    async with SessionLocal() as session:
        await session.execute(
            update(Product).where(Product.id == product_id).values(sold_out_on=day)
        )
        await session.commit()


async def test_sold_out_today_is_preorder_for_tomorrow(client, catalog) -> None:
    cookie = catalog.products["gf-cookie"]
    slug = await _slug(cookie)
    await _sold_out(cookie, TODAY)

    card = (await client.get(f"/api/v1/catalog/products/{slug}")).json()
    assert card["sold_out_today"] is True
    assert card["lead_time_days"] == 1
    assert card["nearest_slot"]["date"] == (TODAY + timedelta(days=1)).isoformat()
    assert card["is_available"] is True  # не «нет в наличии»: заказать можно

    # Фасет «Срок»: уже не «готово сегодня», а «под заказ»
    params = {"category": catalog.category_slug, "page_size": 60}
    today = (
        await client.get("/api/v1/catalog/products", params=params | {"availability": "today"})
    ).json()
    preorder = (
        await client.get("/api/v1/catalog/products", params=params | {"availability": "preorder"})
    ).json()
    assert slug not in {item["slug"] for item in today["items"]}
    item = next(item for item in preorder["items"] if item["slug"] == slug)
    assert (item["sold_out_today"], item["lead_time_days"]) == (True, 1)

    # Корзина: срок строки «завтра» и earliest_date — завтра
    cart = (
        await client.post("/api/v1/cart/items", json={"variant_id": catalog.variants["gf-cookie"]})
    ).json()
    assert cart["items"][0]["lead_time_days"] == 1
    assert cart["earliest_date"] == (TODAY + timedelta(days=1)).isoformat()

    # Заказ на сегодня не принимается, на завтра — да
    too_early = await client.post(
        "/api/v1/orders", json=ORDER | {"desired_date": TODAY.isoformat()}
    )
    assert too_early.status_code == 422
    assert too_early.json()["detail"]["earliest_date"] == (TODAY + timedelta(days=1)).isoformat()
    tomorrow = (TODAY + timedelta(days=1)).isoformat()
    ok = await client.post("/api/v1/orders", json=ORDER | {"desired_date": tomorrow})
    assert ok.status_code == 201, ok.text


async def test_sold_out_resets_at_midnight(client, catalog, monkeypatch) -> None:
    cookie = catalog.products["gf-cookie"]
    slug = await _slug(cookie)
    await _sold_out(cookie, TODAY)

    _at(monkeypatch, TODAY, 23, 59)
    card = (await client.get(f"/api/v1/catalog/products/{slug}")).json()
    assert (card["sold_out_today"], card["lead_time_days"]) == (True, 1)

    # 00:00 следующего дня по Москве — снова в наличии, без ночной задачи
    _at(monkeypatch, TODAY + timedelta(days=1), 0, 0)
    assert local_today() == TODAY + timedelta(days=1)
    card = (await client.get(f"/api/v1/catalog/products/{slug}")).json()
    assert (card["sold_out_today"], card["lead_time_days"]) == (False, 0)
    listed = (
        await client.get(
            "/api/v1/catalog/products",
            params={"category": catalog.category_slug, "availability": "today"},
        )
    ).json()
    assert slug in {item["slug"] for item in listed["items"]}


async def test_sold_out_keeps_longer_lead_time(client, catalog) -> None:
    """Под заказ за 3 дня и «закончилось» — срок остаётся 3 дня, а не 1."""
    cake = catalog.products["kids-cake"]
    await _sold_out(cake, TODAY)
    card = (await client.get(f"/api/v1/catalog/products/{await _slug(cake)}")).json()
    assert card["lead_time_days"] == 3


async def test_admin_bulk_sold_out_and_journal(client, admin_headers, catalog) -> None:
    cookie = catalog.products["gf-cookie"]
    response = await client.post(
        "/api/v1/admin/products/bulk",
        json={"ids": [cookie], "action": "sold_out"},
        headers=admin_headers,
    )
    assert response.json() == {"updated": 1}
    async with SessionLocal() as session:
        product = await session.get(Product, cookie)
        assert product.sold_out_on == TODAY
        entry = await session.scalar(
            select(AuditLogEntry)
            .where(AuditLogEntry.entity == "product", AuditLogEntry.entity_id == str(cookie))
            .order_by(AuditLogEntry.id.desc())
        )
    assert entry.details == {"changes": {"sold_out_today": [False, True]}}
    assert journal.describe(entry, {"product": {str(cookie): "Наполеон"}}) == (
        "«Наполеон»: закончился сегодня"
    )

    # Карточка товара в админке: тот же переключатель, «снова в наличии»
    admin = (await client.get(f"/api/v1/admin/products/{cookie}", headers=admin_headers)).json()
    assert admin["sold_out_today"] is True
    back = await client.post(
        "/api/v1/admin/products/bulk",
        json={"ids": [cookie], "action": "back_in_stock"},
        headers=admin_headers,
    )
    assert back.json() == {"updated": 1}
    admin = (await client.get(f"/api/v1/admin/products/{cookie}", headers=admin_headers)).json()
    assert admin["sold_out_today"] is False


async def test_inscription_limit_24(client, catalog) -> None:
    cake = catalog.variants["kids-cake"]
    ok = await client.post(
        "/api/v1/cart/items", json={"variant_id": cake, "inscription_text": "х" * 24}
    )
    assert ok.status_code == 201, ok.text
    too_long = await client.post(
        "/api/v1/cart/items", json={"variant_id": cake, "inscription_text": "х" * 25}
    )
    assert too_long.status_code == 422

    # Строка, положенная до смены лимита (30 знаков), в базе остаётся,
    # но заказ с ней не оформить — кондитер получил бы надпись, которая не влезет
    cart_id = client.cookies.get("cart_id")
    async with SessionLocal() as session:
        await session.execute(
            update(CartItem)
            .where(CartItem.cart_id == cart_id, CartItem.variant_id == cake)
            .values(inscription_text="х" * 30)
        )
        await session.commit()
    date = (local_today() + timedelta(days=3)).isoformat()
    order = await client.post("/api/v1/orders", json=ORDER | {"desired_date": date})
    assert order.status_code == 422
    assert "не больше 24" in order.json()["detail"]


async def test_midnight_refreshes_pages_of_yesterdays_sold_out(catalog, monkeypatch) -> None:
    """00:00 (007a): кэш страниц товаров, закончившихся вчера, сбрасывается сразу."""
    from app.core import scheduler
    from app.services import revalidate

    cookie = catalog.products["gf-cookie"]
    cake = catalog.products["kids-cake"]
    await _sold_out(cookie, TODAY)  # закончился «сегодня»…
    await _sold_out(cake, TODAY - timedelta(days=1))  # …и «позавчера» для завтрашней полуночи
    called: list[list[str]] = []
    monkeypatch.setattr(
        revalidate, "revalidate_paths", lambda paths, tags=None: called.append(paths)
    )

    # Наступила полночь следующего дня: вчера = TODAY
    _at(monkeypatch, TODAY + timedelta(days=1), 0, 0)
    paths = await scheduler.refresh_sold_out_pages()

    assert f"/product/{await _slug(cookie)}" in paths
    assert f"/product/{await _slug(cake)}" not in paths
    assert {"/", "/catalog"} <= set(paths)
    assert called == [paths]
