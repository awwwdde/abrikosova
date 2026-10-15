"""Админка: валидация новых полей товара, галереи и контактов."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.admin import GalleryItemIn, PageContentIn, ProductIn


def _variant(**overrides) -> dict:
    return {
        "label": "1,2 кг",
        "price": "2600",
        "weight_grams": 1200,
        "portions_min": 10,
        "portions_max": 12,
    } | overrides


def _product(variant: dict | None = None, **overrides) -> dict:
    return {
        "name": "Торт",
        "slug": "test-tort",
        "category_id": 1,
        "subcategory_id": 1,
        "description": "Описание",
        "composition": "Мука, мёд",
        "variants": [_variant(**(variant or {}))],
    } | overrides


@pytest.mark.parametrize(
    ("low", "high"),
    [(10, None), (None, 12), (12, 10)],
    ids=["only-min", "only-max", "inverted"],
)
def test_portions_must_be_a_valid_range(low, high) -> None:
    with pytest.raises(ValidationError):
        ProductIn(**_product({"portions_min": low, "portions_max": high}))


def test_single_portion_is_equal_bounds() -> None:
    product = ProductIn(**_product({"portions_min": 1, "portions_max": 1}))
    variant = product.variants[0]
    assert (variant.portions_min, variant.portions_max) == (1, 1)


def test_no_portions_is_allowed() -> None:
    ProductIn(**_product({"portions_min": None, "portions_max": None}))


def test_tags_are_deduplicated() -> None:
    product = ProductIn(**_product(occasions=["tea", "tea", "birthday"]))
    assert product.occasions == ["tea", "birthday"]


def test_kids_is_a_recipient_not_an_occasion() -> None:
    """005a: «детский» у товара — «Кому: для детей», повод `kids` остался галерее."""
    with pytest.raises(ValidationError, match="Кому"):
        ProductIn(**_product(occasions=["kids"]))
    assert ProductIn(**_product(recipients=["kids"])).recipients == ["kids"]


def test_product_needs_an_active_variant() -> None:
    with pytest.raises(ValidationError):
        ProductIn(**_product(variants=[]))
    with pytest.raises(ValidationError, match="хотя бы один"):
        ProductIn(**_product({"is_active": False}))


def test_macros_cannot_exceed_100_grams() -> None:
    with pytest.raises(ValidationError):
        ProductIn(**_product(fats="120"))


def test_gallery_month_is_normalized_to_first_day() -> None:
    item = GalleryItemIn(image_key="gallery/x.webp", caption="Торт", made_in=date(2026, 5, 17))
    assert item.made_in == date(2026, 5, 1)


@pytest.mark.parametrize(
    "url",
    ["javascript:alert(1)", "http://t.me/abrikosova", 'https://t.me/a"onmouseover="x'],
)
def test_contact_links_must_be_plain_https(url) -> None:
    """Ссылка уходит в href на каждой странице — javascript: там был бы XSS."""
    with pytest.raises(ValidationError):
        PageContentIn(telegram_url=url)


def test_yandex_rating_is_bounded() -> None:
    with pytest.raises(ValidationError):
        PageContentIn(yandex_rating="5.5")


async def test_subcategory_must_belong_to_category(client, catalog, admin_headers) -> None:
    payload = _product(
        slug=f"{catalog.category_slug}-mismatch",
        category_id=catalog.category_id,
        subcategory_id=catalog.foreign_subcategory_id,
    )
    response = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert response.status_code == 422


async def test_duplicate_slug_is_conflict_not_server_error(client, catalog, admin_headers) -> None:
    payload = _product(
        slug=f"{catalog.category_slug}-dup",
        category_id=catalog.category_id,
        subcategory_id=catalog.subcategory_id,
        occasions=["birthday"],
        recipients=["kids"],
        dietary=["gluten_free"],
        lead_time_days=2,
    )
    first = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert first.status_code == 201, first.text
    assert first.json()["recipients"] == ["kids"]

    second = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert second.status_code == 409
    # Текст ошибки PostgreSQL (имена таблиц, значения) наружу не уходит
    assert "duplicate key" not in second.text


async def test_product_without_weight_is_created(client, catalog, admin_headers) -> None:
    """Сертификат или услуга: веса нет — и выдумывать его не нужно."""
    payload = _product(
        {"label": "Стандарт", "weight_grams": None, "portions_min": None, "portions_max": None},
        slug=f"{catalog.category_slug}-no-weight",
        category_id=catalog.category_id,
        subcategory_id=catalog.subcategory_id,
    )
    response = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert response.status_code == 201, response.text
    assert response.json()["variants"][0]["weight_grams"] is None

    public = await client.get(f"/api/v1/catalog/products/{payload['slug']}")
    assert public.status_code == 200
    assert public.json()["variants"][0]["weight_grams"] is None


def test_zero_weight_is_rejected() -> None:
    """Пустой вес — «нет веса», а ноль — ошибка ввода."""
    with pytest.raises(ValidationError):
        ProductIn(**_product({"weight_grams": 0}))


async def test_zero_weight_is_422_in_admin(client, catalog, admin_headers) -> None:
    payload = _product(
        {"weight_grams": 0},
        slug=f"{catalog.category_slug}-zero-weight",
        category_id=catalog.category_id,
        subcategory_id=catalog.subcategory_id,
    )
    response = await client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert response.status_code == 422
