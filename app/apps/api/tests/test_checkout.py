"""Корзина и оформление (007a): доставка, окна по способу, 7 дней и объяснение срока,
почта и получатель, журнал и обезличивание новых полей, допродажа, токен страницы
заказа и маски, «пришёл ночью», письмо-копия, правка надписи в корзине."""

import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import delete, func, select

from app.core import clock
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    AuditLogEntry,
    Category,
    DeliveryMethod,
    Order,
    OrderStatus,
    Product,
    ProductVariant,
    SubCategory,
)
from app.schemas.settings import BakerySettings
from app.services import delivery, order_email, retention
from app.services.orders import is_after_hours, mask_email, mask_phone

MOSCOW = ZoneInfo("Europe/Moscow")
TODAY = datetime.now(MOSCOW).date()
ORDER = {
    "customer_name": "Анна Покупательница",
    "customer_phone": "+7 916 123-45-67",
    "customer_email": "anna@mail.ru",
    "delivery_method": "pickup",
    "consent_pd": True,
    # Дата и окно обязательны (007b): по умолчанию — через 5 дней, подходит и витрине
    # «сегодня», и тортам под заказ за 3 дня
    "desired_date": (
        datetime.now(ZoneInfo("Europe/Moscow")).date() + timedelta(days=5)
    ).isoformat(),
    "delivery_interval": "12-15",
}
DELIVERY = {
    "delivery_method": "delivery",
    "delivery_address": "Гжатская улица, 5",
    "address_apartment": "12",
    "address_entrance": "2",
    "address_floor": "4",
    "courier_comment": "домофон 25, спросить Олю",
}


@pytest.fixture(autouse=True)
def _midday(monkeypatch) -> None:
    """10:00 по Москве: окна сегодняшнего дня ещё открыты (как в test_orders_dates)."""
    moment = datetime.combine(TODAY, time(10), MOSCOW)
    monkeypatch.setattr(clock, "local_now", lambda: moment)


async def _add(client, variant_id: int, **extra) -> dict:
    response = await client.post("/api/v1/cart/items", json={"variant_id": variant_id} | extra)
    assert response.status_code == 201, response.text
    return response.json()


async def _order(client, **extra):
    return await client.post("/api/v1/orders", json=ORDER | extra)


def _date(days: int) -> str:
    return (TODAY + timedelta(days=days)).isoformat()


# --- 2. Доставка ---


def test_delivery_cost_free_from_threshold() -> None:
    settings = BakerySettings()
    cost = delivery.delivery_cost
    assert cost(Decimal("4999.99"), DeliveryMethod.DELIVERY, settings) == Decimal("500.00")
    assert cost(Decimal("5000.00"), DeliveryMethod.DELIVERY, settings) == Decimal("0.00")
    assert cost(Decimal("100.00"), DeliveryMethod.PICKUP, settings) == Decimal("0.00")
    assert delivery.free_delivery_left(Decimal("1640.00"), settings) == Decimal("3360.00")
    assert delivery.free_delivery_left(Decimal("7280.00"), settings) == Decimal("0.00")


async def test_cart_reports_delivery_and_order_snapshots_it(
    client, catalog, clean_settings
) -> None:
    cart = await _add(client, catalog.variants["gf-cookie"])  # 350 ₽
    assert cart["subtotal"] == "350.00"
    assert cart["delivery_price_pickup"] == "0.00"
    assert cart["delivery_price_delivery"] == "500.00"
    assert cart["free_delivery_from"] == "5000.00"
    assert cart["free_delivery_left"] == "4650.00"
    assert cart["delivery_note"].startswith("Доставляем в пределах МКАД")

    response = await _order(client, **DELIVERY, desired_date=_date(0), delivery_interval="12-15")
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["subtotal"], body["delivery_price"], body["total_price"]) == (
        "350.00",
        "500.00",
        "850.00",
    )


# --- 3. Окна по способу, 7 дней, объяснение срока ---


async def test_delivery_has_no_evening_window(client, catalog, clean_settings) -> None:
    cart = await _add(client, catalog.variants["gf-cookie"])
    pickup = [i["interval"] for i in cart["slots"]["pickup"][1]["intervals"]]
    courier = [i["interval"] for i in cart["slots"]["delivery"][1]["intervals"]]
    assert pickup == ["09-12", "12-15", "15-18", "18-21"]
    assert courier == ["09-12", "12-15", "15-18"]

    evening = {"desired_date": _date(1), "delivery_interval": "18-21"}
    refused = await _order(client, **DELIVERY, **evening)
    assert refused.status_code == 422
    assert "нет окна 18–21" in refused.json()["detail"]
    assert (await _order(client, **evening)).status_code == 201  # самовывоз — можно


