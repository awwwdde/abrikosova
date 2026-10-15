"""Оформление заказа."""

import logging
import re
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.core.clock import local_today
from app.core.config import get_settings
from app.models import Cart, Order, OrderItem
from app.models.enums import DeliveryMethod
from app.schemas.settings import BakerySettings
from app.schemas.shop import (
    INSCRIPTION_MAX_LENGTH,
    OrderConfirmationOut,
    OrderCreate,
    OrderItemOut,
    OrderOut,
)
from app.services import delivery, slots

logger = logging.getLogger(__name__)

# Версия политики, с которой человек согласился в момент отправки формы.
# Меняется вместе с текстом политики — по ней видно, на что именно было согласие.
PRIVACY_POLICY_VERSION = "1.0"


class EmptyCartError(Exception):
    """Заказ из пустой корзины оформить нельзя."""


class DateTooEarlyError(Exception):
    """Желаемые дата или интервал раньше, чем позиции успеют приготовить."""

    def __init__(self, nearest: slots.Slot) -> None:
        self.earliest = nearest.date
        self.nearest = nearest
        interval = nearest.interval.value.replace("-", "–")
        super().__init__(f"Ближайшее время получения — {nearest.date:%d.%m.%Y}, {interval}")


class InscriptionTooLongError(Exception):
    """Надпись в корзине длиннее лимита (006b: 24 знака). Строки, добавленные до
    смены лимита, база хранит как есть, но кондитеру такая надпись не уйдёт."""

    def __init__(self, names: list[str]) -> None:
        self.names = names
        super().__init__(
            f"Надпись — не больше {INSCRIPTION_MAX_LENGTH} знаков. Сократите её у позиции: "
            + ", ".join(names)
        )


class IntervalNotOfferedError(Exception):
    """У способа получения нет такого окна: доставка не возит в 18–21 (007a)."""

    def __init__(self, interval: str) -> None:
        shown = interval.replace("-", "–")
        super().__init__(f"У доставки нет окна {shown}, выберите другое")


class UnavailableProductError(Exception):
    def __init__(self, names: list[str]) -> None:
        self.names = names
        super().__init__("В корзине есть недоступные товары: " + ", ".join(names))


def _generate_order_number() -> str:
    """Номер заказа: дата + случайный суффикс.

    Случайная часть, а не сквозной счётчик: по номеру заказа страница
    подтверждения доступна без авторизации, и последовательные номера позволяли
    бы перебором читать чужие заказы с их персональными данными.

    Дата — день кондитерской, а не UTC: заказ, оформленный в половине первого
    ночи по Москве, иначе получал бы в номере вчерашнее число.
    """
    return f"{local_today():%Y%m%d}-{secrets.token_hex(3).upper()}"


async def create_order(
    session: AsyncSession, cart: Cart, data: OrderCreate, settings: BakerySettings
) -> Order:
    """Заказ из корзины. Корзина приходит загруженной со строками, вариантами
    и товарами (`cart_service.get_or_create_cart`). Цены варианта и надписи —
    на момент оформления, поэтому сюда же передаются настройки сайта."""
    cutoff = settings.slot_cutoff_minutes
    inscription_price = Decimal(settings.inscription_price).quantize(Decimal("0.01"))
    # В порядке строк корзины (по id): в заказе и письме позиции идут так же, как в корзине
    lines = sorted(
        (item for item in cart.items if item.variant.is_active and item.variant.product.is_active),
        key=lambda item: item.id,
    )
    if not lines:
        raise EmptyCartError

    unavailable = [
        item.variant.product.name for item in lines if not item.variant.product.is_available
    ]
    if unavailable:
        raise UnavailableProductError(unavailable)
    too_long = [
        item.variant.product.name
        for item in lines
        if item.inscription_text and len(item.inscription_text) > INSCRIPTION_MAX_LENGTH
    ]
    if too_long:
        raise InscriptionTooLongError(too_long)

    # Срок изготовления — обещание покупателю («готовим за три дня»), и заказ,
    # который физически нельзя выполнить к названной дате, принимать нельзя.
    # Если в корзине есть позиция под заказ, дата обязательна: без неё кухня
    # не знает, к какому дню печь. То же окно обещает карточка товара
    # («ближайшее окно 15:00–18:00») — функция одна, services/slots.py.
    # Срок с учётом «закончилось сегодня» (006b): такую позицию — не раньше завтра
    lead_times = [item.variant.product.effective_lead_time_days for item in lines]
    # Окна у способов разные (007a): у доставки нет вечернего 18–21
    intervals = delivery.intervals_for(data.delivery_method, settings)
    if max(lead_times, default=0) > 0 and data.desired_date is None:
        raise DateTooEarlyError(slots.nearest_slot(lead_times, cutoff, intervals))
    if data.desired_date is not None:
        try:
            nearest = slots.check_slot(
                lead_times, data.desired_date, data.delivery_interval, cutoff, intervals
            )
        except slots.IntervalNotOfferedError:
            raise IntervalNotOfferedError(str(data.delivery_interval)) from None
        if nearest is not None:
            raise DateTooEarlyError(nearest)

    order_items: list[OrderItem] = []
    total = Decimal("0")
    for item in lines:
        variant = item.variant
        # Снапшоты цены, названия и подписи варианта: заказ не должен
        # «переоцениваться» и переименовываться при правках каталога
        order_item = OrderItem(
            product_id=variant.product_id,
            variant_id=variant.id,
            product_name=variant.product.name,
            variant_label=variant.label,
            quantity=item.quantity,
            price=variant.price,
            inscription_text=item.inscription_text,
            inscription_price=inscription_price if item.inscription_text is not None else None,
        )
        total += order_item.line_total
        order_items.append(order_item)

    # Доставка — снапшот на момент заказа: смена цены в настройках старые заказы
    # не трогает. Одна функция с корзиной — services/delivery.py
    delivery_price = delivery.delivery_cost(total, data.delivery_method, settings)
    is_delivery = data.delivery_method is DeliveryMethod.DELIVERY

    def clean(value: str | None) -> str | None:
        return (value or "").strip() or None

    order = Order(
        order_number=_generate_order_number(),
        customer_name=data.customer_name.strip(),
        customer_phone=data.customer_phone.strip(),
        customer_email=data.customer_email,
        contact_method=data.contact_method,
        customer_comment=clean(data.customer_comment),
        recipient_name=data.recipient_name,
        recipient_phone=data.recipient_phone,
        delivery_method=data.delivery_method,
        # При самовывозе адресные поля не храним, даже если форма их прислала:
        # лишние ПДн, которые никому не нужны
        delivery_address=clean(data.delivery_address) if is_delivery else None,
        address_apartment=clean(data.address_apartment) if is_delivery else None,
        address_entrance=clean(data.address_entrance) if is_delivery else None,
        address_floor=clean(data.address_floor) if is_delivery else None,
        courier_comment=clean(data.courier_comment) if is_delivery else None,
        desired_date=data.desired_date,
        delivery_interval=data.delivery_interval,
        consent_pd=data.consent_pd,
        consent_at=datetime.now(UTC),
        consent_policy_version=PRIVACY_POLICY_VERSION,
        subtotal=total,
        delivery_price=delivery_price,
        total_price=total + delivery_price,
        items=order_items,
    )
    session.add(order)
    await session.flush()

    # В лог — только номер заказа и сумма. Имя, телефон и адрес в логи не попадают:
    # логи хранятся и пересылаются иначе, чем БД, и не должны множить копии ПДн.
    logger.info("Создан заказ %s на сумму %s", order.order_number, order.total_price)
    return order


