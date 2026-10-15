"""Гостевая корзина.

Отдельной сущности «корзина» в 01-data-model.md нет, но она требуется реализацией
02-api-contract.md: корзина живёт на сервере и опознаётся по httpOnly cookie `cart_id`
(UUID) — это и есть единственный источник правды вместо дублирования в localStorage,
как было в старом коде (ANALYSIS.md, п. 2.1.3). Поэтому таблицы заводятся здесь;
модель данных стоит дополнить этими двумя сущностями.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.catalog import ProductVariant


class Cart(Base, TimestampMixin):
    __tablename__ = "carts"

    # UUID, а не автоинкремент: значение уходит в cookie и не должно быть предсказуемым
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan"
    )


class CartItem(Base):
    """Строка корзины: вариант товара + надпись на табличке.

    Тот же товар другим весом или с другой надписью — отдельная строка: это
    разные изделия для кухни. Одинаковые вариант и надпись складываются в одну
    строку (NULLS NOT DISTINCT — две строки «без надписи» тоже считаются одной).
    """

    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint(
            "cart_id",
            "variant_id",
            "inscription_text",
            name="uq_cart_item_variant_inscription",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cart_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Удалили вариант — строка корзины уходит вместе с ним: купить его уже нельзя
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Цены надписи здесь нет: она берётся из настроек на момент показа корзины
    # и оформления заказа, как и цена варианта (ревью 005a)
    inscription_text: Mapped[str | None] = mapped_column(String(30))

    cart: Mapped["Cart"] = relationship(back_populates="items")
    variant: Mapped["ProductVariant"] = relationship()
