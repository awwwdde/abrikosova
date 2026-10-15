"""Сквозные фильтры каталога (PDF «Этап 1», раздел 12; макет 02-filters-open.png).

Главное, что здесь фиксируется, — логика объединения условий: повод, «кому»
и порции работают через ИЛИ, ограничения в питании — через И. Перепутать их —
значит показать человеку с аллергией товар, который удовлетворяет только одному
из его ограничений. И счётчики у значений (фасеты) должны считать ровно то,
что покажет список после выбора.

Цена, вес и порции — у вариантов товара (005a): товар подходит под фильтр,
если подходит любой его активный вариант.
"""

from decimal import Decimal

import pytest

from app.core.db import SessionLocal
from app.models import Product, ProductVariant

URL = "/api/v1/catalog/products"
FILTERS = "/api/v1/catalog/filters"


async def _names(client, catalog, *params: tuple[str, str]) -> set[str]:
    response = await client.get(URL, params=[("category", catalog.category_slug), *params])
    assert response.status_code == 200, response.text
    return {item["name"] for item in response.json()["items"]}


async def _facets(client, catalog, *params: tuple[str, str]) -> dict[str, dict[str, int]]:
    response = await client.get(FILTERS, params=[("category", catalog.category_slug), *params])
    assert response.status_code == 200, response.text
    body = response.json()
    return {
        group: {option["value"]: option["count"] for option in body[group]}
        for group in ("availability", "dietary", "recipients", "occasions", "portions")
    } | {"total": body["total"]}


@pytest.fixture
async def cookie_box(catalog):
    """Второй вариант у печенья: «коробка» 1200 ₽ на 10–12 порций. Теперь
    gf-cookie — товар с двумя весами, как «Медовик целый»."""
    async with SessionLocal() as session:
        session.add(
            ProductVariant(
                product_id=catalog.products["gf-cookie"],
                label="коробка",
                price=Decimal("1200"),
                weight_grams=720,
                portions_min=10,
                portions_max=12,
                order=1,
            )
        )
        await session.commit()


async def test_occasions_are_combined_with_or(client, catalog) -> None:
    assert await _names(client, catalog, ("occasion", "birthday")) == {"kids-cake"}
    assert await _names(client, catalog, ("occasion", "birthday"), ("occasion", "tea")) == {
        "kids-cake",
        "gf-cookie",
    }


async def test_kids_is_a_recipient_in_catalog(client, catalog) -> None:
    """005a: «детский» — это «Кому: для детей»; повод kids каталог не принимает."""
    assert await _names(client, catalog, ("recipient", "kids")) == {"kids-cake"}
    response = await client.get(URL, params={"occasion": "kids"})
    assert response.status_code == 422


async def test_dietary_tags_are_combined_with_and(client, catalog) -> None:
    both = await _names(client, catalog, ("dietary", "gluten_free"), ("dietary", "lactose_free"))
    assert both == {"gf-cookie"}

    # Ни один товар не без глютена И со сниженным сахаром одновременно
    assert (
        await _names(client, catalog, ("dietary", "gluten_free"), ("dietary", "low_sugar")) == set()
    )


async def test_portions_buckets_match_by_range_overlap(client, catalog) -> None:
    assert await _names(client, catalog, ("portions", "up_to_4")) == {"gf-cookie"}
    assert await _names(client, catalog, ("portions", "8_15")) == {"kids-cake"}
    # 12–15 порций в «больше 15» не попадает
    assert await _names(client, catalog, ("portions", "over_15")) == set()
    # Товар без порций не попадает ни в одну корзину
    assert "gift-box" not in await _names(
        client, catalog, ("portions", "up_to_4"), ("portions", "over_15")
    )


async def test_portions_match_any_active_variant(client, catalog, cookie_box) -> None:
    """Печенье 3–4 порции и коробка 10–12: товар есть и в «до 4», и в «8–15»."""
    assert await _names(client, catalog, ("portions", "8_15")) == {"kids-cake", "gf-cookie"}
    assert "gf-cookie" in await _names(client, catalog, ("portions", "up_to_4"))

    # Выключенный вариант в фильтр не попадает
    async with SessionLocal() as session:
        variant = await session.get(ProductVariant, catalog.variants["gf-cookie"])
        variant.is_active = False
        await session.commit()
    assert await _names(client, catalog, ("portions", "up_to_4")) == set()


async def test_availability_today_excludes_preorder_and_unavailable(client, catalog) -> None:
    assert await _names(client, catalog, ("availability", "today")) == {"gf-cookie"}
    assert await _names(client, catalog, ("availability", "preorder")) == {"kids-cake"}
    assert len(await _names(client, catalog, ("availability", "any"))) == 3


async def test_price_range_matches_any_variant(client, catalog, cookie_box) -> None:
    names = await _names(client, catalog, ("price_min", "1000"), ("price_max", "2000"))
    # gift-box 1600 и коробка печенья 1200
    assert names == {"gift-box", "gf-cookie"}


async def test_inverted_price_range_is_rejected(client, catalog) -> None:
    response = await client.get(URL, params={"price_min": "500", "price_max": "100"})
    assert response.status_code == 422


async def test_unknown_filter_value_is_rejected(client) -> None:
    response = await client.get(URL, params={"occasion": "halloween"})
    assert response.status_code == 422


async def test_name_sort_is_gone(client) -> None:
    """«По названию» в макете нет — значение больше не принимается."""
    response = await client.get(URL, params={"sort": "name"})
    assert response.status_code == 422


