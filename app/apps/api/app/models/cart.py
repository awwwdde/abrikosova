"""Гостевая корзина.

Отдельной сущности «корзина» в 01-data-model.md нет, но она требуется реализацией
02-api-contract.md: корзина живёт на сервере и опознаётся по httpOnly cookie `cart_id`
(UUID) — это и есть единственный источник правды вместо дублирования в localStorage,
как было в старом коде (ANALYSIS.md, п. 2.1.3). Поэтому таблицы заводятся здесь;
модель данных стоит дополнить этими двумя сущностями.
"""

import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin


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
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "product_id", name="uq_cart_item_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cart_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    cart: Mapped["Cart"] = relationship(back_populates="items")
