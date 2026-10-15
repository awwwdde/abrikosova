"""Сброс кэша по тегам (014): правка страницы сбрасывает тег её ключа, правка
каталога — тег `categories` (мега-меню шапки читает разделы на каждой странице)."""

from app.services import revalidate


def test_cache_tags_rules():
    assert revalidate.cache_tags(["/", "/catalog", "/sitemap.xml"]) == ["categories"]
    assert revalidate.cache_tags(["/product/medovik"], ["contacts"]) == ["contacts"]
    assert revalidate.cache_tags(["/catalog/torty"], ["contacts"]) == ["categories", "contacts"]
    assert revalidate.cache_tags(["/catalogue"]) == []


async def test_page_save_sends_page_tag(client, admin_headers, monkeypatch):
    calls: list[tuple[list[str], list[str] | None]] = []
    monkeypatch.setattr(
        revalidate, "revalidate_paths", lambda paths, tags=None: calls.append((paths, tags))
    )
    endpoint = "/api/v1/admin/pages/contacts"
    page = (await client.get(endpoint, headers=admin_headers)).json()
    page.pop("page_key")
    response = await client.put(endpoint, headers=admin_headers, json=page)
    assert response.status_code == 200, response.text
    # Телефон в мобильном меню и строки доставки на каждом товаре — тег contacts
    assert calls and calls[-1][1] == ["contacts"]
    assert "/contacts" in calls[-1][0]


def test_custom_cakes_paths_send_their_tag():
    """008b: страница «Тортов на заказ» читает API с тегом custom_cakes."""
    assert revalidate.cache_tags(["/", "/custom-cakes"]) == ["custom_cakes"]
    assert revalidate.cache_tags(["/custom-cakes/belyy-s-pionami"]) == ["custom_cakes"]
    assert revalidate.cache_tags(["/custom-cakes-old"]) == []


async def test_cake_settings_drop_custom_cakes_cache(
    client, admin_headers, clean_settings, monkeypatch
):
    """Цены за кг меняют «от X ₽» у всех дизайнов — сбрасываем /custom-cakes (008b)."""
    calls: list[list[str]] = []
    monkeypatch.setattr(
        revalidate, "revalidate_paths", lambda paths, tags=None: calls.append(paths)
    )
    settings = (await client.get("/api/v1/admin/settings", headers=admin_headers)).json()
    response = await client.put(
        "/api/v1/admin/settings",
        headers=admin_headers,
        json=settings | {"large_order_total": 12_000},
    )
    assert response.status_code == 200, response.text
    assert ["/custom-cakes"] not in calls
    response = await client.put(
        "/api/v1/admin/settings",
        headers=admin_headers,
        json=settings | {"cake_price_classic": 3_300},
    )
    assert response.status_code == 200, response.text
    assert ["/custom-cakes"] in calls
