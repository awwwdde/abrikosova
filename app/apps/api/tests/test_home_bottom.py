"""Низ главной (задание 004b): отзывы с Яндекса и проверка content страниц."""

import io

import pytest
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import delete

from app.core.db import SessionLocal
from app.models import PageKey, Review
from app.schemas.pages import ContactsContent, HomeContent, check_links
from app.seed import PAGE_CONTENT
from app.services import storage

YANDEX_URL = "https://yandex.ru/maps/org/abrikosova/reviews"


async def test_yandex_review_carries_source_and_link(client, admin_headers) -> None:
    created = await client.post(
        "/api/v1/admin/reviews",
        json={
            "author_name": "Тест Яндекс",
            "text": "Отзыв с карт",
            "rating": 5,
            "is_published": True,
            "source": "yandex",
            "external_url": YANDEX_URL,
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    review_id = created.json()["id"]
    try:
        assert created.json()["external_url"] == YANDEX_URL

        body = (
            await client.get("/api/v1/reviews", params={"source": "yandex", "page_size": 60})
        ).json()
        ours = next(r for r in body["items"] if r["id"] == review_id)
        assert (ours["source"], ours["external_url"]) == ("yandex", YANDEX_URL)
        # В выборке по источнику нет отзывов, добавленных вручную
        assert {r["source"] for r in body["items"]} == {"yandex"}

        manual = (
            await client.get("/api/v1/reviews", params={"source": "manual", "page_size": 60})
        ).json()
        assert review_id not in {r["id"] for r in manual["items"]}
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(Review).where(Review.id == review_id))
            await session.commit()


@pytest.mark.parametrize(
    "url", ["javascript:alert(1)", "http://yandex.ru/maps", "//yandex.ru/maps"]
)
async def test_review_link_must_be_https(client, admin_headers, url) -> None:
    response = await client.post(
        "/api/v1/admin/reviews",
        json={"author_name": "Х", "text": "Т", "source": "yandex", "external_url": url},
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_seed_content_matches_schemas() -> None:
    """Сид — договорённость о форме content: он обязан проходить схемы."""
    HomeContent.model_validate(PAGE_CONTENT[PageKey.HOME])
    ContactsContent.model_validate(PAGE_CONTENT[PageKey.CONTACTS])


@pytest.mark.parametrize(
    "href", ["javascript:alert(1)", "JavaScript:alert(1)", "//evil.example", "data:text/html,x"]
)
def test_home_cta_rejects_unsafe_links(href) -> None:
    content = PAGE_CONTENT[PageKey.HOME] | {
        "hero": PAGE_CONTENT[PageKey.HOME]["hero"] | {"cta": {"label": "Витрина", "href": href}}
    }
    with pytest.raises(ValidationError):
        HomeContent.model_validate(content)


def test_home_cta_accepts_site_paths_and_https() -> None:
    for href in ("/catalog?availability=today", "/custom-cakes#fillings", "https://t.me/x"):
        hero = PAGE_CONTENT[PageKey.HOME]["hero"] | {"cta": {"label": "Кнопка", "href": href}}
        HomeContent.model_validate({"hero": hero})


def test_unknown_block_is_rejected() -> None:
    """Опечатка в ключе — 422, а не блок, который молча не появился на сайте."""
    with pytest.raises(ValidationError):
        HomeContent.model_validate({"fillings_intr": ["Текст"]})


def test_free_json_links_are_checked() -> None:
    errors = check_links(
        {"blocks": [{"title": "ok", "href": "/about"}, {"cta_url": "javascript:alert(1)"}]}
    )
    assert [e["loc"] for e in errors] == [("blocks", 1, "cta_url")]


@pytest.mark.parametrize(
    ("page_key", "content", "loc"),
    [
        (
            "contacts",
            {"socials": [{"label": "ВКонтакте", "href": "javascript:alert(1)"}]},
            ["body", "content", "socials", 0, "href"],
        ),
        (
            "contacts",
            {"route_url": "javascript:alert(1)"},
            ["body", "content", "route_url"],
        ),
        (
            "home",
            {
                "hero": {
                    "title_lines": [],
                    "subtitle_lines": [],
                    "cta": {"label": "Х", "href": "javascript:x"},
                }
            },  # noqa: E501
            ["body", "content", "hero", "cta", "href"],
        ),
        (
            "about",
            {"principles": [{"title": "Х", "href": "javascript:alert(1)"}]},
            ["body", "content", "principles", 0, "href"],
        ),
    ],
    ids=["contacts-socials", "contacts-route", "home-cta", "about-free-json"],
)
async def test_admin_rejects_javascript_links_in_content(
    client, admin_headers, page_key, content, loc
) -> None:
    before = (await client.get(f"/api/v1/pages/{page_key}")).json()

    response = await client.put(
        f"/api/v1/admin/pages/{page_key}", json={"content": content}, headers=admin_headers
    )

    assert response.status_code == 422, response.text
    assert loc in [error["loc"] for error in response.json()["detail"]]
    # Страница не изменилась
    assert (await client.get(f"/api/v1/pages/{page_key}")).json() == before


@pytest.mark.parametrize("page_key", ["home", "contacts"])
async def test_saved_content_round_trips(client, admin_headers, page_key) -> None:
    """Контент, который админка получила, сохраняется обратно без 422 —
    схема не ломает редактор страниц."""
    page = (await client.get(f"/api/v1/admin/pages/{page_key}", headers=admin_headers)).json()
    payload = {key: value for key, value in page.items() if key != "page_key"}

    response = await client.put(
        f"/api/v1/admin/pages/{page_key}", json=payload, headers=admin_headers
    )

    assert response.status_code == 200, response.text
    assert response.json()["content"] == page["content"]
    public = await client.get(f"/api/v1/pages/{page_key}")
    assert public.status_code == 200


async def test_pages_prefix_upload_is_public(client, admin_headers) -> None:
    """Портрет и интерьер грузятся в `pages/` — префикс открыт на чтение."""
    assert "pages" in storage.PUBLIC_PREFIXES

    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), "#842124").save(buffer, format="PNG")
    response = await client.post(
        "/api/v1/admin/uploads",
        params={"prefix": "pages"},
        files={"file": ("portrait.png", buffer.getvalue(), "image/png")},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    key = response.json()["storage_key"]
    try:
        assert key.startswith("pages/")
    finally:
        await storage.delete_image(key)
