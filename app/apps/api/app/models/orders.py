"""Заказы и позиции заказа (01-data-model.md, раздел 10).

Паттерн со снапшотом цены в OrderItem унаследован из старой Django-модели —
он признан рабочим в ANALYSIS.md, раздел 3, и перенесён один в один.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import ContactMethod, DeliveryInterval, DeliveryMethod, OrderStatus
from app.models.mixins import TimestampMixin


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_comment: Mapped[str | None] = mapped_column(Text)
    # Почта для копии заказа (007a). Обязательна для новых заказов на уровне схемы
    # OrderCreate; у старых её нет. ПДн — обезличивается вместе с именем и телефоном
    customer_email: Mapped[str | None] = mapped_column(String(254))
    # «Как связаться для подтверждения»: позвонить или написать в Telegram
    contact_method: Mapped[ContactMethod | None] = mapped_column(
        SAEnum(ContactMethod, name="contact_method", values_callable=lambda e: [i.value for i in e])
    )
    # «Получит другой человек» — имя и телефон получателя (ПДн)
    recipient_name: Mapped[str | None] = mapped_column(String(200))
    recipient_phone: Mapped[str | None] = mapped_column(String(20))
    # Доставка: delivery_address — «улица и дом», остальное отдельными полями
    address_apartment: Mapped[str | None] = mapped_column(String(20))
    address_entrance: Mapped[str | None] = mapped_column(String(20))
    address_floor: Mapped[str | None] = mapped_column(String(20))
    # Комментарий курьеру — отдельно от комментария к заказу
    courier_comment: Mapped[str | None] = mapped_column(Text)
    # Почему отменили (011d, необязательно). Хранится в заказе, а не в журнале:
    # в причине может оказаться что угодно о клиенте, а журнал ПДн не копит
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    delivery_method: Mapped[DeliveryMethod] = mapped_column(
        SAEnum(
            DeliveryMethod,
            name="delivery_method",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
    )
    # Обязателен при delivery_method=delivery — условная валидация в Pydantic-схеме,
    # а не NOT NULL в БД: при самовывозе поле пустое (01-data-model.md, Order.delivery_address)
    delivery_address: Mapped[str | None] = mapped_column(Text)
    desired_date: Mapped[date | None] = mapped_column(Date)
    # Интервал к дате (PDF «Этап 1»: «Один путь, дата и интервал в оформлении»).
    # Для самовывоза — когда клиент придёт, для доставки — окно курьера.
    delivery_interval: Mapped[DeliveryInterval | None] = mapped_column(
        SAEnum(
            DeliveryInterval,
            name="delivery_interval",
            values_callable=lambda e: [i.value for i in e],
        )
    )
    consent_pd: Mapped[bool] = mapped_column(nullable=False)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_policy_version: Mapped[str | None] = mapped_column(String(20))
    # Сумма позиций и снапшот стоимости доставки (007a); total = subtotal + доставка.
    # У старых заказов subtotal = total, доставка 0
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0"), server_default="0", nullable=False
    )
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status", values_callable=lambda e: [i.value for i in e]),
        default=OrderStatus.NEW,
        nullable=False,
        index=True,
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT: товар нельзя удалить, пока он есть в заказах — иначе теряется история
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    # RESTRICT по той же причине: вариант из заказа можно только выключить
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False
    )
    # Снапшоты названия товара и подписи варианта: заказ должен читаться так же,
    # как в день оформления, даже если «Медовик» переименуют, а «2 кг» станет «1,8 кг»
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_label: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Снапшот цены варианта на момент заказа, независимый от текущего прайса
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Надпись на табличке — её пишет кондитер. Свободный текст покупателя: в журнал
    # не попадает и обезличивается по сроку хранения вместе с заказом
    inscription_text: Mapped[str | None] = mapped_column(String(30))
    inscription_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    order: Mapped["Order"] = relationship(back_populates="items")

    @property
    def unit_price(self) -> Decimal:
        """Цена одной штуки: вариант плюс надпись."""
        return self.price + (self.inscription_price or Decimal("0"))

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity
