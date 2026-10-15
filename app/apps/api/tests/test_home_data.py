"""Данные главной по макету (задание 004): подпись карточки и подписи работ."""

import pytest
from pydantic import ValidationError
from sqlalchemy import delete

from app.core.db import SessionLocal
from app.models import GalleryItem
from app.schemas.admin import GalleryItemIn, ProductIn


async def test_list_item_carries_subcategory_and_card_label(client, catalog, admin_headers) -> None:
    """Строка «классика · 100 г» собирается из подкатегории или card_label."""
    payload = {
        "name": "Абрикосовый пирог",
        "slug": f"{catalog.category_slug}-pie",
        "category_id": catalog.category_id,
        "subcategory_id": catalog.subcategory_id,
        "description": "Описание",
        "composition": "мука, абрикос",
        "variants": [{"label": "1,2 кг", "price": "3400", "weight_grams": 1200}],
        "card_label": "фирменная позиция",
    }
    created = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert created.status_code == 201, created.text
    assert created.json()["card_label"] == "фирменная позиция"

    body = (
        await client.get(
            "/api/v1/catalog/products",
            params={"category": catalog.category_slug, "page_size": 60},
        )
    ).json()
    by_slug = {item["slug"]: item for item in body["items"]}

    pie = by_slug[payload["slug"]]
    assert pie["card_label"] == "фирменная позиция"
    assert pie["subcategory"] == {"name": "Тестовая", "slug": pie["subcategory"]["slug"]}

    # Без подписи — пусто, фронтенд возьмёт название подкатегории
    cookie = next(item for slug, item in by_slug.items() if slug.startswith("gf-cookie"))
    assert cookie["card_label"] is None
    assert cookie["subcategory"]["name"] == "Тестовая"


def test_card_label_is_limited_to_50_chars() -> None:
    with pytest.raises(ValidationError):
        ProductIn(
            name="Торт",
            slug="tort",
            category_id=1,
            subcategory_id=1,
            description="d",
            composition="c",
            variants=[{"label": "100 г", "price": "100"}],
            card_label="х" * 51,
        )


async def test_gallery_returns_weight_and_detail_image(client, admin_headers) -> None:
    payload = {
        "image_key": "gallery/test-main.webp",
        "detail_image_key": "gallery/test-detail.webp",
        "caption": "test-home-work",
        "occasion": "wedding",
        "tiers": 3,
        "weight_grams": 6000,
        "guests": 45,
        "made_in": "2025-08-01",
    }
    created = await client.post("/api/v1/admin/gallery", json=payload, headers=admin_headers)
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    try:
        body = (await client.get("/api/v1/gallery", params={"page_size": 60})).json()
        item = next(i for i in body["items"] if i["id"] == item_id)
        assert item["weight_grams"] == 6000
        assert item["detail_image_key"] == "gallery/test-detail.webp"
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(GalleryItem).where(GalleryItem.id == item_id))
            await session.commit()


@pytest.mark.parametrize("weight", [0, -5])
def test_gallery_weight_must_be_positive(weight) -> None:
    with pytest.raises(ValidationError):
        GalleryItemIn(image_key="gallery/x.webp", caption="Торт", weight_grams=weight)
