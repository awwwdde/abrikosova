"""Контент «Тортов на заказ» со схемой (014, находка 11 из 004b): блок меню шапки."""

import pytest
from pydantic import ValidationError

from app.models import PageKey
from app.schemas.pages import CustomCakesContent
from app.seed import PAGE_CONTENT


def test_seed_matches_schema_and_menu():
    content = CustomCakesContent.model_validate(PAGE_CONTENT[PageKey.CUSTOM_CAKES])
    assert content.header_menu is not None
    assert [card.label for card in content.header_menu.cards] == [
        "Свадьба",
        "День рождения",
        "Детский",
        "Юбилей и корпоратив",
    ]
    assert content.stages  # этапы, которые читает «Торт под событие» на главной


def test_menu_rejects_broken_cards():
    card = {"occasion": "wedding", "label": "Свадьба"}
    with pytest.raises(ValidationError):  # неизвестный повод — 422, а не битая ссылка
        CustomCakesContent(header_menu={"cards": [{**card, "occasion": "party"}]})
    with pytest.raises(ValidationError):  # в макете четыре карточки
        CustomCakesContent(header_menu={"cards": [card] * 5})
    with pytest.raises(ValidationError):  # опечатка в ключе не сохраняется молча
        CustomCakesContent.model_validate({"header_menu": {"fact": "от 2 кг"}})


async def test_public_page_has_menu(client):
    response = await client.get("/api/v1/pages/custom_cakes")
    assert response.status_code == 200
    menu = response.json()["content"]["header_menu"]
    assert menu["facts"].startswith("от 2 кг")
    assert len(menu["cards"]) == 4
