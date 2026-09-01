"""Гостевая корзина — единственный источник правды на сервере.

В старом коде корзина жила одновременно в серверной сессии и в localStorage и
синхронизировалась вручную (ANALYSIS.md, п. 2.1.3) — отсюда расхождения счётчика
с содержимым. Здесь состояние только в БД, клиент его читает и мутирует по API.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Cart, CartItem, Product
from app.schemas.shop import CartItemOut, CartOut

MAX_QUANTITY = 99


async def get_or_create_cart(session: AsyncSession, cart_id: uuid.UUID | None) -> Cart:
    """Находит корзину по id из cookie или создаёт новую.

    Неизвестный или подделанный id молча приводит к новой пустой корзине:
    id — непредсказуемый UUID, перебором чужую корзину не найти.
    """
    if cart_id is not None:
        cart = await session.get(Cart, cart_id, options=[selectinload(Cart.items)])
        if cart is not None:
            return cart

    # items инициализируем явно: у только что созданного объекта коллекция после
    # flush иначе окажется незагруженной, и первое же обращение к ней попытается
    # сходить в БД синхронно — в async-сессии это падает с MissingGreenlet
    cart = Cart(items=[])
    session.add(cart)
    await session.flush()
    return cart


async def _load_products(session: AsyncSession, product_ids: list[int]) -> dict[int, Product]:
    if not product_ids:
        return {}
    query = (
        select(Product)
        .where(Product.id.in_(product_ids), Product.is_active.is_(True))
        .options(selectinload(Product.images))
    )
    return {p.id: p for p in (await session.scalars(query)).unique().all()}


async def build_cart_view(session: AsyncSession, cart: Cart) -> CartOut:
    """Собирает представление корзины по актуальным ценам из БД.

    Цена никогда не берётся с клиента — только из товара на момент запроса.
    """
    products = await _load_products(session, [item.product_id for item in cart.items])

    items: list[CartItemOut] = []
    total_price = Decimal("0")
    total_items = 0

    for item in sorted(cart.items, key=lambda i: i.id):
        product = products.get(item.product_id)
        if product is None:
            continue

        line_total = product.price * item.quantity
        total_price += line_total
        total_items += item.quantity

        main_image = next(
            (img.storage_key for img in product.images if img.is_main),
            product.images[0].storage_key if product.images else None,
        )
        items.append(
            CartItemOut(
                product_id=product.id,
                name=product.name,
                slug=product.slug,
                price=product.price,
                quantity=item.quantity,
                line_total=line_total,
                main_image=main_image,
                is_available=product.is_available,
            )
        )

    return CartOut(items=items, total_items=total_items, total_price=total_price)


async def add_item(session: AsyncSession, cart: Cart, product_id: int, quantity: int) -> None:
    existing = next((i for i in cart.items if i.product_id == product_id), None)
    if existing is not None:
        existing.quantity = min(existing.quantity + quantity, MAX_QUANTITY)
        return

    cart.items.append(CartItem(product_id=product_id, quantity=min(quantity, MAX_QUANTITY)))


async def set_quantity(session: AsyncSession, cart: Cart, product_id: int, quantity: int) -> None:
    item = next((i for i in cart.items if i.product_id == product_id), None)
    if item is None:
        return

    if quantity <= 0:
        cart.items.remove(item)
        await session.delete(item)
        return

    item.quantity = min(quantity, MAX_QUANTITY)


async def remove_item(session: AsyncSession, cart: Cart, product_id: int) -> None:
    await set_quantity(session, cart, product_id, 0)


async def clear(session: AsyncSession, cart: Cart) -> None:
    for item in list(cart.items):
        cart.items.remove(item)
        await session.delete(item)


async def product_exists_and_active(session: AsyncSession, product_id: int) -> bool:
    query = select(Product.id).where(Product.id == product_id, Product.is_active.is_(True))
    return await session.scalar(query) is not None
