"""Сквозные фильтры каталога (PDF «Этап 1», раздел 12).

Главное, что здесь фиксируется, — логика объединения условий:
повод и порции работают через ИЛИ, ограничения в питании — через И.
Перепутать их — значит показать человеку с аллергией товар, который
удовлетворяет только одному из его ограничений.
"""

URL = "/api/v1/catalog/products"


async def _names(client, catalog, *params: tuple[str, str]) -> set[str]:
    response = await client.get(URL, params=[("category", catalog.category_slug), *params])
    assert response.status_code == 200, response.text
    return {item["name"] for item in response.json()["items"]}


async def test_occasions_are_combined_with_or(client, catalog) -> None:
    assert await _names(client, catalog, ("occasion", "kids")) == {"kids-cake"}
    assert await _names(client, catalog, ("occasion", "kids"), ("occasion", "tea")) == {
        "kids-cake",
        "gf-cookie",
    }


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


async def test_availability_today_excludes_preorder_and_unavailable(client, catalog) -> None:
    assert await _names(client, catalog, ("availability", "today")) == {"gf-cookie"}
    assert await _names(client, catalog, ("availability", "preorder")) == {"kids-cake"}


async def test_price_range(client, catalog) -> None:
    names = await _names(client, catalog, ("price_min", "1000"), ("price_max", "2000"))
    assert names == {"gift-box"}


async def test_inverted_price_range_is_rejected(client, catalog) -> None:
    response = await client.get(URL, params={"price_min": "500", "price_max": "100"})
    assert response.status_code == 422


async def test_unknown_filter_value_is_rejected(client) -> None:
    response = await client.get(URL, params={"occasion": "halloween"})
    assert response.status_code == 422


async def test_list_item_answers_size_question(client, catalog) -> None:
    """Вес и порции видны прямо в сетке — это первый вопрос покупателя."""
    response = await client.get(
        URL, params={"category": catalog.category_slug, "sort": "price_desc"}
    )
    first = response.json()["items"][0]

    assert first["name"] == "kids-cake"
    assert first["weight_grams"] == 1500
    assert (first["portions_min"], first["portions_max"]) == (12, 15)
    assert first["lead_time_days"] == 3
    assert first["dietary"] == ["low_sugar"]


async def test_filters_reference(client, catalog) -> None:
    response = await client.get(
        "/api/v1/catalog/filters", params={"category": catalog.category_slug}
    )
    assert response.status_code == 200
    body = response.json()

    assert {o["value"] for o in body["occasions"]} == {
        "birthday",
        "kids",
        "wedding",
        "corporate",
        "tea",
    }
    assert all(o["label"] for o in body["dietary"])
    assert body["price"] == {"min": "350.00", "max": "3800.00"}
