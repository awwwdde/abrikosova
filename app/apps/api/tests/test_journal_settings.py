"""Имена сотрудников, журнал «было → стало», события сайта, настройки (задание 011c)."""

import json
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import delete, select

from app.core import clock
from app.core.clock import local_today
from app.core.db import SessionLocal
from app.models import AuditLogEntry, ConsultationRequest, Order
from app.models.enums import DeliveryMethod, OrderStatus
from app.schemas.admin import ProductIn, VariantIn
from app.services import dashboard, journal

NBSP = " "
ORDER = {
    "customer_name": "Марина Покупательница",
    "customer_phone": "+7 900 765-43-21",
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


async def _entries(entity: str, entity_id: str | int) -> list[AuditLogEntry]:
    async with SessionLocal() as session:
        rows = await session.scalars(
            select(AuditLogEntry)
            .where(AuditLogEntry.entity == entity, AuditLogEntry.entity_id == str(entity_id))
            .order_by(AuditLogEntry.id)
        )
        return list(rows.all())


async def _product_payload(client, headers, product_id: int) -> dict:
    data = (await client.get(f"/api/v1/admin/products/{product_id}", headers=headers)).json()
    payload = {key: data[key] for key in ProductIn.model_fields if key in data}
    # in_orders — только в ответе, форма его не отправляет
    payload["variants"] = [
        {key: v[key] for key in VariantIn.model_fields if key in v} for v in data["variants"]
    ]
    return payload


# --- 2. Дифф «было → стало» ---


async def test_update_logs_only_changed_whitelisted_values(client, admin_headers, catalog) -> None:
    product_id = catalog.products["gf-cookie"]
    payload = await _product_payload(client, admin_headers, product_id)

    # Без правок — запись не создаётся
    response = await client.put(
        f"/api/v1/admin/products/{product_id}", json=payload, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert await _entries("product", product_id) == []

    variant = payload["variants"][0]
    changed = payload | {
        "is_available": False,
        "description": "Новое описание с секретом",
        "variants": [variant | {"price": "420.00", "size_note": "секретный размер"}],
    }
    response = await client.put(
        f"/api/v1/admin/products/{product_id}", json=changed, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    [entry] = await _entries("product", product_id)
    assert entry.details == {
        "changes": {"is_available": [True, False]},
        # Вне белого списка — только имя поля, без значения
        "fields": ["description"],
        # Цена — у варианта (005a): «было → стало» с подписью варианта
        "variants": [
            {"label": "180 г", "changes": {"price": ["350.00", "420.00"]}, "fields": ["size_note"]}
        ],
    }
    assert "секрет" not in json.dumps(entry.details, ensure_ascii=False)


async def test_review_publication_logs_flag_but_not_author_or_text(
    client, admin_headers, catalog
) -> None:
    response = await client.post(
        "/api/v1/admin/reviews",
        json={"author_name": "Анна Клиентова", "text": "Очень вкусно", "rating": 5},
        headers=admin_headers,
    )
    review_id = response.json()["id"]
    response = await client.patch(
        f"/api/v1/admin/reviews/{review_id}",
        json={"is_published": True, "author_name": "Анна К."},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    entry = (await _entries("review", review_id))[-1]
    assert entry.details == {
        "changes": {"is_published": [False, True]},
        "fields": ["author_name"],
    }
    await client.delete(f"/api/v1/admin/reviews/{review_id}", headers=admin_headers)


# --- 2. События сайта ---


async def test_public_order_creates_site_event_without_personal_data(client, catalog) -> None:
    response = await client.post(
        "/api/v1/cart/items", json={"variant_id": catalog.variants["gf-cookie"]}
    )
    assert response.status_code == 201
    response = await client.post("/api/v1/orders", json=ORDER)
    assert response.status_code == 201, response.text
    number = response.json()["order_number"]

    async with SessionLocal() as session:
        order = await session.scalar(select(Order).where(Order.order_number == number))
        entry = await session.scalar(
            select(AuditLogEntry).where(
                AuditLogEntry.action == "site_order", AuditLogEntry.entity_id == str(order.id)
            )
        )
    assert entry is not None
    assert entry.actor_id is None and entry.actor_email is None and entry.ip is None
    # Номер, сумма и способ получения — и ничего из новых полей 007a (почта, получатель…)
    assert entry.details == {"number": number, "total": "350.00", "delivery_method": "pickup"}
    dumped = json.dumps(entry.details, ensure_ascii=False)
    assert "Марина" not in dumped and "765" not in dumped
    assert journal.describe(entry, {}) == f"новый заказ №{NBSP}{number} на 350{NBSP}₽"


async def test_public_request_creates_site_event_without_name_and_phone(client) -> None:
    event_date = local_today() + timedelta(days=44)
    response = await client.post(
        "/api/v1/consultations",
        data={
            "name": "Ирина Заявкина",
            "phone": "+79005556677",
            "email": "irina.zayavkina@mail.ru",
            "consent_pd": "true",
            "occasion": "wedding",
            "event_date": event_date.isoformat(),
            "guests_count": "60",
        },
    )
    assert response.status_code == 201, response.text
    request_id = response.json()["id"]
    try:
        [entry] = await _entries("consultation", request_id)
        assert entry.action == "site_consultation" and entry.actor_id is None
        dumped = json.dumps(entry.details, ensure_ascii=False)
        # Ни имени, ни телефона, ни почты (008a)
        assert "Ирина" not in dumped and "5556677" not in dumped
        assert "zayavkina" not in dumped
        month = journal.MONTHS[event_date.month - 1]
        number = response.json()["number"]
        assert journal.describe(entry, {}) == (
            f"новая заявка {number}: свадьба, {event_date.day}{NBSP}{month}"
        )
    finally:
        async with SessionLocal() as session:
            await session.execute(
                delete(ConsultationRequest).where(ConsultationRequest.id == request_id)
            )
            await session.commit()


# --- 2. Тексты ленты: по ветке на каждый тип ---


def _entry(entity: str, action: str, entity_id: str | None = "7", **details) -> AuditLogEntry:
    return AuditLogEntry(entity=entity, action=action, entity_id=entity_id, details=details or None)


PRODUCT = {"product": {"7": "Прага"}}
FILLING = {"filling": {"7": "Ваниль"}}


@pytest.mark.parametrize(
    ("entry", "names", "text"),
    [
        (
            _entry("product", "update", changes={"price": ["5000.00", "5200.00"]}),
            PRODUCT,
            f"цена товара «Прага»: 5{NBSP}000{NBSP}₽ → 5{NBSP}200{NBSP}₽",
        ),
        (
            _entry("product", "update", changes={"is_active": [True, False]}),
            {"product": {"7": "Медовик"}},
            "товар «Медовик» скрыт с сайта",
        ),
        (
            _entry("product", "update", changes={"is_active": [False, True]}),
            PRODUCT,
            "товар «Прага» снова на сайте",
        ),
        (
            _entry("product", "update", changes={"is_available": [True, False]}),
            PRODUCT,
            "товар «Прага» снят с наличия",
        ),
        (
            _entry("product", "update", changes={"is_available": [False, True]}),
            PRODUCT,
            "товар «Прага» снова в наличии",
        ),
        (
            _entry("product", "update", changes={"lead_time_days": [2, 3]}),
            PRODUCT,
            f"срок изготовления товара «Прага»: 2 → 3{NBSP}дня",
        ),
        (
            _entry("product", "update", changes={"weight_grams": [1200, 1500]}),
            PRODUCT,
            f"вес товара «Прага»: 1200{NBSP}г → 1500{NBSP}г",
        ),
        (
            _entry("product", "update", changes={"name": ["Прага", "Прага классическая"]}),
            {"product": {"7": "Прага классическая"}},
            "товар «Прага» переименован в «Прага классическая»",
        ),
        (
            _entry("product", "update", changes={"order": [1, 2]}),
            PRODUCT,
            "изменён порядок: товар «Прага»",
        ),
        (
            _entry("product", "update", fields=["description", "composition"]),
            PRODUCT,
            "изменён товар «Прага»: описание, состав",
        ),
        (
            _entry("filling", "update", changes={"price_per_kg": ["2000.00", "2200.00"]}),
            FILLING,
            f"цена начинки «Ваниль»: 2{NBSP}000{NBSP}₽/кг → 2{NBSP}200{NBSP}₽/кг",
        ),
        (
            _entry("filling", "update", changes={"is_active": [True, False]}),
            FILLING,
            "начинка «Ваниль» скрыта с сайта",
        ),
        (
            _entry("gallery_item", "create"),
            {"gallery_item": {"7": "Белый с пионами"}},
            "добавлена работа «Белый с пионами»",
        ),
        (_entry("category", "delete"), {}, f"удалён раздел №{NBSP}7"),
        (_entry("product", "upload_image"), PRODUCT, "загружено фото товара «Прага»"),
        (
            _entry("order", "update_status", status="confirmed"),
            {"order": {"7": "0936"}},
            f"заказ №{NBSP}0936: статус «Подтверждён»",
        ),
        (
            _entry("consultation", "update_status", status="contacted"),
            {},
            f"заявка №{NBSP}7: статус «В работе»",
        ),
        (
            _entry("review", "update", changes={"is_published": [False, True]}),
            {},
            f"опубликован отзыв №{NBSP}7",
        ),
        (
            _entry("review", "update", changes={"is_published": [True, False]}),
            {},
            f"отзыв №{NBSP}7 снят с сайта",
        ),
        (_entry("page", "update", entity_id="home"), {}, "изменена страница «Главная»"),
        # 006b: у «Документов» и «Работ» человеческие подписи, а не ключ страницы
        (_entry("page", "update", entity_id="legal"), {}, "изменена страница «Документы»"),
        (_entry("page", "update", entity_id="gallery"), {}, "изменена страница «Работы»"),
        (
            _entry("site", "site_order", number="0944", total="1400.00"),
            {},
            f"новый заказ №{NBSP}0944 на 1{NBSP}400{NBSP}₽",
        ),
        (
            _entry(
                "consultation", "site_consultation", occasion="wedding", event_date="2026-11-14"
            ),
            {},
            f"новая заявка: свадьба, 14{NBSP}ноября",
        ),
        (
            _entry("consultation", "site_consultation", source="contact_page"),
            {},
            "новый вопрос со страницы «Контакты»",
        ),
        (
            _entry("admin_user", "create"),
            {"admin_user": {"7": "Ольга Тихонова"}},
            "добавлен сотрудник «Ольга Тихонова»",
        ),
        (
            _entry("admin_user", "update", fields=["password"]),
            {"admin_user": {"7": "Ольга Тихонова"}},
            "сотруднику «Ольга Тихонова» задан новый пароль",
        ),
        (
            _entry("admin_user", "update_profile", changes={"name": ["Owner", "Елена"]}),
            {},
            "имя в профиле: «Owner» → «Елена»",
        ),
        (
            _entry(
                "settings", "update", entity_id=None, changes={"large_order_total": [10000, 12000]}
            ),
            {},
            f"порог крупного заказа: 10{NBSP}000{NBSP}₽ → 12{NBSP}000{NBSP}₽",
        ),
        (_entry("auth", "login_locked"), {}, "вход заблокирован после 5 неудачных попыток"),
        (_entry("backup", "restore"), {}, "восстановлена резервная копия"),
    ],
)
def test_journal_text(entry, names, text) -> None:
    result = journal.describe(entry, names)
    assert result == text
    assert "—" not in result.replace("→", "")


def test_short_name() -> None:
    assert journal.short_name("Ольга Тихонова") == "Ольга Т."
    assert journal.short_name("Елена") == "Елена"


# --- 1. Имена и лента ---


async def test_feed_shows_names_roles_and_site(client, admin_headers, catalog) -> None:
    product_id = catalog.products["gift-box"]
    payload = await _product_payload(client, admin_headers, product_id)
    await client.put(
        f"/api/v1/admin/products/{product_id}",
        json=payload | {"variants": [payload["variants"][0] | {"price": "1700.00"}]},
        headers=admin_headers,
    )
    await client.post("/api/v1/cart/items", json={"variant_id": catalog.variants["gf-cookie"]})
    await client.post("/api/v1/orders", json=ORDER)

    feed = (await client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()["activity"]
    mine = next(item for item in feed if "gift-box" in item["text"])
    assert mine["is_you"] is True
    assert mine["actor"] == "Тест В."
    assert mine["actor_role"] is None  # у владельца роль не пишется
    site = next(item for item in feed if item["is_site"])
    assert site["actor"] == "Сайт" and site["text"].startswith("новый заказ")


async def test_profile_name_change(client, admin_headers) -> None:
    response = await client.patch(
        "/api/v1/auth/me",
        json={"name": "  Елена Абрикосова  "},
        headers=admin_headers | {"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Елена Абрикосова"
    me = (await client.get("/api/v1/auth/me", headers=admin_headers)).json()
    assert me["name"] == "Елена Абрикосова"

    empty = await client.patch(
        "/api/v1/auth/me",
        json={"name": "   "},
        headers=admin_headers | {"Origin": "http://localhost:3000"},
    )
    assert empty.status_code == 422


async def test_owner_sets_staff_name(client, admin_headers) -> None:
    response = await client.post(
        "/api/v1/admin/users",
        json={
            "email": f"olga-{uuid.uuid4().hex[:6]}@example.com",
            "name": "Ольга Тихонова",
            "password": "Малина на рассвете у Гжатской",
            "role": "manager",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    user = response.json()
    assert user["name"] == "Ольга Тихонова"
    response = await client.patch(
        f"/api/v1/admin/users/{user['id']}", json={"name": "Ольга Т."}, headers=admin_headers
    )
    assert response.json()["name"] == "Ольга Т."
    entry = (await _entries("admin_user", user["id"]))[-1]
    assert entry.details["changes"] == {"name": ["Ольга Тихонова", "Ольга Т."]}

    missing = await client.post(
        "/api/v1/admin/users",
        json={"email": "noname@example.com", "password": "Малина на рассвете у Гжатской"},
        headers=admin_headers,
    )
    assert missing.status_code == 422


async def test_refresh_without_cookie_says_login_required(client) -> None:
    response = await client.post(
        "/api/v1/auth/refresh", headers={"Origin": "http://localhost:3000"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Требуется вход"


# --- 2. Раздел «Журнал» ---


async def test_journal_filters_and_security_tab(client, admin_headers, catalog) -> None:
    await client.post("/api/v1/cart/items", json={"variant_id": catalog.variants["gf-cookie"]})
    await client.post("/api/v1/orders", json=ORDER)
    await client.post(
        "/api/v1/auth/login",
        json={"email": f"nobody-{uuid.uuid4().hex[:6]}@example.com", "password": "неверный"},
        headers={"Origin": "http://localhost:3000"},
    )

    site = (
        await client.get("/api/v1/admin/journal", params={"actor": "site"}, headers=admin_headers)
    ).json()
    assert site["total"] >= 1
    assert all(item["is_site"] for item in site["items"])

    orders = (
        await client.get("/api/v1/admin/journal", params={"kind": "orders"}, headers=admin_headers)
    ).json()
    assert all("заказ" in item["text"] for item in orders["items"])

    security = (
        await client.get("/api/v1/admin/journal", params={"tab": "security"}, headers=admin_headers)
    ).json()
    texts = [item["text"] for item in security["items"]]
    assert "неудачная попытка входа" in texts
    failed = next(item for item in security["items"] if item["text"] == "неудачная попытка входа")
    assert failed["actor"] == "Неизвестный адрес"
    assert failed["meta"]

    actions = (await client.get("/api/v1/admin/journal", headers=admin_headers)).json()
    assert not any(item["text"] == "неудачная попытка входа" for item in actions["items"])

    paged = (
        await client.get(
            "/api/v1/admin/journal", params={"page": 1, "page_size": 1}, headers=admin_headers
        )
    ).json()
    assert len(paged["items"]) == 1 and paged["page_size"] == 1


async def test_manager_gets_403_on_owner_sections(client, manager_headers) -> None:
    for path in ("/api/v1/admin/settings", "/api/v1/admin/journal"):
        assert (await client.get(path, headers=manager_headers)).status_code == 403
    response = await client.put(
        "/api/v1/admin/settings",
        json={"large_order_total": 1, "large_event_guests": 1},
        headers=manager_headers,
    )
    assert response.status_code == 403


# --- 3. Настройки ---

MSK = ZoneInfo("Europe/Moscow")
TODAY = date(2031, 6, 10)


async def test_settings_thresholds_drive_large_orders(
    client, admin_headers, catalog, clean_settings, monkeypatch
) -> None:
    now = datetime(2031, 6, 10, 12, tzinfo=MSK)
    monkeypatch.setattr(clock, "local_now", lambda: now)
    monkeypatch.setattr(dashboard, "local_now", lambda: now)
    async with SessionLocal() as session:
        order = Order(
            order_number=f"T{uuid.uuid4().hex[:12]}",
            customer_name="Тест",
            customer_phone="+7 900 000-00-00",
            delivery_method=DeliveryMethod.PICKUP,
            consent_pd=True,
            subtotal=Decimal("6000"),
            total_price=Decimal("6000"),
            status=OrderStatus.CONFIRMED,
            desired_date=TODAY + timedelta(days=2),
            created_at=datetime(2031, 6, 9, 10, tzinfo=UTC),
        )
        order.items.append(catalog.order_item("gf-cookie", 1, "1"))
        session.add(order)
        await session.commit()

    async def large_day() -> bool:
        data = (await client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
        day = (TODAY + timedelta(days=2)).isoformat()
        return next(d for d in data["orders_by_day"]["upcoming"] if d["day"] == day)["has_large"]

    defaults = (await client.get("/api/v1/admin/settings", headers=admin_headers)).json()
    assert defaults == {
        "large_order_total": 10000,
        "large_event_guests": 30,
        "inscription_price": 300,
        "slot_cutoff_minutes": 60,
        # Доставка и часы ответа (007a)
        "delivery_price": 500,
        "free_delivery_from": 5000,
        "delivery_note": (
            "Доставляем в пределах МКАД. За МКАД стоимость рассчитаем отдельно при подтверждении"
        ),
        "delivery_intervals": ["09-12", "12-15", "15-18"],
        "work_hours_start": 9,
        "work_hours_end": 21,
        # Торты на заказ (008a)
        "cake_price_classic": 3200,
        "cake_price_cream_drawing": 3800,
        "cake_price_multi_tier": 4500,
        "cake_min_weight_kg": 2.0,
        "cake_lead_days": 5,
        "cake_grams_per_guest": 150,
        "cake_tiers": [
            {"from_kg": 0.0, "tiers": 1},
            {"from_kg": 3.5, "tiers": 2},
            {"from_kg": 6.0, "tiers": 3},
        ],
        "cake_extras": [
            {"name": "Свечи", "price": 200, "price_from": True},
            {"name": "Топпер с надписью", "price": 600, "price_from": True},
            {"name": "Открытка", "price": 150, "price_from": False},
        ],
    }
    assert await large_day() is False

    response = await client.put(
        "/api/v1/admin/settings",
        json={"large_order_total": 5000, "large_event_guests": 30},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert await large_day() is True
    calendar = (
        await client.get(
            "/api/v1/admin/dashboard/calendar", params={"month": "2031-06"}, headers=admin_headers
        )
    ).json()
    assert any(
        event["label"].startswith(f"Заказ № {order.order_number}") for event in calendar["large"]
    )

    async with SessionLocal() as session:
        entry = await session.scalar(
            select(AuditLogEntry)
            .where(AuditLogEntry.entity == "settings")
            .order_by(AuditLogEntry.id.desc())
        )
    assert entry.details == {"changes": {"large_order_total": [10000, 5000]}}


@pytest.mark.parametrize(
    "payload",
    [
        {"large_order_total": 0, "large_event_guests": 30},
        {"large_order_total": 10000, "large_event_guests": -1},
        {"large_order_total": 10000.5, "large_event_guests": 30},
        {"large_order_total": "10000", "large_event_guests": 30},
    ],
)
async def test_settings_validation(client, admin_headers, clean_settings, payload) -> None:
    response = await client.put("/api/v1/admin/settings", json=payload, headers=admin_headers)
    assert response.status_code == 422
