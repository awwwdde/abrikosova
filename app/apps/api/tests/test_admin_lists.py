"""Каталог, разделы, заявки и отзывы в новом стиле (задание 011e)."""

import uuid
from datetime import date

from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.models import AuditLogEntry, Category, ConsultationRequest, Review, SubCategory
from app.models.enums import ConsultationSource, Occasion


async def _entries(entity: str, entity_id: int, action: str | None = None) -> list[AuditLogEntry]:
    async with SessionLocal() as session:
        query = select(AuditLogEntry).where(
            AuditLogEntry.entity == entity, AuditLogEntry.entity_id == str(entity_id)
        )
        if action:
            query = query.where(AuditLogEntry.action == action)
        return list((await session.scalars(query.order_by(AuditLogEntry.id))).all())


# --- Каталог ---


async def test_bulk_action_logs_diff_per_product(client, admin_headers, catalog) -> None:
    ids = [catalog.products["kids-cake"], catalog.products["gf-cookie"]]
    response = await client.post(
        "/api/v1/admin/products/bulk", json={"ids": ids, "action": "hide"}, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"updated": 2}
    for product_id in ids:
        [entry] = await _entries("product", product_id, "update")
        assert entry.details == {"changes": {"is_active": [True, False]}}

    # Повтор ничего не меняет — и в журнал ничего не пишет
    again = await client.post(
        "/api/v1/admin/products/bulk", json={"ids": ids, "action": "hide"}, headers=admin_headers
    )
    assert again.json() == {"updated": 0}
    assert len(await _entries("product", ids[0], "update")) == 1

    # «Снять с наличия»: gift-box уже снят, меняется только печенье
    response = await client.post(
        "/api/v1/admin/products/bulk",
        json={"ids": [catalog.products["gift-box"], ids[1]], "action": "unavailable"},
        headers=admin_headers,
    )
    assert response.json() == {"updated": 1}

    missing = await client.post(
        "/api/v1/admin/products/bulk",
        json={"ids": [999999], "action": "show"},
        headers=admin_headers,
    )
    assert missing.status_code == 404


async def test_product_list_filters(client, admin_headers, catalog) -> None:
    async def names(**params) -> set[str]:
        response = await client.get(
            "/api/v1/admin/products",
            params={"category_id": catalog.category_id, **params},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        return {item["name"] for item in response.json()["items"]}

    assert await names() == {"kids-cake", "gf-cookie", "gift-box"}
    assert await names(availability="out") == {"gift-box"}
    assert await names(availability="preorder") == {"kids-cake"}
    assert await names(availability="today") == {"gf-cookie"}
    assert await names(search="COOK") == {"gf-cookie"}
    assert await names(search="%") == set()
    assert await names(subcategory_id=catalog.subcategory_id) == {
        "kids-cake",
        "gf-cookie",
        "gift-box",
    }
    item = (
        await client.get(
            "/api/v1/admin/products",
            params={"category_id": catalog.category_id, "search": "gf"},
            headers=admin_headers,
        )
    ).json()["items"][0]
    assert item["category_name"].startswith("Тест")
    assert item["subcategory_name"] == "Тестовая"


async def test_non_empty_section_cannot_be_deleted(client, admin_headers, catalog) -> None:
    response = await client.delete(
        f"/api/v1/admin/categories/{catalog.category_id}", headers=admin_headers
    )
    assert response.status_code == 409
    assert "3 товара" in response.json()["detail"]
    response = await client.delete(
        f"/api/v1/admin/subcategories/{catalog.subcategory_id}", headers=admin_headers
    )
    assert response.status_code == 409

    # Пустой раздел (у «чужой» категории фикстуры товаров нет) удаляется
    async with SessionLocal() as session:
        empty = await session.scalar(
            select(SubCategory).where(SubCategory.id == catalog.foreign_subcategory_id)
        )
        empty_category_id = empty.category_id
    response = await client.delete(
        f"/api/v1/admin/categories/{empty_category_id}", headers=admin_headers
    )
    assert response.status_code == 204


async def test_reorder_categories(client, admin_headers) -> None:
    suffix = uuid.uuid4().hex[:6]
    async with SessionLocal() as session:
        # Порядок проверяем на всём списке разделов базы
        ids = list((await session.scalars(select(Category.id).order_by(Category.id))).all())
        extra = Category(name=f"Порядок {suffix}", slug=f"order-{suffix}")
        session.add(extra)
        await session.commit()
        ids.append(extra.id)
    try:
        reversed_ids = list(reversed(ids))
        response = await client.put(
            "/api/v1/admin/categories/order", json={"ids": reversed_ids}, headers=admin_headers
        )
        assert response.status_code == 204, response.text
        async with SessionLocal() as session:
            order = list(
                (await session.scalars(select(Category.id).order_by(Category.order))).all()
            )
        assert order == reversed_ids
        stale = await client.put(
            "/api/v1/admin/categories/order", json={"ids": [*ids, 999999]}, headers=admin_headers
        )
        assert stale.status_code == 409
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(Category).where(Category.id == extra.id))
            await session.commit()


