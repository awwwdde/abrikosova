"""Заявка на торт под событие и отзывы в карточке товара."""

from datetime import timedelta

from sqlalchemy import delete, select

from app.core.clock import local_today
from app.core.db import SessionLocal
from app.models import ConsultationRequest, GalleryItem, Occasion, Review

CONSULTATION = "/api/v1/custom-cakes/consultation"


def _form(**overrides) -> dict[str, str]:
    return {"name": "Аня", "phone": "+79001234567", "consent_pd": "true"} | overrides


async def test_consultation_saves_event_details(client) -> None:
    event_date = (local_today() + timedelta(days=60)).isoformat()
    response = await client.post(
        CONSULTATION,
        data=_form(occasion="wedding", event_date=event_date, guests_count="45"),
    )
    assert response.status_code == 201, response.text

    async with SessionLocal() as session:
        row = await session.get(ConsultationRequest, response.json()["id"])
        assert row is not None
        assert row.occasion is Occasion.WEDDING
        assert row.event_date.isoformat() == event_date
        assert row.guests_count == 45
        assert row.reference_image_key is None
        await session.delete(row)
        await session.commit()


async def test_consultation_rejects_past_event_date(client) -> None:
    yesterday = (local_today() - timedelta(days=1)).isoformat()
    response = await client.post(CONSULTATION, data=_form(event_date=yesterday))
    assert response.status_code == 422


async def test_consultation_rejects_non_image_reference(client) -> None:
    """Файл проверяется по содержимому, а не по расширению и Content-Type."""
    response = await client.post(
        CONSULTATION,
        data=_form(),
        files={"reference": ("photo.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert response.status_code == 400


async def test_consultation_rejects_unknown_fields(client) -> None:
    response = await client.post(CONSULTATION, data=_form(is_vip="true"))
    assert response.status_code == 422


async def test_consultation_still_requires_consent(client) -> None:
    response = await client.post(CONSULTATION, data=_form(consent_pd="false"))
    assert response.status_code == 422


async def test_product_card_shows_only_its_published_reviews(client, catalog) -> None:
    cake_id = catalog.products["kids-cake"]
    async with SessionLocal() as session:
        session.add_all(
            [
                Review(
                    product_id=cake_id,
                    author_name="Мама",
                    text="Дети в восторге",
                    rating=5,
                    is_published=True,
                ),
                Review(
                    product_id=cake_id,
                    author_name="Скрытый",
                    text="На модерации",
                    is_published=False,
                ),
                Review(
                    product_id=catalog.products["gf-cookie"],
                    author_name="Другой",
                    text="Про печенье",
                    is_published=True,
                ),
            ]
        )
        await session.commit()

    slug = (
        await client.get(
            "/api/v1/catalog/products",
            params={"category": catalog.category_slug, "occasion": "kids"},
        )
    ).json()["items"][0]["slug"]
    card = (await client.get(f"/api/v1/catalog/products/{slug}")).json()

    assert card["reviews_total"] == 1
    assert [r["author_name"] for r in card["reviews"]] == ["Мама"]
    assert card["reviews"][0]["product"] == {"name": "kids-cake", "slug": slug}

    by_product = (await client.get("/api/v1/reviews", params={"product": slug})).json()
    assert by_product["total"] == 1


async def test_gallery_filter_by_occasion(client) -> None:
    async with SessionLocal() as session:
        items = [
            GalleryItem(
                image_key="t/1.webp",
                caption="test-wedding",
                occasion=Occasion.WEDDING,
                tiers=3,
                guests=60,
            ),
            GalleryItem(image_key="t/2.webp", caption="test-kids", occasion=Occasion.KIDS),
        ]
        session.add_all(items)
        await session.commit()
        ids = [i.id for i in items]

    try:
        body = (
            await client.get("/api/v1/gallery", params={"occasion": "wedding", "page_size": 60})
        ).json()
        captions = {i["caption"] for i in body["items"]}
        assert "test-wedding" in captions
        assert "test-kids" not in captions
        wedding = next(i for i in body["items"] if i["caption"] == "test-wedding")
        assert (wedding["tiers"], wedding["guests"]) == (3, 60)
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(GalleryItem).where(GalleryItem.id.in_(ids)))
            await session.commit()


async def test_deleted_product_keeps_its_reviews_as_general(catalog) -> None:
    """ondelete=SET NULL: отзыв о снятом товаре не пропадает, а становится общим."""
    from app.models import Product

    gift_id = catalog.products["gift-box"]
    async with SessionLocal() as session:
        review = Review(
            product_id=gift_id, author_name="Клиент", text="Отличный набор", is_published=True
        )
        session.add(review)
        await session.commit()
        review_id = review.id

        product = await session.get(Product, gift_id)
        await session.delete(product)
        await session.commit()

        kept = await session.scalar(select(Review).where(Review.id == review_id))
        assert kept is not None and kept.product_id is None
        await session.delete(kept)
        await session.commit()