async def test_week_of_days_and_earliest_reason(client, catalog, clean_settings) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    cart = await _add(client, catalog.variants["kids-cake"])  # под заказ за 3 дня
    days = cart["slots"]["pickup"]
    assert len(days) == 7
    assert [d["label"] for d in days[:2]] == ["Сегодня", "Завтра"]
    assert days[2]["label"] in {"Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"}
    assert [d["available"] for d in days] == [False, False, False, True, True, True, True]
    assert all(not i["available"] for i in days[0]["intervals"])
    # В 10:00 сегодняшнее окно 09–12 уже началось, 12–15 ещё можно
    reason = cart["earliest_reason"]
    assert reason == {
        "name": "kids-cake",
        "variant_label": "1,5 кг",
        "has_variants": False,
        "lead_time_days": 3,
    }
    assert cart["earliest_date"] == _date(3)


async def test_today_window_closes_by_cutoff(client, catalog, clean_settings) -> None:
    cart = await _add(client, catalog.variants["gf-cookie"])
    today = {i["interval"]: i["available"] for i in cart["slots"]["pickup"][0]["intervals"]}
    assert today == {"09-12": False, "12-15": True, "15-18": True, "18-21": True}
    assert cart["earliest_reason"] is None


# --- 1. Почта, получатель, журнал без ПДн ---


async def test_email_is_required_and_validated(client, catalog) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    without = {k: v for k, v in ORDER.items() if k != "customer_email"}
    assert (await client.post("/api/v1/orders", json=without)).status_code == 422
    bad = await _order(client, customer_email="anna@")
    assert bad.status_code == 422
    assert "Укажите почту, пришлём на неё копию заказа" in bad.text


async def test_other_recipient_needs_name_and_phone(client, catalog, admin_headers) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    missing = await _order(client, other_recipient=True, recipient_name="Оля")
    assert missing.status_code == 422
    assert "телефон получателя" in missing.text

    response = await _order(
        client,
        **DELIVERY,
        contact_method="telegram",
        other_recipient=True,
        recipient_name="Оля Получатель",
        recipient_phone="+7 900 111-22-33",
        customer_comment="позвоните после 18",
    )
    assert response.status_code == 201, response.text
    async with SessionLocal() as session:
        order_id = await session.scalar(
            select(Order.id).where(Order.order_number == response.json()["order_number"])
        )
    detail = (await client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers)).json()
    assert detail["customer_email"] == "anna@mail.ru"
    assert detail["contact_method"] == "telegram"
    assert (detail["recipient_name"], detail["recipient_phone"]) == (
        "Оля Получатель",
        "+7 900 111-22-33",
    )
    assert (detail["address_apartment"], detail["address_entrance"], detail["address_floor"]) == (
        "12",
        "2",
        "4",
    )
    assert detail["courier_comment"] == "домофон 25, спросить Олю"
    assert detail["customer_comment"] == "позвоните после 18"


async def test_pickup_does_not_keep_address_fields(client, catalog) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    response = await _order(client, **(DELIVERY | {"delivery_method": "pickup"}))
    assert response.status_code == 201, response.text
    async with SessionLocal() as session:
        order = await session.scalar(
            select(Order).where(Order.order_number == response.json()["order_number"])
        )
    assert order.delivery_address is None and order.courier_comment is None
    assert order.address_apartment is None


async def test_journal_gets_no_personal_data_from_new_fields(client, catalog) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    response = await _order(
        client,
        **DELIVERY,
        desired_date=_date(0),
        delivery_interval="12-15",
        other_recipient=True,
        recipient_name="Оля Получатель",
        recipient_phone="+7 900 111-22-33",
    )
    assert response.status_code == 201, response.text
    async with SessionLocal() as session:
        order_id = await session.scalar(
            select(Order.id).where(Order.order_number == response.json()["order_number"])
        )
        entry = await session.scalar(
            select(AuditLogEntry).where(
                AuditLogEntry.action == "site_order", AuditLogEntry.entity_id == str(order_id)
            )
        )
    assert set(entry.details) == {"number", "total", "delivery_method"}
    dumped = json.dumps(entry.details, ensure_ascii=False)
    for secret in ("anna", "Оля", "111-22", "Гжатская", "домофон", "4567"):
        assert secret not in dumped


