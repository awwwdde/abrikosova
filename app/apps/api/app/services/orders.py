"""Оформление заказа."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import Cart, Order, OrderItem, Product
from app.schemas.shop import OrderCreate, OrderItemOut, OrderOut

logger = logging.getLogger(__name__)

# Версия политики, с которой человек согласился в момент отправки формы.
# Меняется вместе с текстом политики — по ней видно, на что именно было согласие.
PRIVACY_POLICY_VERSION = "1.0"


class EmptyCartError(Exception):
    """Заказ из пустой корзины оформить нельзя."""


class UnavailableProductError(Exception):
    def __init__(self, names: list[str]) -> None:
        self.names = names
        super().__init__("В корзине есть недоступные товары: " + ", ".join(names))


def _generate_order_number() -> str:
    """Номер заказа: дата + случайный суффикс.

    Случайная часть, а не сквозной счётчик: по номеру заказа страница
    подтверждения доступна без авторизации, и последовательные номера позволяли
    бы перебором читать чужие заказы с их персональными данными.
    """
    return f"{datetime.now(UTC):%Y%m%d}-{secrets.token_hex(3).upper()}"


async def create_order(session: AsyncSession, cart: Cart, data: OrderCreate) -> Order:
    if not cart.items:
        raise EmptyCartError

    product_ids = [item.product_id for item in cart.items]
    query = select(Product).where(Product.id.in_(product_ids), Product.is_active.is_(True))
    products = {p.id: p for p in (await session.scalars(query)).all()}

    unavailable = [
        products[item.product_id].name
        for item in cart.items
        if item.product_id in products and not products[item.product_id].is_available
    ]
    if unavailable:
        raise UnavailableProductError(unavailable)

    order_items: list[OrderItem] = []
    total = Decimal("0")
    for item in cart.items:
        product = products.get(item.product_id)
        if product is None:
            continue
        # Снапшот цены: заказ не должен «переоцениваться» при смене прайса
        line_total = product.price * item.quantity
        total += line_total
        order_items.append(
            OrderItem(product_id=product.id, quantity=item.quantity, price=product.price)
        )

    if not order_items:
        raise EmptyCartError

    order = Order(
        order_number=_generate_order_number(),
        customer_name=data.customer_name.strip(),
        customer_phone=data.customer_phone.strip(),
        customer_comment=(data.customer_comment or "").strip() or None,
        delivery_method=data.delivery_method,
        delivery_address=(data.delivery_address or "").strip() or None,
        desired_date=data.desired_date,
        consent_pd=data.consent_pd,
        consent_at=datetime.now(UTC),
        consent_policy_version=PRIVACY_POLICY_VERSION,
        total_price=total,
        items=order_items,
    )
    session.add(order)
    await session.flush()

    # В лог — только номер заказа и сумма. Имя, телефон и адрес в логи не попадают:
    # логи хранятся и пересылаются иначе, чем БД, и не должны множить копии ПДн.
    logger.info("Создан заказ %s на сумму %s", order.order_number, total)
    return order


async def get_order_by_number(session: AsyncSession, order_number: str) -> Order | None:
    query = (
        select(Order).where(Order.order_number == order_number).options(selectinload(Order.items))
    )
    return (await session.scalars(query)).unique().one_or_none()


async def build_order_view(session: AsyncSession, order: Order) -> OrderOut:
    product_ids = [item.product_id for item in order.items]
    names = dict(
        (
            await session.execute(
                select(Product.id, Product.name).where(Product.id.in_(product_ids))
            )
        ).all()
    )

    return OrderOut(
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_comment=order.customer_comment,
        delivery_method=order.delivery_method,
        delivery_address=order.delivery_address,
        desired_date=order.desired_date,
        total_price=order.total_price,
        status=order.status,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                product_id=item.product_id,
                name=names.get(item.product_id, "Товар удалён"),
                quantity=item.quantity,
                price=item.price,
                line_total=item.price * item.quantity,
            )
            for item in order.items
        ],
    )


def retention_cutoff() -> datetime:
    """Граница хранения персональных данных (152-ФЗ, минимизация хранения)."""
    return datetime.now(UTC) - timedelta(days=get_settings().pd_retention_days)