async def get_order_by_number(session: AsyncSession, order_number: str) -> Order | None:
    query = (
        select(Order).where(Order.order_number == order_number).options(selectinload(Order.items))
    )
    return (await session.scalars(query)).unique().one_or_none()


def mask_phone(phone: str) -> str:
    """«+7 916 123-45-67» → «+7 (916) ***-**-67». Чужой формат — первые и последние
    две цифры: страница без входа не должна показывать номер целиком."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits[0] in "78":
        return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"
    if len(digits) < 5:
        return "***"
    return f"{digits[:2]}***{digits[-2:]}"


def mask_email(email: str | None) -> str | None:
    """«anna@mail.ru» → «an***@mail.ru»: адрес узнаётся, но целиком не виден."""
    if not email or "@" not in email:
        return None
    local, domain = email.rsplit("@", 1)
    return f"{local[:2]}***@{domain}"


def is_after_hours(created_at: datetime, settings: BakerySettings) -> bool:
    """Заказ пришёл вне часов ответа по времени кондитерской: «свяжемся утром»."""
    hour = created_at.astimezone(clock.local_now().tzinfo).hour
    return not (settings.work_hours_start <= hour < settings.work_hours_end)


def _items_view(order: Order) -> list[OrderItemOut]:
    return [
        OrderItemOut(
            product_id=item.product_id,
            name=item.product_name,
            variant_label=item.variant_label,
            quantity=item.quantity,
            price=item.price,
            inscription_text=item.inscription_text,
            inscription_price=item.inscription_price,
            line_total=item.line_total,
        )
        for item in sorted(order.items, key=lambda i: i.id)
    ]


def build_confirmation(order: Order, settings: BakerySettings) -> OrderConfirmationOut:
    """Страница «Заказ принят» и ответ оформления (007a): маски вместо контактов."""
    return OrderConfirmationOut(
        order_number=order.order_number,
        status=order.status,
        created_at=order.created_at,
        contact_method=order.contact_method,
        phone_masked=mask_phone(order.customer_phone),
        email_masked=mask_email(order.customer_email),
        delivery_method=order.delivery_method,
        delivery_address=order.delivery_address,
        address_apartment=order.address_apartment,
        address_entrance=order.address_entrance,
        address_floor=order.address_floor,
        desired_date=order.desired_date,
        delivery_interval=order.delivery_interval,
        items=_items_view(order),
        subtotal=order.subtotal,
        delivery_price=order.delivery_price,
        total_price=order.total_price,
        after_hours=is_after_hours(order.created_at, settings),
        work_hours_start=settings.work_hours_start,
        work_hours_end=settings.work_hours_end,
    )


def build_order_view(order: Order) -> OrderOut:
    """Названия и подписи — из снапшотов заказа, а не из текущего каталога."""
    return OrderOut(
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_comment=order.customer_comment,
        delivery_method=order.delivery_method,
        delivery_address=order.delivery_address,
        desired_date=order.desired_date,
        delivery_interval=order.delivery_interval,
        total_price=order.total_price,
        status=order.status,
        created_at=order.created_at,
        items=_items_view(order),
    )


def retention_cutoff() -> datetime:
    """Граница хранения персональных данных (152-ФЗ, минимизация хранения)."""
    return datetime.now(UTC) - timedelta(days=get_settings().pd_retention_days)