async def test_new_personal_fields_are_anonymized(catalog) -> None:
    async with SessionLocal() as session:
        order = Order(
            order_number=f"T{uuid.uuid4().hex[:10]}",
            customer_name="Анна",
            customer_phone="+79161234567",
            customer_email="anna@mail.ru",
            recipient_name="Оля",
            recipient_phone="+79001112233",
            delivery_method=DeliveryMethod.DELIVERY,
            delivery_address="Гжатская, 5",
            address_apartment="12",
            address_entrance="2",
            address_floor="4",
            courier_comment="домофон 25",
            consent_pd=True,
            subtotal=Decimal("350"),
            total_price=Decimal("850"),
            delivery_price=Decimal("500"),
            status=OrderStatus.COMPLETED,
        )
        order.items.append(catalog.order_item("gf-cookie", 1, "350"))
        session.add(order)
        await session.flush()
        order.created_at = datetime.now(UTC) - timedelta(days=4000)
        await session.commit()
        order_id = order.id

    async with SessionLocal() as session:
        await retention.purge_expired(session)

    async with SessionLocal() as session:
        order = await session.get(Order, order_id)
        assert order.customer_email is None
        assert (order.recipient_name, order.recipient_phone) == (None, None)
        assert (order.address_apartment, order.address_entrance, order.address_floor) == (
            None,
            None,
            None,
        )
        assert order.courier_comment is None
        # Суммы остаются: обезличивание стирает только ПДн
        assert order.delivery_price == Decimal("500.00")


# --- 5. Страница «Заказ принят»: токен, маски, «пришёл ночью» ---


def test_masks() -> None:
    assert mask_phone("+7 916 123-45-67") == "+7 (916) ***-**-67"
    assert mask_phone("8 (916) 123-45-67") == "+7 (916) ***-**-67"
    assert mask_email("anna@mail.ru") == "an***@mail.ru"
    assert mask_email(None) is None


def test_after_hours_uses_settings() -> None:
    settings = BakerySettings()

    def at(hour: int) -> datetime:
        return datetime.combine(TODAY, time(hour, 30), MOSCOW)

    assert is_after_hours(at(21), settings) is True
    assert is_after_hours(at(8), settings) is True
    assert is_after_hours(at(9), settings) is False
    assert is_after_hours(at(20), settings) is False
    assert is_after_hours(at(20), BakerySettings(work_hours_end=20)) is True


async def test_order_page_needs_valid_fresh_token(client, catalog, monkeypatch) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    created = (await _order(client, contact_method="telegram")).json()
    number, token = created["order_number"], created["token"]
    assert created["phone_masked"] == "+7 (916) ***-**-67"
    assert created["email_masked"] == "an***@mail.ru"
    assert created["contact_method"] == "telegram"
    assert isinstance(created["after_hours"], bool)
    assert "customer_phone" not in created and "customer_name" not in created

    url = f"/api/v1/orders/{number}"
    assert (await client.get(url)).status_code == 404
    assert (await client.get(url, params={"t": "123.abc"})).status_code == 404
    other = (await client.get(url, params={"t": token[:-2] + "xx"})).status_code
    assert other == 404
    page = await client.get(url, params={"t": token})
    assert page.status_code == 200
    assert page.json()["phone_masked"] == "+7 (916) ***-**-67"

    # Чужой номер с этим токеном не открывается
    assert (
        await client.get("/api/v1/orders/20200101-AAAAAA", params={"t": token})
    ).status_code == 404

    # Через 8 дней ссылка не работает
    later = clock.utc_now() + timedelta(days=8)
    monkeypatch.setattr(clock, "utc_now", lambda: later)
    assert (await client.get(url, params={"t": token})).status_code == 404


# --- 6. Письмо-копия ---


class FakeSMTP:
    sent: list = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def starttls(self):
        pass

    def login(self, user, password):
        pass

    def send_message(self, message):
        FakeSMTP.sent.append(message)


