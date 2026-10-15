"""Гостевая корзина — единственный источник правды на сервере.

В старом коде корзина жила одновременно в серверной сессии и в localStorage и
синхронизировалась вручную (ANALYSIS.md, п. 2.1.3) — отсюда расхождения счётчика
с содержимым. Здесь состояние только в БД, клиент его читает и мутирует по API.

Строка корзины — вариант товара плюс надпись на табличке (005a): «Медовик целый,
1 кг» и «Медовик целый, 2 кг, „С днём рождения“» — разные строки.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.util import identity_key

from app.core import clock
from app.core.config import get_settings
from app.models import Cart, CartItem, DeliveryMethod, Product, ProductVariant
from app.schemas.settings import BakerySettings
from app.schemas.shop import (
    CartItemOut,
    CartOut,
    CartSlotsOut,
    EarliestReasonOut,
    SlotDayOut,
    SlotIntervalOut,
)
from app.services import delivery, slots
from app.services.catalog import CAKES_CATEGORY_SLUG

MAX_QUANTITY = 99


class InscriptionNotAllowedError(Exception):
    """Надпись пришла к товару, у которого её нельзя заказать."""


class VariantNotFoundError(Exception):
    """Варианта нет, он выключен или его товар скрыт."""


def normalize_inscription(text: str | None) -> str | None:
    """Пробелы по краям обрезаются, пустая строка — «без надписи»."""
    text = (text or "").strip()
    return text or None


def _cart_options() -> list:
    return [
        selectinload(Cart.items)
        .selectinload(CartItem.variant)
        .selectinload(ProductVariant.product)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants),
            selectinload(Product.category),
        )
    ]


def expiry_cutoff():
    return clock.utc_now() - timedelta(days=get_settings().cart_ttl_days)


async def find_cart(
    session: AsyncSession, cart_id: uuid.UUID | None, *, lock: bool = False
) -> Cart | None:
    if cart_id is None:
        return None
    condition = (Cart.id == cart_id, Cart.updated_at >= expiry_cutoff())
    if lock:
        # Блокировка берётся до загрузки строк и держится до коммита. Повторное
        # оформление после ожидания увидит уже очищенную корзину.
        if await session.scalar(select(Cart.id).where(*condition).with_for_update()) is None:
            return None
        existing = session.identity_map.get(identity_key(Cart, cart_id))
        if existing is not None:
            # Старый снимок строк нельзя использовать после ожидания блокировки.
            # populate_existing на цикле product.variants сбрасывает product у
            # варианта; новый граф загружаем без этого побочного эффекта ORM.
            session.expunge(existing)
    return await session.scalar(select(Cart).where(*condition).options(*_cart_options()))


async def get_or_create_cart(
    session: AsyncSession, cart_id: uuid.UUID | None, *, create: bool = True
) -> Cart:
    cart = await find_cart(session, cart_id, lock=True)
    if cart is not None:
        return cart
    cart = Cart(items=[])
    if create:
        session.add(cart)
        await session.flush()
    return cart


async def purge_expired(session: AsyncSession) -> int:
    result = await session.execute(delete(Cart).where(Cart.updated_at < expiry_cutoff()))
    await session.commit()
    return result.rowcount


async def reload(session: AsyncSession, cart: Cart) -> Cart:
    """Перечитывает корзину со строками, вариантами и товарами после коммита.

    Сессия очищается целиком: после коммита все загруженные объекты (вариант,
    который только что проверяли, его товар) помечены устаревшими, и первое же
    обращение к ним пошло бы в базу синхронно — в async-сессии это MissingGreenlet.
    """
    cart_id = cart.id
    session.expunge_all()
    reloaded = await session.get(Cart, cart_id, options=_cart_options())
    assert reloaded is not None
    return reloaded


def _is_sellable(variant: ProductVariant) -> bool:
    return variant.is_active and variant.product.is_active


def build_cart_view(cart: Cart, settings: BakerySettings) -> CartOut:
    """Собирает представление корзины по актуальным ценам.

    Цена никогда не берётся с клиента — только из варианта и настроек на момент
    запроса. Цена надписи — тоже текущая (решение по ревью 005a): иначе корзина,
    собранная до смены цены, оформилась бы по старой. Выключенный вариант или
    скрытый товар из корзины просто не показываются.
    """
    inscription_price = Decimal(settings.inscription_price).quantize(Decimal("0.01"))
    items: list[CartItemOut] = []
    total_price = Decimal("0")
    total_items = 0

    for item in sorted(cart.items, key=lambda i: i.id):
        variant = item.variant
        if not _is_sellable(variant):
            continue
        product = variant.product

        line_inscription = inscription_price if item.inscription_text is not None else None
        unit_price = variant.price + (line_inscription or Decimal("0"))
        line_total = unit_price * item.quantity
        total_price += line_total
        total_items += item.quantity

        main_image = next(
            (img.storage_key for img in product.images if img.is_main),
            product.images[0].storage_key if product.images else None,
        )
        active_variants = [v for v in product.variants if v.is_active]
        items.append(
            CartItemOut(
                id=item.id,
                product_id=product.id,
                variant_id=variant.id,
                name=product.name,
                slug=product.slug,
                variant_label=variant.label,
                has_variants=len(active_variants) > 1,
                is_cake=product.category.slug == CAKES_CATEGORY_SLUG,
                allows_inscription=product.allows_inscription,
                price=variant.price,
                inscription_text=item.inscription_text,
                inscription_price=line_inscription,
                quantity=item.quantity,
                line_total=line_total,
                main_image=main_image,
                is_available=product.is_available,
                # «Закончилось сегодня» — срок «завтра», и earliest_date корзины тоже (006b)
                lead_time_days=product.effective_lead_time_days,
            )
        )

    lead_times = [item.lead_time_days for item in items]
    cutoff = settings.slot_cutoff_minutes
    # Позиция с самым долгим сроком — она и сдвигает раннюю дату (первая из равных)
    longest = max(items, key=lambda item: item.lead_time_days, default=None)
    reason = (
        EarliestReasonOut(
            name=longest.name,
            variant_label=longest.variant_label,
            has_variants=longest.has_variants,
            lead_time_days=longest.lead_time_days,
        )
        if longest is not None and longest.lead_time_days > 0
        else None
    )

    def days(method: DeliveryMethod) -> list[SlotDayOut]:
        return [
            SlotDayOut(
                date=day.date,
                label=day.label,
                available=day.available,
                intervals=[
                    SlotIntervalOut(interval=interval, available=ok)
                    for interval, ok in day.intervals
                ],
            )
            for day in slots.week(lead_times, cutoff, delivery.intervals_for(method, settings))
        ]

    return CartOut(
        items=items,
        total_items=total_items,
        subtotal=total_price,
        total_price=total_price,
        delivery_price_pickup=delivery.delivery_cost(total_price, DeliveryMethod.PICKUP, settings),
        delivery_price_delivery=delivery.delivery_cost(
            total_price, DeliveryMethod.DELIVERY, settings
        ),
        free_delivery_from=Decimal(settings.free_delivery_from).quantize(Decimal("0.01")),
        free_delivery_left=delivery.free_delivery_left(total_price, settings),
        delivery_note=settings.delivery_note,
        earliest_date=slots.earliest_date(lead_times, cutoff),
        earliest_reason=reason,
        slots=CartSlotsOut(
            pickup=days(DeliveryMethod.PICKUP), delivery=days(DeliveryMethod.DELIVERY)
        ),
        work_hours_start=settings.work_hours_start,
        work_hours_end=settings.work_hours_end,
    )


async def load_sellable_variant(session: AsyncSession, variant_id: int) -> ProductVariant:
    query = (
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            ProductVariant.id == variant_id,
            ProductVariant.is_active.is_(True),
            Product.is_active.is_(True),
        )
        .options(selectinload(ProductVariant.product))
    )
    variant = await session.scalar(query)
    if variant is None:
        raise VariantNotFoundError
    return variant


async def add_item(
    session: AsyncSession,
    cart: Cart,
    variant: ProductVariant,
    quantity: int,
    inscription_text: str | None,
) -> None:
    """Добавляет вариант с надписью. Та же пара «вариант + надпись» уже есть —
    растёт количество; другая надпись или другой вариант — новая строка."""
    text = normalize_inscription(inscription_text)
    if text is not None and not variant.product.allows_inscription:
        raise InscriptionNotAllowedError

    existing = next(
        (i for i in cart.items if i.variant_id == variant.id and i.inscription_text == text),
        None,
    )
    if existing is not None:
        existing.quantity = min(existing.quantity + quantity, MAX_QUANTITY)
        return

    cart.items.append(
        CartItem(
            variant_id=variant.id,
            quantity=min(quantity, MAX_QUANTITY),
            inscription_text=text,
        )
    )


async def set_quantity(session: AsyncSession, cart: Cart, item_id: int, quantity: int) -> None:
    """Меняет количество строки. Строка чужой корзины для этой корзины не существует."""
    item = next((i for i in cart.items if i.id == item_id), None)
    if item is None:
        return

    if quantity <= 0:
        cart.items.remove(item)
        await session.delete(item)
        return

    item.quantity = min(quantity, MAX_QUANTITY)


async def set_inscription(
    session: AsyncSession, cart: Cart, item_id: int, text: str | None
) -> None:
    """Меняет надпись у строки («Изменить» в корзине, 007a). Если строка с тем же
    вариантом и такой надписью уже есть — это одна позиция: количества складываются,
    правленая строка исчезает. Иначе в корзине было бы две строки «Медовик, 1 кг,
    „С днём рождения“», и кондитер получил бы их как два заказа."""
    item = next((i for i in cart.items if i.id == item_id), None)
    if item is None:
        return
    text = normalize_inscription(text)
    if text is not None and not item.variant.product.allows_inscription:
        raise InscriptionNotAllowedError
    if text == item.inscription_text:
        return
    twin = next(
        (
            i
            for i in cart.items
            if i.id != item.id and i.variant_id == item.variant_id and i.inscription_text == text
        ),
        None,
    )
    if twin is not None:
        twin.quantity = min(twin.quantity + item.quantity, MAX_QUANTITY)
        cart.items.remove(item)
        await session.delete(item)
        return
    item.inscription_text = text


async def remove_item(session: AsyncSession, cart: Cart, item_id: int) -> None:
    await set_quantity(session, cart, item_id, 0)


async def clear(session: AsyncSession, cart: Cart) -> None:
    for item in list(cart.items):
        cart.items.remove(item)
        await session.delete(item)
