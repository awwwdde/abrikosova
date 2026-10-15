"""Стоимость доставки (007a) — одна функция на корзину, оформление и письмо.

Самовывоз бесплатный. Доставка по Москве — цена из настроек, бесплатно от суммы
позиций `free_delivery_from` (макет корзины: «До бесплатной доставки 3 360 ₽»).
Порог сравнивается с суммой позиций, без самой доставки: иначе доставка «помогала»
бы себе стать бесплатной.
"""

from decimal import Decimal

from app.models.enums import DeliveryInterval, DeliveryMethod
from app.schemas.settings import BakerySettings

ZERO = Decimal("0.00")


def _money(value: int) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"))


def delivery_cost(subtotal: Decimal, method: DeliveryMethod, settings: BakerySettings) -> Decimal:
    if method is DeliveryMethod.PICKUP:
        return ZERO
    if subtotal >= settings.free_delivery_from:
        return ZERO
    return _money(settings.delivery_price)


def free_delivery_left(subtotal: Decimal, settings: BakerySettings) -> Decimal:
    """Сколько не хватает до бесплатной доставки; 0 — уже бесплатно."""
    return max(ZERO, _money(settings.free_delivery_from) - subtotal)


def intervals_for(method: DeliveryMethod, settings: BakerySettings) -> list[DeliveryInterval]:
    """Окна способа получения: у самовывоза — все, у доставки — из настроек."""
    if method is DeliveryMethod.DELIVERY:
        return list(settings.delivery_intervals)
    return list(DeliveryInterval)