# --- Заявки ---


async def _request(**fields) -> int:
    async with SessionLocal() as session:
        values = {
            "name": "Ирина Заявкина",
            "phone": "+79000000011",
            "consent_pd": True,
            "source": ConsultationSource.CUSTOM_CAKE,
            "occasion": Occasion.WEDDING,
            "event_date": date(2031, 6, 1),
            "guests_count": 60,
        }
        row = ConsultationRequest(**(values | fields))
        session.add(row)
        await session.commit()
        return row.id


async def test_consultation_flow_and_view(client, admin_headers) -> None:
    request_id = await _request()
    try:
        url = f"/api/v1/admin/consultations/{request_id}"

        detail = await client.get(url, headers=admin_headers)
        assert detail.status_code == 200
        assert detail.json()["guests_count"] == 60
        assert len(await _entries("consultation", request_id, "view")) == 1

        async def move(status: str):
            return await client.patch(url, json={"status": status}, headers=admin_headers)

        assert (await move("contacted")).status_code == 200
        back = await move("new")
        assert back.status_code == 409
        assert "в новые" in back.json()["detail"]
        assert (await move("completed")).json()["status"] == "completed"
        closed = await move("contacted")
        assert closed.status_code == 409
        assert "закрыта" in closed.json()["detail"]

        page = (
            await client.get(
                "/api/v1/admin/consultations",
                params={"tab": "closed", "occasion": "wedding"},
                headers=admin_headers,
            )
        ).json()
        assert any(item["id"] == request_id for item in page["items"])
        assert page["counts"]["closed"] >= 1
        assert page["counts"]["all"] >= page["counts"]["closed"]
    finally:
        async with SessionLocal() as session:
            await session.execute(
                delete(ConsultationRequest).where(ConsultationRequest.id == request_id)
            )
            await session.commit()


async def test_consultation_date_filter(client, admin_headers) -> None:
    inside = await _request(event_date=date(2031, 7, 10))
    outside = await _request(event_date=date(2031, 7, 20))
    try:
        page = (
            await client.get(
                "/api/v1/admin/consultations",
                params={"date_from": "2031-07-01", "date_to": "2031-07-15"},
                headers=admin_headers,
            )
        ).json()
        ids = {item["id"] for item in page["items"]}
        assert inside in ids and outside not in ids
    finally:
        async with SessionLocal() as session:
            await session.execute(
                delete(ConsultationRequest).where(ConsultationRequest.id.in_([inside, outside]))
            )
            await session.commit()


# --- Отзывы ---


async def test_review_publish_and_date(client, admin_headers, catalog) -> None:
    response = await client.post(
        "/api/v1/admin/reviews",
        json={
            "author_name": "Анна Котова",
            "text": "Медовик просто тает",
            "rating": 5,
            "source": "yandex",
            "external_url": "https://yandex.ru/maps/org/1/reviews",
            "review_date": "2025-12-03",
            "product_id": catalog.products["kids-cake"],
        },
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    review = response.json()
    assert review["created_at"].startswith("2025-12-03")
    review_id = review["id"]
    try:
        pending = (
            await client.get(
                "/api/v1/admin/reviews",
                params={"tab": "pending", "product_id": catalog.products["kids-cake"]},
                headers=admin_headers,
            )
        ).json()
        assert [item["id"] for item in pending["items"]] == [review_id]
        assert pending["items"][0]["product_name"] == "kids-cake"
        assert pending["counts"] == {"pending": 1, "published": 0, "all": 1}

        published = await client.patch(
            f"/api/v1/admin/reviews/{review_id}",
            json={"is_published": True, "review_date": "2025-11-28"},
            headers=admin_headers,
        )
        assert published.status_code == 200, published.text
        assert published.json()["is_published"] is True
        assert published.json()["created_at"].startswith("2025-11-28")

        entry = (await _entries("review", review_id, "update"))[-1]
        assert entry.details["changes"]["is_published"] == [False, True]
        assert entry.details["changes"]["created_at"][1].startswith("2025-11-28")
        assert "author_name" not in str(entry.details)

        counts = (
            await client.get(
                "/api/v1/admin/reviews",
                params={"product_id": catalog.products["kids-cake"]},
                headers=admin_headers,
            )
        ).json()["counts"]
        assert counts == {"pending": 0, "published": 1, "all": 1}
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(Review).where(Review.id == review_id))
            await session.commit()
