"""Страница «О нас»: совместимость контента и путь редактор → публичный API."""

import pytest
from pydantic import ValidationError

from app.models import PageKey
from app.schemas.pages import AboutContent
from app.seed import PAGE_CONTENT


def test_about_accepts_existing_content_and_rejects_broken_blocks():
    content = AboutContent.model_validate(PAGE_CONTENT[PageKey.ABOUT])
    assert content.main_text
    # Тексты макета — в сиде (010b); команда — одна Елена, пустых карточек нет
    assert content.timeline and len(content.timeline) == 4
    assert [member.name for member in content.team or []] == ["Елена Абрикосова"]
    with pytest.raises(ValidationError):
        AboutContent(timeline=[{"year": "нет", "title": "Этап", "text": "Текст"}])
    with pytest.raises(ValidationError):
        AboutContent(team=[{"name": "Елена"}])


async def test_about_editor_round_trip(client, admin_headers):
    endpoint = "/api/v1/admin/pages/about"
    original = (await client.get(endpoint, headers=admin_headers)).json()
    original.pop("page_key")
    added = {
        "biography": ["История кондитерской"],
        "timeline": [{"year": "2021", "title": "Открытие", "text": "Кофейня"}],
        "workflow": [{"title": "Каждое утро", "text": "Собираем пирожные"}],
        "team": [{"name": "Елена", "role": "Кондитер", "image_key": "pages/portrait.webp"}],
        "workshop_image_key": "pages/kitchen.webp",
    }
    try:
        response = await client.put(
            endpoint,
            headers=admin_headers,
            json={**original, "content": {**original["content"], **added}},
        )
        assert response.status_code == 200, response.text
        public = await client.get("/api/v1/pages/about")
        assert public.status_code == 200
        body = public.json()["content"]
        for key in ("biography", "timeline", "workflow", "workshop_image_key"):
            assert body[key] == added[key]
        assert body["team"][0]["image_key"] == "pages/portrait.webp"
        assert body["main_text"] == original["content"]["main_text"]
    finally:
        response = await client.put(endpoint, headers=admin_headers, json=original)
        assert response.status_code == 200, response.text
