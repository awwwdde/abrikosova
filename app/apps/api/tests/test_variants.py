"""Варианты товара, надпись на табличке и окно выдачи (задание 005a).

* корзина: строка — вариант + надпись, у них своя цена;
* надпись: только у товаров «можно надпись», до 30 символов, цена из настроек
  и её снапшот в строке корзины и в заказе;
* заказ хранит снапшоты названия товара и подписи варианта;
* вариант из заказов удалить нельзя — только выключить;
* ближайшее окно выдачи на странице товара считает та же функция, что проверяет
  дату и интервал заказа.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.core import clock
from app.core.db import SessionLocal
from app.models import AuditLogEntry, Order, Product, ProductImage, ProductVariant
from app.schemas.admin import ProductIn, VariantIn
from app.services import bakery_settings, journal

MOSCOW = ZoneInfo("Europe/Moscow")
CART = "/api/v1/cart"
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


def _at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), MOSCOW)


@pytest.fixture
def now(monkeypatch):
    """Подмена «сейчас» кондитерской: now(datetime) — с этого момента."""

    def set_now(moment: datetime) -> None:
        monkeypatch.setattr(clock, "local_now", lambda: moment)

    # По умолчанию — 10:00 сегодня: окна дня открыты
    set_now(_at(datetime.now(MOSCOW).date(), 10))
    return set_now


@pytest.fixture
async def cake_variants(catalog) -> dict[str, int]:
    """У детского торта два варианта: «1,5 кг» (из фикстуры) и «3 кг»."""
    async with SessionLocal() as session:
        big = ProductVariant(
            product_id=catalog.products["kids-cake"],
            label="3 кг",
            price=Decimal("7200"),
            weight_grams=3000,
            portions_min=24,
            portions_max=30,
            order=1,
        )
        session.add(big)
        await session.commit()
        return {"small": catalog.variants["kids-cake"], "big": big.id}


async def _add(client, variant_id: int, **extra) -> dict:
    response = await client.post(f"{CART}/items", json={"variant_id": variant_id} | extra)
    assert response.status_code == 201, response.text
    return response.json()


# --- Корзина ---


async def test_same_product_different_variants_are_separate_lines(
    client, catalog, cake_variants, now
) -> None:
    await _add(client, cake_variants["small"])
    cart = await _add(client, cake_variants["big"])

    assert [(i["variant_label"], i["price"]) for i in cart["items"]] == [
        ("1,5 кг", "3800.00"),
        ("3 кг", "7200.00"),
    ]
    assert {i["product_id"] for i in cart["items"]} == {catalog.products["kids-cake"]}
    assert all(i["has_variants"] for i in cart["items"])
    assert cart["total_price"] == "11000.00"


async def test_same_variant_merges_and_lines_are_addressed_by_id(
    client, catalog, cake_variants, now
) -> None:
    await _add(client, cake_variants["small"])
    cart = await _add(client, cake_variants["small"], quantity=2)
    [line] = cart["items"]
    assert line["quantity"] == 3

    other = await _add(client, cake_variants["big"])
    big_line = next(i for i in other["items"] if i["variant_id"] == cake_variants["big"])
    response = await client.patch(f"{CART}/items/{big_line['id']}", json={"quantity": 5})
    assert response.status_code == 200
    quantities = {i["variant_label"]: i["quantity"] for i in response.json()["items"]}
    assert quantities == {"1,5 кг": 3, "3 кг": 5}

    response = await client.delete(f"{CART}/items/{line['id']}")
    assert [i["variant_label"] for i in response.json()["items"]] == ["3 кг"]


async def test_inactive_variant_cannot_be_added(client, catalog, cake_variants) -> None:
    async with SessionLocal() as session:
        variant = await session.get(ProductVariant, cake_variants["big"])
        variant.is_active = False
        await session.commit()
    response = await client.post(f"{CART}/items", json={"variant_id": cake_variants["big"]})
    assert response.status_code == 404


# --- Надпись ---


async def test_inscription_is_rejected_where_not_allowed(client, catalog) -> None:
    response = await client.post(
        f"{CART}/items",
        json={"variant_id": catalog.variants["gf-cookie"], "inscription_text": "С днём рождения"},
    )
    assert response.status_code == 422
    assert "надпись" in response.json()["detail"]


async def test_inscription_price_is_part_of_line_total(client, catalog, now) -> None:
    cart = await _add(
        client, catalog.variants["kids-cake"], quantity=2, inscription_text="  С днём рождения  "
    )
    [line] = cart["items"]
    assert line["inscription_text"] == "С днём рождения"
    assert line["inscription_price"] == "300.00"
    # (3800 + 300) × 2
    assert line["line_total"] == "8200.00"
    assert cart["total_price"] == "8200.00"


async def test_other_inscription_is_another_line_and_blank_is_none(client, catalog, now) -> None:
    variant = catalog.variants["kids-cake"]
    await _add(client, variant, inscription_text="Маше 5 лет")
    await _add(client, variant, inscription_text="Маше 5 лет")
    await _add(client, variant, inscription_text="Пете 7 лет")
    cart = await _add(client, variant, inscription_text="   ")

    lines = {i["inscription_text"]: i for i in cart["items"]}
    assert set(lines) == {"Маше 5 лет", "Пете 7 лет", None}
    assert lines["Маше 5 лет"]["quantity"] == 2
    # Без надписи — без её цены
    assert lines[None]["inscription_price"] is None
    assert lines[None]["line_total"] == "3800.00"


@pytest.mark.parametrize("text", ["х" * 31, "  " + "х" * 31 + "  "])
async def test_inscription_is_limited_to_30_chars(client, catalog, text) -> None:
    response = await client.post(
        f"{CART}/items",
        json={"variant_id": catalog.variants["kids-cake"], "inscription_text": text},
    )
    assert response.status_code == 422


async def test_inscription_of_24_chars_after_trim_is_accepted(client, catalog, now) -> None:
    # Лимит — 24 знака после обрезки пробелов (макет 09.10, 006b; было 30)
    cart = await _add(client, catalog.variants["kids-cake"], inscription_text=" " + "х" * 24 + " ")
    assert cart["items"][0]["inscription_text"] == "х" * 24


async def test_inscription_price_comes_from_settings(
    client, catalog, admin_headers, clean_settings, now
) -> None:
    response = await client.put(
        "/api/v1/admin/settings",
        json={"large_order_total": 10000, "large_event_guests": 30, "inscription_price": 450},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    slug = (await client.get(f"/api/v1/catalog/products?category={catalog.category_slug}")).json()
    cake = next(i for i in slug["items"] if i["name"] == "kids-cake")
    card = (await client.get(f"/api/v1/catalog/products/{cake['slug']}")).json()
    assert card["allows_inscription"] is True
    assert card["inscription_price"] == "450.00"

    cart = await _add(client, catalog.variants["kids-cake"], inscription_text="Ура")
    assert cart["items"][0]["inscription_price"] == "450.00"


# --- Заказ: снапшоты ---


async def test_order_keeps_snapshots_after_rename(client, catalog, admin_headers, now) -> None:
    await _add(client, catalog.variants["kids-cake"], inscription_text="Маше 5 лет")
    day = (clock.local_today() + timedelta(days=3)).isoformat()
    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": day})
    assert response.status_code == 201, response.text
    number = response.json()["order_number"]
    token = response.json()["token"]

    async with SessionLocal() as session:
        variant = await session.get(ProductVariant, catalog.variants["kids-cake"])
        variant.label = "1,6 кг"
        variant.price = Decimal("9999")
        product = await session.get(Product, catalog.products["kids-cake"])
        product.name = "Переименованный торт"
        await session.commit()

    order = (await client.get(f"/api/v1/orders/{number}", params={"t": token})).json()
    [item] = order["items"]
    assert (item["name"], item["variant_label"]) == ("kids-cake", "1,5 кг")
    assert (item["price"], item["inscription_price"]) == ("3800.00", "300.00")
    assert item["inscription_text"] == "Маше 5 лет"
    assert item["line_total"] == "4100.00"
    assert order["total_price"] == "4100.00"

    async with SessionLocal() as session:
        order_id = await session.scalar(select(Order.id).where(Order.order_number == number))
    detail = (await client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers)).json()
    [admin_item] = detail["items"]
    assert admin_item["name"] == "kids-cake"
    assert admin_item["variant_label"] == "1,5 кг"
    assert admin_item["inscription_text"] == "Маше 5 лет"


async def test_inscription_text_is_not_logged(client, catalog, now) -> None:
    """Надпись — свободный ввод покупателя: в журнал не попадает."""
    await _add(client, catalog.variants["kids-cake"], inscription_text="Секретная Маша")
    day = (clock.local_today() + timedelta(days=3)).isoformat()
    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": day})
    assert response.status_code == 201
    async with SessionLocal() as session:
        entries = (
            await session.scalars(select(AuditLogEntry).where(AuditLogEntry.action == "site_order"))
        ).all()
    assert all("Маша" not in str(entry.details) for entry in entries)


# --- Админка: варианты ---


async def _admin_product(client, headers, product_id: int) -> dict:
    data = (await client.get(f"/api/v1/admin/products/{product_id}", headers=headers)).json()
    payload = {key: data[key] for key in ProductIn.model_fields if key in data}
    payload["variants"] = [
        {key: v[key] for key in VariantIn.model_fields if key in v} for v in data["variants"]
    ]
    return payload


async def test_admin_syncs_variants(client, catalog, admin_headers) -> None:
    product_id = catalog.products["gf-cookie"]
    payload = await _admin_product(client, admin_headers, product_id)
    [cookie] = payload["variants"]
    box = {"label": "коробка", "price": "1200", "weight_grams": 720, "size_note": "12 штук"}

    # Новый вариант — первым: порядок — порядок в списке
    response = await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [box, cookie]},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [v["label"] for v in body["variants"]] == ["коробка", "180 г"]
    assert body["price_from"] == "350.00"
    assert body["variants"][0]["size_note"] == "12 штук"

    # Удалить вариант, которого нет в заказах, можно
    response = await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [body["variants"][1] | {"in_orders": None}]},
        headers=admin_headers,
    )
    # in_orders — поле ответа; в запросе оно лишнее
    assert response.status_code == 422
    kept = {k: v for k, v in body["variants"][1].items() if k != "in_orders"}
    response = await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [kept]},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert [v["label"] for v in response.json()["variants"]] == ["180 г"]


async def test_variant_in_orders_can_only_be_disabled(client, catalog, admin_headers, now) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    response = await client.post("/api/v1/orders", json=ORDER)
    assert response.status_code == 201, response.text

    product_id = catalog.products["gf-cookie"]
    payload = await _admin_product(client, admin_headers, product_id)
    detail = (
        await client.get(f"/api/v1/admin/products/{product_id}", headers=admin_headers)
    ).json()
    assert detail["variants"][0]["in_orders"] is True

    replacement = {"label": "200 г", "price": "400", "weight_grams": 200}
    response = await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [replacement]},
        headers=admin_headers,
    )
    assert response.status_code == 409
    assert "только выключить" in response.json()["detail"]

    disabled = payload["variants"][0] | {"is_active": False}
    response = await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [disabled, replacement]},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    public = (await client.get(f"/api/v1/catalog/products?category={catalog.category_slug}")).json()
    cookie = next(i for i in public["items"] if i["name"] == "gf-cookie")
    assert [v["label"] for v in cookie["variants"]] == ["200 г"]
    assert cookie["price_from"] == "400.00"


async def test_admin_variant_changes_are_journaled(client, catalog, admin_headers) -> None:
    product_id = catalog.products["gift-box"]
    payload = await _admin_product(client, admin_headers, product_id)
    variant = payload["variants"][0] | {"price": "1700.00"}
    await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [variant, {"label": "XL", "price": "3000"}]},
        headers=admin_headers,
    )
    feed = (await client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()["activity"]
    text = next(item["text"] for item in feed if "gift-box" in item["text"])
    assert "цена товара «gift-box» (240 г): 1 600 ₽ → 1 700 ₽" in text
    assert "новый вариант «XL»" in text
    assert journal.money("1700.00") == "1 700 ₽"


async def test_image_role(client, catalog, admin_headers) -> None:
    async with SessionLocal() as session:
        image = ProductImage(
            product_id=catalog.products["kids-cake"], storage_key="products/t.webp", is_main=True
        )
        session.add(image)
        await session.commit()
        image_id = image.id

    url = f"/api/v1/admin/products/{catalog.products['kids-cake']}/images/{image_id}/role"
    response = await client.put(url, json={"role": "cut"}, headers=admin_headers)
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "cut"

    listing = (
        await client.get(f"/api/v1/catalog/products?category={catalog.category_slug}")
    ).json()
    slug = next(i["slug"] for i in listing["items"] if i["name"] == "kids-cake")
    card = (await client.get(f"/api/v1/catalog/products/{slug}")).json()
    assert card["images"][0]["role"] == "cut"

    wrong = f"/api/v1/admin/products/{catalog.products['gf-cookie']}/images/{image_id}/role"
    assert (await client.put(wrong, json={"role": None}, headers=admin_headers)).status_code == 404


async def test_category_intro_and_all_label(client, catalog, admin_headers) -> None:
    category = {
        "name": "Тест",
        "slug": catalog.category_slug,
        "intro": "Готовые торты фиксированного веса.",
        "all_label": "Все торты",
    }
    response = await client.put(
        f"/api/v1/admin/categories/{catalog.category_id}", json=category, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    subcategory = {
        "category_id": catalog.category_id,
        "name": "Тестовая",
        "slug": "sub-intro",
        "intro": "  ",
    }
    response = await client.put(
        f"/api/v1/admin/subcategories/{catalog.subcategory_id}",
        json=subcategory | {"intro": "Классические пирожные."},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    tree = (await client.get("/api/v1/catalog/categories")).json()
    mine = next(c for c in tree if c["slug"] == catalog.category_slug)
    assert mine["intro"] == "Готовые торты фиксированного веса."
    assert mine["all_label"] == "Все торты"
    assert mine["subcategories"][0]["intro"] == "Классические пирожные."

    # Пустая строка — «не заполнено»
    response = await client.put(
        f"/api/v1/admin/subcategories/{catalog.subcategory_id}",
        json=subcategory,
        headers=admin_headers,
    )
    assert response.json()["intro"] is None


# --- Ближайшее окно выдачи ---


async def _slot(client, catalog, slug: str) -> dict | None:
    listing = (
        await client.get(f"/api/v1/catalog/products?category={catalog.category_slug}")
    ).json()
    full = next(i["slug"] for i in listing["items"] if i["name"] == slug)
    return (await client.get(f"/api/v1/catalog/products/{full}")).json()["nearest_slot"]


async def test_nearest_slot_during_the_day(client, catalog, now, clean_settings) -> None:
    """Запас по умолчанию — 60 минут: в 13:00 окно 15–18 ещё открыто, в 14:00 уже нет."""
    today = date(2026, 10, 7)  # среда
    now(_at(today, 13))
    assert await _slot(client, catalog, "gf-cookie") == {
        "date": today.isoformat(),
        "interval": "15-18",
        # Карточка пишет «Можно забрать сегодня» по days_ahead, а не сравнивает даты сама
        "days_ahead": 0,
    }
    # Ровно за час до начала окно уже закрыто
    now(_at(today, 14))
    assert (await _slot(client, catalog, "gf-cookie"))["interval"] == "18-21"


async def test_nearest_slot_in_the_evening_is_tomorrow(client, catalog, now) -> None:
    today = date(2026, 10, 7)
    now(_at(today, 19, 30))
    assert await _slot(client, catalog, "gf-cookie") == {
        "date": (today + timedelta(days=1)).isoformat(),
        "interval": "09-12",
        "days_ahead": 1,
    }


async def test_nearest_slot_on_weekend(client, catalog, now, clean_settings) -> None:
    """Выходных у кондитерской нет («Каждый день с 9:00»): суббота вечером —
    воскресенье утром, а не понедельник."""
    saturday = date(2026, 10, 10)
    assert saturday.weekday() == 5
    now(_at(saturday, 20))
    assert await _slot(client, catalog, "gf-cookie") == {
        "date": date(2026, 10, 11).isoformat(),
        "interval": "09-12",
        "days_ahead": 1,
    }
    now(_at(saturday, 10, 30))
    assert await _slot(client, catalog, "gf-cookie") == {
        "date": saturday.isoformat(),
        "interval": "12-15",
        "days_ahead": 0,
    }


async def test_nearest_slot_respects_lead_time(client, catalog, now) -> None:
    today = date(2026, 10, 7)
    now(_at(today, 19, 30))
    # Торт за 3 дня: окна дня готовности открыты целиком, вечер сегодня ни на что не влияет
    assert await _slot(client, catalog, "kids-cake") == {
        "date": (today + timedelta(days=3)).isoformat(),
        "interval": "09-12",
        "days_ahead": 3,
    }


async def test_nearest_slot_days_ahead_counts_from_business_day(client, catalog, now) -> None:
    """«Сегодня» / «завтра» — по дню кондитерской: в 00:30 по Москве на сервере
    в UTC ещё вчера, а окно 09–12 — уже сегодняшнее, days_ahead = 0."""
    today = date(2026, 10, 8)
    now(_at(today, 0, 30))
    assert await _slot(client, catalog, "gf-cookie") == {
        "date": today.isoformat(),
        "interval": "09-12",
        "days_ahead": 0,
    }


async def test_unavailable_product_has_no_slot(client, catalog, now) -> None:
    assert await _slot(client, catalog, "gift-box") is None


async def test_order_rejects_interval_that_already_started(
    client, catalog, now, clean_settings
) -> None:
    """Карточка обещает «ближайшее окно 15:00–18:00» — и оформление принимает
    именно его, а не уже начавшееся 12–15."""
    today = clock.local_today()
    now(_at(today, 13, 30))
    await _add(client, catalog.variants["gf-cookie"])

    early = ORDER | {"desired_date": today.isoformat(), "delivery_interval": "12-15"}
    response = await client.post("/api/v1/orders", json=early)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["earliest_date"] == today.isoformat()
    assert detail["nearest_interval"] == "15-18"

    ok = ORDER | {"desired_date": today.isoformat(), "delivery_interval": "15-18"}
    response = await client.post("/api/v1/orders", json=ok)
    assert response.status_code == 201, response.text


async def test_cart_earliest_date_moves_to_tomorrow_in_the_evening(client, catalog, now) -> None:
    today = clock.local_today()
    now(_at(today, 19))
    cart = await _add(client, catalog.variants["gf-cookie"])
    assert cart["earliest_date"] == (today + timedelta(days=1)).isoformat()


async def test_settings_default_inscription_price(clean_settings) -> None:
    async with SessionLocal() as session:
        settings = await bakery_settings.load(session)
    assert settings.inscription_price == 300


# --- Ревью 005a: запас окна, текущая цена надписи, сводка заказа, счётчики ---


async def _set_settings(client, headers, **values) -> None:
    body = {"large_order_total": 10000, "large_event_guests": 30, "inscription_price": 300}
    response = await client.put("/api/v1/admin/settings", json=body | values, headers=headers)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize(("minutes_before", "open_"), [(61, True), (59, False)])
async def test_cutoff_boundary_in_all_three_places(
    client, catalog, now, admin_headers, clean_settings, minutes_before, open_
) -> None:
    """Запас 60 минут: за 61 минуту до 15:00 окно 15–18 открыто, за 59 — нет.
    Одинаково в карточке товара, корзине и проверке заказа."""
    today = clock.local_today()
    now(_at(today, 15) - timedelta(minutes=minutes_before))
    expected = "15-18" if open_ else "18-21"

    assert (await _slot(client, catalog, "gf-cookie"))["interval"] == expected

    cart = await _add(client, catalog.variants["gf-cookie"])
    assert cart["earliest_date"] == today.isoformat()

    order = ORDER | {"desired_date": today.isoformat(), "delivery_interval": "15-18"}
    response = await client.post("/api/v1/orders", json=order)
    assert response.status_code == (201 if open_ else 422), response.text
    if not open_:
        assert response.json()["detail"]["nearest_interval"] == "18-21"


async def test_cutoff_setting_is_used_and_journaled(
    client, catalog, now, admin_headers, clean_settings
) -> None:
    today = clock.local_today()
    now(_at(today, 14, 30))
    assert (await _slot(client, catalog, "gf-cookie"))["interval"] == "18-21"

    await _set_settings(client, admin_headers, slot_cutoff_minutes=0)
    assert (await _slot(client, catalog, "gf-cookie"))["interval"] == "15-18"

    feed = (await client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    texts = [item["text"] for item in feed["activity"]]
    assert any("окно выдачи закрывается за 60 → 0" in text for text in texts), texts

    response = await client.put(
        "/api/v1/admin/settings",
        json={
            "large_order_total": 10000,
            "large_event_guests": 30,
            "inscription_price": 300,
            "slot_cutoff_minutes": 241,
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


async def test_inscription_price_is_current_in_cart_and_order(
    client, catalog, now, admin_headers, clean_settings
) -> None:
    """Ревью 005a: цена надписи — на момент заказа. Корзина, собранная при 300 ₽,
    после смены цены показывает и оформляет новую."""
    cart = await _add(client, catalog.variants["kids-cake"], inscription_text="Ура")
    assert cart["items"][0]["inscription_price"] == "300.00"

    await _set_settings(client, admin_headers, inscription_price=500)
    cart = (await client.get(CART)).json()
    [line] = cart["items"]
    assert line["inscription_price"] == "500.00"
    assert line["line_total"] == "4300.00"

    day = (clock.local_today() + timedelta(days=3)).isoformat()
    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": day})
    assert response.status_code == 201, response.text
    created = response.json()
    order = (
        await client.get(
            f"/api/v1/orders/{created['order_number']}", params={"t": created["token"]}
        )
    ).json()
    assert order["items"][0]["inscription_price"] == "500.00"
    assert order["total_price"] == "4300.00"


async def test_order_summary_shows_variant_when_product_has_several(
    client, catalog, cake_variants, now, admin_headers
) -> None:
    """«gf-cookie ×2, kids-cake 3 кг» — подпись варианта только у товара
    с несколькими вариантами. Та же строка в списке заказов и на главной админки."""
    await _add(client, catalog.variants["gf-cookie"], quantity=2)
    await _add(client, cake_variants["big"])
    day = (clock.local_today() + timedelta(days=3)).isoformat()
    response = await client.post("/api/v1/orders", json=ORDER | {"desired_date": day})
    assert response.status_code == 201, response.text
    number = response.json()["order_number"]

    listing = (
        await client.get("/api/v1/admin/orders", params={"page_size": 100}, headers=admin_headers)
    ).json()
    mine = next(item for item in listing["items"] if item["order_number"] == number)
    assert mine["items_summary"] == "gf-cookie ×2, kids-cake 3 кг"


async def test_categories_count_visible_products(client, catalog) -> None:
    """Счётчик подраздела — видимые товары без учёта фильтров: все три
    тестовых товара (снятый с наличия тоже виден в каталоге)."""
    tree = (await client.get("/api/v1/catalog/categories")).json()
    mine = next(c for c in tree if c["slug"] == catalog.category_slug)
    assert mine["subcategories"][0]["product_count"] == 3
    assert mine["product_count"] == 3

    async with SessionLocal() as session:
        product = await session.get(Product, catalog.products["gf-cookie"])
        product.is_active = False
        await session.commit()
    tree = (await client.get("/api/v1/catalog/categories")).json()
    mine = next(c for c in tree if c["slug"] == catalog.category_slug)
    assert mine["subcategories"][0]["product_count"] == 2