async def test_list_item_answers_size_question(client, catalog, cookie_box) -> None:
    """Варианты с весом и порциями видны прямо в сетке — это первый вопрос покупателя."""
    response = await client.get(
        URL, params={"category": catalog.category_slug, "sort": "price_desc"}
    )
    items = response.json()["items"]
    first = items[0]

    assert first["name"] == "kids-cake"
    assert first["price_from"] == "3800.00"
    assert first["has_variants"] is False
    [variant] = first["variants"]
    assert variant["weight_grams"] == 1500
    assert (variant["portions_min"], variant["portions_max"]) == (12, 15)
    assert first["lead_time_days"] == 3
    assert first["dietary"] == ["low_sugar"]
    assert first["recipients"] == ["kids"]

    cookie = next(item for item in items if item["name"] == "gf-cookie")
    # «от 350 ₽»: цена — минимальная среди вариантов, первый — вариант по умолчанию
    assert cookie["price_from"] == "350.00"
    assert cookie["has_variants"] is True
    assert [v["label"] for v in cookie["variants"]] == ["180 г", "коробка"]


async def test_price_sort_uses_price_from(client, catalog, cookie_box) -> None:
    """Сортировка по цене — по минимальной цене вариантов: коробка за 1200 ₽
    не поднимает печенье над набором за 1600 ₽."""
    response = await client.get(
        URL, params={"category": catalog.category_slug, "sort": "price_asc"}
    )
    assert [i["name"] for i in response.json()["items"]] == ["gf-cookie", "gift-box", "kids-cake"]


async def test_today_first_is_default_sort(client, catalog) -> None:
    """По умолчанию — «Сначала готовое сегодня»: в наличии и без срока изготовления.
    По `order` торт под заказ стоит первым, но выдача начинается с печенья."""
    async with SessionLocal() as session:
        for slug, order in (("kids-cake", 0), ("gift-box", 1), ("gf-cookie", 2)):
            product = await session.get(Product, catalog.products[slug])
            product.order = order
        await session.commit()

    default = await client.get(URL, params={"category": catalog.category_slug})
    explicit = await client.get(
        URL, params={"category": catalog.category_slug, "sort": "today_first"}
    )
    names = [i["name"] for i in default.json()["items"]]
    # gift-box снят с наличия — он не «готовое сегодня», хоть срок у него 0
    assert names == ["gf-cookie", "kids-cake", "gift-box"]
    assert [i["name"] for i in explicit.json()["items"]] == names


async def test_filters_reference(client, catalog) -> None:
    response = await client.get(FILTERS, params={"category": catalog.category_slug})
    assert response.status_code == 200
    body = response.json()

    # Поводы каталога — как в макете, без «детского»
    assert [o["value"] for o in body["occasions"]] == ["birthday", "wedding", "corporate", "tea"]
    assert [o["label"] for o in body["recipients"]] == ["Для неё", "Для него", "Для детей"]
    assert [o["label"] for o in body["availability"]] == [
        "Любой срок",
        "Можно забрать сегодня",
        "Под заказ",
    ]
    assert body["portions"][-1]["label"] == "Больше 15 порций"
    assert all(o["label"] for o in body["dietary"])
    assert body["price"] == {"min": "350.00", "max": "3800.00"}
    assert body["total"] == 3


async def test_facet_counts_without_selection(client, catalog) -> None:
    facets = await _facets(client, catalog)
    assert facets["availability"] == {"any": 3, "today": 1, "preorder": 1}
    assert facets["dietary"] == {"gluten_free": 1, "lactose_free": 1, "low_sugar": 1}
    assert facets["recipients"] == {"her": 0, "him": 0, "kids": 1}
    assert facets["occasions"] == {"birthday": 1, "wedding": 0, "corporate": 1, "tea": 1}
    # «Больше 15 порций 0» — значение будет неактивным
    assert facets["portions"] == {"up_to_4": 1, "4_8": 1, "8_15": 1, "over_15": 0}


async def test_or_group_ignores_its_own_selection(client, catalog) -> None:
    """Выбран повод «к чаю». Счётчик «день рождения» — сколько станет, если
    ДОБАВИТЬ его: ИЛИ расширяет выдачу, поэтому 1 (торт), а не 0."""
    facets = await _facets(client, catalog, ("occasion", "tea"))
    assert facets["total"] == 1
    assert facets["occasions"]["birthday"] == 1
    assert facets["occasions"]["tea"] == 1
    # Другие группы считаются по выбору «к чаю»: из него в наличии только печенье
    assert facets["availability"] == {"any": 1, "today": 1, "preorder": 0}
    assert facets["recipients"]["kids"] == 0


async def test_and_group_counts_with_its_own_selection(client, catalog) -> None:
    """Выбрано «без глютена». «Без лактозы» добавляется через И: печенье
    подходит под оба — 1. «Сниженный сахар» вместе с «без глютена» — 0."""
    facets = await _facets(client, catalog, ("dietary", "gluten_free"))
    assert facets["dietary"] == {"gluten_free": 1, "lactose_free": 1, "low_sugar": 0}


async def test_radio_group_replaces_its_own_selection(client, catalog) -> None:
    """«Срок» — радио: при выбранном «сегодня» счётчик «под заказ» — сколько
    будет, если переключиться, а не пересечение (которое всегда 0)."""
    facets = await _facets(client, catalog, ("availability", "today"))
    assert facets["availability"] == {"any": 3, "today": 1, "preorder": 1}
    assert facets["total"] == 1


async def test_facet_count_matches_list(client, catalog, cookie_box) -> None:
    """Счётчик значения — ровно то, что покажет список после выбора."""
    params = [("dietary", "gluten_free")]
    facets = await _facets(client, catalog, *params)
    for bucket, count in facets["portions"].items():
        names = await _names(client, catalog, *params, ("portions", bucket))
        assert len(names) == count, bucket
