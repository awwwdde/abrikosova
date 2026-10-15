"""Страница «Работы» (009): фильтр-группа «Юбилей и корпоратив», «таблетки» с числом
работ, тексты страницы и сид в порядке макета."""

from sqlalchemy import delete

from app.core.db import SessionLocal
from app.models import GalleryItem, Occasion, PageKey
from app.schemas.pages import CustomCakesContent, GalleryContent
from app.seed import GALLERY, PAGE_CONTENT


async def _facets(client) -> dict[str, int]:
    response = await client.get("/api/v1/gallery/occasions")
    assert response.status_code == 200, response.text
    return {facet["value"]: facet["count"] for facet in response.json()}


async def test_anniversary_corporate_filter_and_facets(client) -> None:
    before = await _facets(client)
    async with SessionLocal() as session:
        items = [
            GalleryItem(
                image_key="t/a.webp", caption="t-anniversary", occasion=Occasion.ANNIVERSARY
            ),
            GalleryItem(image_key="t/c.webp", caption="t-corporate", occasion=Occasion.CORPORATE),
            GalleryItem(image_key="t/w.webp", caption="t-wedding", occasion=Occasion.WEDDING),
            # Скрытая работа не попадает ни в список, ни в счётчик
            GalleryItem(
                image_key="t/h.webp",
                caption="t-hidden",
                occasion=Occasion.ANNIVERSARY,
                is_active=False,
            ),
        ]
        session.add_all(items)
        await session.commit()
        ids = [i.id for i in items]

    try:
        body = (
            await client.get(
                "/api/v1/gallery", params={"occasion": "anniversary_corporate", "page_size": 60}
            )
        ).json()
        captions = {i["caption"] for i in body["items"]}
        assert {"t-anniversary", "t-corporate"} <= captions
        assert not {"t-wedding", "t-hidden"} & captions
        anniversary = next(i for i in body["items"] if i["caption"] == "t-anniversary")
        assert anniversary["occasion"] == "anniversary"

        # Повод каталога, а не значение фильтра, — 422: адрес с ?occasion=corporate
        # не должен молча показывать половину группы
        assert (
            await client.get("/api/v1/gallery", params={"occasion": "corporate"})
        ).status_code == 422

        after = await _facets(client)
        assert list(after) == ["wedding", "birthday", "kids", "anniversary_corporate"]
        assert after["anniversary_corporate"] - before["anniversary_corporate"] == 2
        assert after["wedding"] - before["wedding"] == 1
        assert after["birthday"] == before["birthday"]
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(GalleryItem).where(GalleryItem.id.in_(ids)))
            await session.commit()


async def test_gallery_page_content(client) -> None:
    response = await client.get("/api/v1/pages/gallery")
    assert response.status_code == 200, response.text
    content = response.json()["content"]
    assert content["intro"].startswith("Свадьбы, дни рождения и юбилеи")
    assert content["cta"]["title"] == "Не нашли похожий?"


def test_seed_matches_works_mockup() -> None:
    GalleryContent.model_validate(PAGE_CONTENT[PageKey.GALLERY])
    # Первые 12 — карточки works.png в том же порядке; срез — у «Шоколада и вишни»
    mockup = [work.caption for work in GALLERY[:12]]
    assert mockup[:3] == ["Белый с пионами", "Шоколад и вишня", "Лисёнок"]
    assert mockup[9:] == ["Медовый с цифрой", "Строгий белый", "Нюдовый с сухоцветами"]
    assert GALLERY[1].detail_image
    assert GALLERY[9].occasion is Occasion.ANNIVERSARY
    assert len(GALLERY) > 12  # есть что показать по «Показать ещё»
    # Карточка мега-меню «Юбилей и корпоратив» ведёт на тот же фильтр
    menu = CustomCakesContent.model_validate(PAGE_CONTENT[PageKey.CUSTOM_CAKES]).header_menu
    assert menu is not None
    assert "anniversary_corporate" in {card.occasion for card in menu.cards}


async def test_gallery_editor_round_trip(client, admin_headers) -> None:
    """Вкладка «Работы» в «Страницах сайта»: правка видна в публичном API."""
    endpoint = "/api/v1/admin/pages/gallery"
    original = (await client.get(endpoint, headers=admin_headers)).json()
    original.pop("page_key")
    changed = {"intro": "Новый текст", "cta": {"title": "Нет похожего?", "text": "Напишите нам"}}
    try:
        response = await client.put(
            endpoint, headers=admin_headers, json={**original, "content": changed}
        )
        assert response.status_code == 200, response.text
        public = (await client.get("/api/v1/pages/gallery")).json()["content"]
        assert public == changed
        # Чужое поле (например, из «Тортов на заказ») схема «Работ» не пропускает
        broken = {**original, "content": {**changed, "stages": []}}
        assert (await client.put(endpoint, headers=admin_headers, json=broken)).status_code == 422
    finally:
        response = await client.put(endpoint, headers=admin_headers, json=original)
        assert response.status_code == 200, response.text
