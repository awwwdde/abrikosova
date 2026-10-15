"""Торты на заказ и начинки (01-data-model.md, разделы 5-6; 008a)."""

from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import CakeDecoration, CakeImageRole, DietaryTag, GalleryOccasion


class CustomCake(Base):
    """Дизайн торта на заказ: карточка списка `/custom-cakes` и страница дизайна.

    Цены «от …» в базе нет: она считается из минимума гостей и цены за кг
    оформления (services/custom_cakes.py). Хранимая цена расходилась бы с
    настройками после каждого изменения цен — владелица правила бы её в 11 местах.
    """

    __tablename__ = "custom_cakes"
    __table_args__ = (
        CheckConstraint("tiers >= 1", name="ck_custom_cake_tiers"),
        CheckConstraint("min_guests >= 1", name="ck_custom_cake_min_guests"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # «Белый крем и пионы, нарисованные кремом по бокам ярусов»
    subtitle: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Повод — значение фильтра «Работ» (009): тот же набор «таблеток» на обеих страницах
    occasion: Mapped[GalleryOccasion] = mapped_column(
        SAEnum(
            GalleryOccasion,
            name="gallery_occasion",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
        index=True,
    )
    tiers: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    min_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    decoration: Mapped[CakeDecoration] = mapped_column(
        SAEnum(
            CakeDecoration,
            name="cake_decoration",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
        default=CakeDecoration.CLASSIC,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    images: Mapped[list["CustomCakeImage"]] = relationship(
        back_populates="cake",
        cascade="all, delete-orphan",
        order_by="CustomCakeImage.order",
        lazy="selectin",
    )


class CustomCakeImage(Base):
    """Фото дизайна с подписью-ролью, как у товара (005a). Первое по порядку — обложка."""

    __tablename__ = "custom_cake_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cake_id: Mapped[int] = mapped_column(
        ForeignKey("custom_cakes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    role: Mapped[CakeImageRole | None] = mapped_column(
        SAEnum(
            CakeImageRole,
            name="cake_image_role",
            values_callable=lambda e: [i.value for i in e],
        )
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cake: Mapped[CustomCake] = relationship(back_populates="images")


class Filling(Base):
    __tablename__ = "fillings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Строка под названием в карточке: «Острота подчёркивает сладость фрукта».
    # Отдельно от description: тот — для страницы и подсказки, а карточке нужна
    # одна короткая строка. Пусто — карточка берёт description
    short_description: Mapped[str | None] = mapped_column(String(120))
    # Метки состава, как у товара: «СНИЖЕННЫЙ САХАР» под карточкой
    dietary: Mapped[list[DietaryTag]] = mapped_column(
        ARRAY(
            SAEnum(DietaryTag, name="dietary_tag", values_callable=lambda e: [i.value for i in e])
        ),
        default=list,
        server_default="{}",
        nullable=False,
    )
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    price_per_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
