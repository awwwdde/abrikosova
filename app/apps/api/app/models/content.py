"""Галерея, отзывы и редактируемый контент статичных страниц."""

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import Occasion, PageKey, ReviewSource
from app.models.mixins import CreatedAtMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.catalog import Product


class GalleryItem(Base, CreatedAtMixin):
    """«Примеры работ» — фото + подпись, без цены и категории (01-data-model.md, раздел 7)."""

    __tablename__ = "gallery_items"
    __table_args__ = (
        CheckConstraint("tiers IS NULL OR tiers BETWEEN 1 AND 10", name="ck_gallery_tiers"),
        CheckConstraint("guests IS NULL OR guests >= 1", name="ck_gallery_guests"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Подпись работы по PDF «Этап 1» (решение 04 «Портфолио с подписями»):
    # повод, ярусы, число гостей и месяц. Подписи важнее количества работ —
    # по ним невеста понимает «уровень мой или нет», а мама — «попадём ли в тему».
    occasion: Mapped[Occasion | None] = mapped_column(
        SAEnum(Occasion, name="occasion", values_callable=lambda e: [i.value for i in e]),
        index=True,
    )
    tiers: Mapped[int | None] = mapped_column(Integer)
    guests: Mapped[int | None] = mapped_column(Integer)
    # Месяц выполнения работы. Хранится датой (первое число месяца), а не строкой
    # «май 2026»: так по нему можно сортировать, а формат вывода — забота фронтенда.
    made_in: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Review(Base, CreatedAtMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_review_rating"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Отзыв может относиться к конкретной позиции (блок 06 карточки товара)
    # или быть общим — тогда он показывается только на главной. При удалении
    # товара отзыв не теряется, а становится общим.
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), index=True
    )
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

    product: Mapped["Product | None"] = relationship(back_populates="reviews")


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

    # Поля страницы «Контакты» хранятся отдельно от JSON — используются в JSON-LD,
    # шапке и футере на всех страницах сайта
    address: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    work_hours_weekdays: Mapped[str | None] = mapped_column(String(100))
    work_hours_weekend: Mapped[str | None] = mapped_column(String(100))
    delivery_hours: Mapped[str | None] = mapped_column(String(100))
    map_embed_code: Mapped[str | None] = mapped_column(Text)
    # Внешний рейтинг вместо самописных отзывов (PDF «Этап 1», раздел 11):
    # «рейтинг Яндекса в шапке». Вводится в админке вручную — парсить карточку
    # организации Яндекс не разрешает, а официального API рейтинга нет.
    yandex_rating: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))
    yandex_reviews_count: Mapped[int | None] = mapped_column(Integer)
    yandex_maps_url: Mapped[str | None] = mapped_column(String(500))
    # Канал быстрой связи: кнопка «Спросить в Telegram» в карточке и в шапке.
    # Это ссылка на чат, а не бот заказа — заказ живёт в корзине.
    telegram_url: Mapped[str | None] = mapped_column(String(500))
