"""Перенос адресов старого сайта и данные для sitemap.xml (задание 012)."""

import uuid

from sqlalchemy import update

from app.core.db import SessionLocal
from app.models import LegacyKind, LegacyRedirect, Product, SubCategory

RESOLVE = "/api/v1/legacy/resolve"


async def _add(**fields) -> str:
    """Строка соответствия; old_key уникальный, чтобы тесты не мешали друг другу."""
    old_key = fields.pop("old_key", f"old-{uuid.uuid4().hex[:8]}")
    async with SessionLocal() as session:
        session.add(LegacyRedirect(old_key=old_key, **fields))
        await session.commit()
    return old_key


async def test_old_product_slug_leads_to_current_slug(client, catalog) -> None:
    old = await _add(kind=LegacyKind.PRODUCT, product_id=catalog.products["kids-cake"])

    response = await client.get(RESOLVE, params={"kind": "product", "key": old})
    assert response.status_code == 200
    location = response.json()["location"]
    assert location.startswith("/product/kids-cake-")

    # Товар переименовали — редирект идёт на новый слаг без правки таблицы
    async with SessionLocal() as session:
        await session.execute(
            update(Product)
            .where(Product.id == catalog.products["kids-cake"])
            .values(slug=f"renamed-{uuid.uuid4().hex[:8]}")
        )
        await session.commit()
    response = await client.get(RESOLVE, params={"kind": "product", "key": old})
    assert response.json()["location"].startswith("/product/renamed-")


async def test_hidden_product_has_no_target(client, catalog) -> None:
    old = await _add(kind=LegacyKind.PRODUCT, product_id=catalog.products["gf-cookie"])
    async with SessionLocal() as session:
        await session.execute(
            update(Product)
            .where(Product.id == catalog.products["gf-cookie"])
            .values(is_active=False)
        )
        await session.commit()

    # Скрытый товар отдал бы 404 — сайт возьмёт запасной вариант
    response = await client.get(RESOLVE, params={"kind": "product", "key": old})
    assert response.status_code == 404


async def test_old_subcategory_id_leads_to_category_path(client, catalog) -> None:
    old = await _add(
        kind=LegacyKind.SUBCATEGORY, old_key="17", subcategory_id=catalog.subcategory_id
    )
    response = await client.get(RESOLVE, params={"kind": "subcategory", "key": old})
    assert response.status_code == 200
    assert response.json()["location"] == f"/catalog/{catalog.category_slug}/sub-" + (
        catalog.category_slug.removeprefix("test-")
    )

    async with SessionLocal() as session:
        await session.execute(
            update(SubCategory)
            .where(SubCategory.id == catalog.subcategory_id)
            .values(is_active=False)
        )
        await session.commit()
    response = await client.get(RESOLVE, params={"kind": "subcategory", "key": old})
    assert response.status_code == 404


async def test_media_returns_storage_key_and_unknown_is_404(client) -> None:
    old = await _add(
        kind=LegacyKind.MEDIA,
        old_key=f"products/2025/11/02/{uuid.uuid4().hex[:6]}.jpg",
        media_key="products/1/abc.webp",
    )
    response = await client.get(RESOLVE, params={"kind": "media", "key": old})
    assert response.json() == {"location": None, "media_key": "products/1/abc.webp"}

    response = await client.get(RESOLVE, params={"kind": "media", "key": "nope.jpg"})
    assert response.status_code == 404
    response = await client.get(RESOLVE, params={"kind": "unknown", "key": "x"})
    assert response.status_code == 422


async def test_sitemap_lists_only_visible(client, catalog) -> None:
    async with SessionLocal() as session:
        await session.execute(
            update(Product)
            .where(Product.id == catalog.products["gift-box"])
            .values(is_active=False)
        )
        await session.commit()

    response = await client.get("/api/v1/catalog/sitemap")
    assert response.status_code == 200
    data = response.json()

    slugs = {product["slug"] for product in data["products"]}
    suffix = catalog.category_slug.removeprefix("test-")
    assert f"kids-cake-{suffix}" in slugs
    # Снят с сайта — в карте его нет; «нет в наличии» — есть (страница открывается)
    assert f"gift-box-{suffix}" not in slugs
    assert all(product["updated_at"] for product in data["products"])

    category = next(c for c in data["categories"] if c["slug"] == catalog.category_slug)
    assert category["subcategories"] == [{"slug": f"sub-{suffix}"}]


async def test_contacts_geo_is_validated(client, admin_headers) -> None:
    """Координаты для Bakery.geo (012): из админки, с проверкой диапазона."""
    url = "/api/v1/admin/pages/contacts"
    page = (await client.get(url, headers=admin_headers)).json()
    original = {key: value for key, value in page.items() if key != "page_key"}
    try:
        good = {
            **original,
            "content": {
                **original["content"],
                "geo": {
                    "latitude": 55.7155,
                    "longitude": 37.4339,
                },
            },
        }
        response = await client.put(url, json=good, headers=admin_headers)
        assert response.status_code == 200, response.text
        public = (await client.get("/api/v1/pages/contacts")).json()
        assert public["content"]["geo"] == {"latitude": 55.7155, "longitude": 37.4339}

        bad = {
            **original,
            "content": {
                **original["content"],
                "geo": {
                    "latitude": 95,
                    "longitude": 37.4,
                },
            },
        }
        response = await client.put(url, json=bad, headers=admin_headers)
        assert response.status_code == 422
    finally:
        await client.put(url, json=original, headers=admin_headers)
