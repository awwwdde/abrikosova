"""Галерея, отзывы и редактируемый контент статичных страниц."""

from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import PageKey, ReviewSource
from app.models.mixins import CreatedAtMixin, TimestampMixin


class GalleryItem(Base, CreatedAtMixin):
    """«Примеры работ» — фото + подпись, без цены и категории (01-data-model.md, раздел 7)."""

    __tablename__ = "gallery_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Review(Base, CreatedAtMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_review_rating"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author_name: Mapped[str] = mapped_column(String(200), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str | None] = mapped_column(String(500))
    rating: Mapped[int | None] = mapped_column(Integer)
    # По умолчанию отзыв скрыт — публикация только через модерацию в админке
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[ReviewSource] = mapped_column(
        SAEnum(ReviewSource, name="review_source", values_callable=lambda e: [i.value for i in e]),
        default=ReviewSource.MANUAL,
        nullable=False,
    )


class PageContent(Base, TimestampMixin):
    """Контент статичных страниц по ключу + JSONB-блоки (01-data-model.md, раздел 12)."""

    __tablename__ = "page_contents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    page_key: Mapped[PageKey] = mapped_column(
        SAEnum(PageKey, name="page_key", values_callable=lambda e: [i.value for i in e]),
        unique=True,
        nullable=False,
    )
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    # Поля страницы «Контакты» хранятся отдельно от JSON — используются в JSON-LD и футере
    address: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    work_hours_weekdays: Mapped[str | None] = mapped_column(String(100))
    work_hours_weekend: Mapped[str | None] = mapped_column(String(100))
    delivery_hours: Mapped[str | None] = mapped_column(String(100))
    map_embed_code: Mapped[str | None] = mapped_column(Text)