async def test_order_copy_is_emailed(client, catalog, monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.yandex.ru")
    monkeypatch.setattr(settings, "smtp_port", 465)
    monkeypatch.setattr(settings, "smtp_from", "zakaz@example.ru")
    monkeypatch.setattr(order_email.smtplib, "SMTP_SSL", FakeSMTP)
    FakeSMTP.sent = []

    await _add(client, catalog.variants["kids-cake"], inscription_text="Маше 5 лет")
    response = await _order(client, **DELIVERY, desired_date=_date(3), delivery_interval="12-15")
    assert response.status_code == 201, response.text
    number = response.json()["order_number"]

    [message] = FakeSMTP.sent
    assert message["To"] == "anna@mail.ru"
    assert message["Subject"] == f"Заказ № {number} принят — Кондитерская Елены Абрикосовой"
    text = message.get_body(("plain",)).get_content()
    html = message.get_body(("html",)).get_content()
    for part in (text, html):
        assert "kids-cake" in part and "Маше 5 лет" in part
        assert "Гжатская улица, 5" in part
        assert "12:00–15:00" in part
    assert "30 минут" in text or "утром" in text
    assert "/brand/logo.png" in html
    assert f"/order/{number}?t=" in html


async def test_without_smtp_order_is_created_and_email_masked_in_log(
    client, catalog, monkeypatch, caplog
) -> None:
    monkeypatch.setattr(get_settings(), "smtp_host", None)
    await _add(client, catalog.variants["gf-cookie"])
    with caplog.at_level(logging.WARNING, logger="app.services.order_email"):
        response = await _order(client)
    assert response.status_code == 201
    assert "an***@mail.ru" in caplog.text
    assert "anna@mail.ru" not in caplog.text


# --- 7. «Изменить» надпись у строки корзины ---


async def test_edit_inscription_and_merge_twin_lines(client, catalog) -> None:
    cake = catalog.variants["kids-cake"]
    await _add(client, cake, inscription_text="Маше 5 лет")
    cart = await _add(client, cake, inscription_text="С днём рождения", quantity=2)
    first, second = cart["items"]

    edited = await client.patch(
        f"/api/v1/cart/items/{first['id']}", json={"inscription_text": "  Маше 6 лет  "}
    )
    assert edited.status_code == 200
    assert {i["inscription_text"] for i in edited.json()["items"]} == {
        "Маше 6 лет",
        "С днём рождения",
    }
    too_long = await client.patch(
        f"/api/v1/cart/items/{first['id']}", json={"inscription_text": "х" * 25}
    )
    assert too_long.status_code == 422

    # Та же надпись, что у второй строки, — одна строка, количество сложилось
    merged = await client.patch(
        f"/api/v1/cart/items/{first['id']}", json={"inscription_text": "С днём рождения"}
    )
    items = merged.json()["items"]
    assert len(items) == 1
    assert (items[0]["id"], items[0]["quantity"]) == (second["id"], 3)

    cookie = catalog.variants["gf-cookie"]
    cart = await _add(client, cookie)
    line = next(i for i in cart["items"] if i["variant_id"] == cookie)
    refused = await client.patch(
        f"/api/v1/cart/items/{line['id']}", json={"inscription_text": "Ура"}
    )
    assert refused.status_code == 422


# --- 4. Допродажа и скрытый раздел ---


@pytest.fixture
async def upsell() -> AsyncIterator[dict[str, int | str]]:
    """Торт в разделе «Торты» (slug torty) и два товара «Предлагать в корзине» в
    скрытом разделе: один в наличии сегодня, другой под заказ (не предлагается)."""
    suffix = uuid.uuid4().hex[:8]
    created: list[int] = []
    async with SessionLocal() as session:
        cakes = await session.scalar(select(Category).where(Category.slug == "torty"))
        if cakes is None:
            cakes = Category(name="Торты", slug="torty", is_active=True)
            cakes.subcategories = [SubCategory(name="Классические", slug=f"klass-{suffix}")]
            session.add(cakes)
            await session.flush()
            created.append(cakes.id)
        else:
            await session.refresh(cakes, ["subcategories"])
        hidden = Category(name=f"К торту {suffix}", slug=f"k-tortu-{suffix}", is_active=False)
        hidden.subcategories = [SubCategory(name="Свечи", slug=f"svechi-{suffix}")]
        session.add(hidden)
        await session.flush()

        def make(slug: str, category: Category, **fields) -> Product:
            product = Product(
                name=slug,
                slug=f"{slug}-{suffix}",
                category_id=category.id,
                subcategory_id=category.subcategories[0].id,
                description="Тест",
                composition="Тест",
                **fields,
            )
            product.variants = [
                ProductVariant(label="1 шт.", price=Decimal("200"), order=0, weight_grams=None)
            ]
            return product

        cake = make("cake", cakes)
        candles = make("candles", hidden, is_upsell=True)
        later = make("card-later", hidden, is_upsell=True, lead_time_days=2)
        session.add_all([cake, candles, later])
        await session.commit()
        data = {
            "cake": cake.variants[0].id,
            "candles": candles.variants[0].id,
            "candles_id": candles.id,
            "candles_slug": candles.slug,
            "later_id": later.id,
            "hidden_id": hidden.id,
        }
        ids = [cake.id, candles.id, later.id]
    yield data
    async with SessionLocal() as session:
        await session.execute(delete(Product).where(Product.id.in_(ids)))
        await session.execute(
            delete(Category).where(Category.id.in_([data["hidden_id"], *created]))
        )
        await session.commit()


async def test_upsell_only_with_cake_and_not_from_cart(client, catalog, upsell) -> None:
    await _add(client, catalog.variants["gf-cookie"])
    assert (await client.get("/api/v1/cart/upsell")).json() == []  # торта нет — блока нет

    await _add(client, upsell["cake"])
    ids = [p["id"] for p in (await client.get("/api/v1/cart/upsell")).json()]
    assert upsell["candles_id"] in ids
    assert upsell["later_id"] not in ids  # под заказ — не «к торту сегодня»
    assert len(ids) <= 4

    # Товар скрытого раздела кладётся в корзину — и пропадает из предложения
    await _add(client, upsell["candles"])
    ids = [p["id"] for p in (await client.get("/api/v1/cart/upsell")).json()]
    assert upsell["candles_id"] not in ids


async def test_hidden_category_product_has_no_page(client, upsell) -> None:
    slug = upsell["candles_slug"]
    assert (await client.get(f"/api/v1/catalog/products/{slug}")).status_code == 404
    listed = (await client.get("/api/v1/catalog/products", params={"page_size": 60})).json()
    assert slug not in {p["slug"] for p in listed["items"]}
    sitemap = (await client.get("/api/v1/catalog/sitemap")).json()
    assert slug not in {p["slug"] for p in sitemap["products"]}


# --- 007b: двойное нажатие «Отправить заказ» ---


async def test_idempotency_key_returns_the_same_order(client, catalog) -> None:
    from app.core.redis import get_redis

    await _add(client, catalog.variants["gf-cookie"])
    headers = {"Idempotency-Key": f"k-{uuid.uuid4()}"}
    first = await client.post("/api/v1/orders", json=ORDER, headers=headers)
    assert first.status_code == 201, first.text
    # Повтор того же запроса (двойной клик, обрыв сети): тот же заказ, второго нет
    again = await client.post("/api/v1/orders", json=ORDER, headers=headers)
    assert again.status_code == 201, again.text
    assert again.json()["order_number"] == first.json()["order_number"]
    async with SessionLocal() as session:
        count = await session.scalar(
            select(func.count(Order.id)).where(Order.order_number == first.json()["order_number"])
        )
    assert count == 1

    # Пока первый запрос с ключом ещё идёт — 409, а не второй заказ
    await _add(client, catalog.variants["gf-cookie"])
    busy = f"k-{uuid.uuid4()}"
    await get_redis().set(f"order-idem:{client.cookies.get('cart_id')}:{busy}", "pending", ex=60)
    racing = await client.post("/api/v1/orders", json=ORDER, headers={"Idempotency-Key": busy})
    assert racing.status_code == 409

    # Ошибка оформления освобождает ключ: исправленный запрос с тем же ключом проходит
    retry = f"k-{uuid.uuid4()}"
    bad = await client.post(
        "/api/v1/orders",
        json=ORDER
        | {
            "delivery_method": "delivery",
            "delivery_address": "Гжатская, 5",
            "delivery_interval": "18-21",
        },
        headers={"Idempotency-Key": retry},
    )
    assert bad.status_code == 422
    good = await client.post("/api/v1/orders", json=ORDER, headers={"Idempotency-Key": retry})
    assert good.status_code == 201, good.text


async def test_idempotency_key_passes_cors_preflight(client) -> None:
    # Заголовок не из «простых»: без него в allow_headers браузер не отправит заказ вовсе
    origin = get_settings().cors_origins[0]
    response = await client.options(
        "/api/v1/orders",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,idempotency-key",
        },
    )
    assert response.status_code == 200
    assert "idempotency-key" in response.headers["access-control-allow-headers"].lower()
