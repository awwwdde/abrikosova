"""Очистка персональных данных по сроку хранения.

Проверяем границы: что удаляется, что остаётся и что повторный запуск ничего
не портит. Ошибка здесь означает либо нарушение 152-ФЗ (данные живут дольше
положенного), либо потерю активных заказов.
"""

import itertools
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import (
    ConsultationRequest,
    ConsultationSource,
    ConsultationStatus,
    Order,
    OrderItem,
    OrderStatus,
)
from app.services import retention
from app.services.orders import retention_cutoff


def _old() -> datetime:
    """Момент заведомо за пределами срока хранения."""
    return retention_cutoff() - timedelta(days=1)


def _fresh() -> datetime:
    return datetime.now(UTC)


_counter = itertools.count(1)


async def _make_order(session, *, status: OrderStatus, created_at: datetime) -> Order:
    # Номер заказа ограничен 20 символами — тестовые значения должны влезать
    order = Order(
        order_number=f"TEST-{next(_counter):06d}",
        customer_name="Иван Тестовый",
        customer_phone="+79001234567",
        customer_comment="Позвонить заранее",
        cancel_reason="Клиентка Мария передумала, номер +79001234567",
        delivery_method="delivery",
        delivery_address="Москва, ул. Тестовая, 1",
        consent_pd=True,
        subtotal=Decimal("1000.00"),
        total_price=Decimal("1000.00"),
        status=status,
    )
    session.add(order)
    await session.flush()
    # created_at проставляет БД, поэтому дату сдвигаем отдельным UPDATE
    order.created_at = created_at
    await session.flush()
    return order


@pytest.mark.asyncio
async def test_old_completed_order_is_anonymized() -> None:
    async with SessionLocal() as session:
        order = await _make_order(session, status=OrderStatus.COMPLETED, created_at=_old())
        order_id = order.id
        await session.commit()

        await retention.purge_expired(session)

        refreshed = await session.get(Order, order_id)
        assert refreshed is not None, "Строка заказа должна остаться — теряется только ПДн"
        assert refreshed.customer_name == retention.ANONYMIZED_NAME
        assert refreshed.customer_phone == retention.ANONYMIZED_PHONE
        assert refreshed.customer_comment is None
        assert refreshed.delivery_address is None
        assert refreshed.cancel_reason is None, "Причина отмены — свободный текст, тоже ПДн"
        # Сумма и статус нужны для истории продаж и не являются персональными
        assert refreshed.total_price == Decimal("1000.00")

        await session.delete(refreshed)
        await session.commit()


@pytest.mark.asyncio
async def test_active_order_survives_even_if_old() -> None:
    """Незавершённый заказ не чистится по сроку: его ещё нужно выполнить."""
    async with SessionLocal() as session:
        order = await _make_order(session, status=OrderStatus.IN_PROGRESS, created_at=_old())
        order_id = order.id
        await session.commit()

        await retention.purge_expired(session)

        refreshed = await session.get(Order, order_id)
        assert refreshed is not None
        assert refreshed.customer_name == "Иван Тестовый"

        await session.delete(refreshed)
        await session.commit()


@pytest.mark.asyncio
async def test_recent_order_survives() -> None:
    async with SessionLocal() as session:
        order = await _make_order(session, status=OrderStatus.COMPLETED, created_at=_fresh())
        order_id = order.id
        await session.commit()

        await retention.purge_expired(session)

        refreshed = await session.get(Order, order_id)
        assert refreshed is not None
        assert refreshed.customer_phone == "+79001234567"

        await session.delete(refreshed)
        await session.commit()


@pytest.mark.asyncio
async def test_old_completed_request_is_deleted() -> None:
    async with SessionLocal() as session:
        row = ConsultationRequest(
            name="Мария",
            phone="+79007654321",
            consent_pd=True,
            source=ConsultationSource.CONTACT_PAGE,
            status=ConsultationStatus.COMPLETED,
        )
        session.add(row)
        await session.flush()
        row.created_at = _old()
        row_id = row.id
        await session.commit()

        await retention.purge_expired(session)

        assert await session.get(ConsultationRequest, row_id) is None


@pytest.mark.asyncio
async def test_purge_is_idempotent() -> None:
    """Повторный запуск не должен зацикливаться на уже обезличенных записях."""
    async with SessionLocal() as session:
        order = await _make_order(session, status=OrderStatus.CANCELLED, created_at=_old())
        order_id = order.id
        await session.commit()

        first = await retention.purge_expired(session)
        second = await retention.purge_expired(session)

        assert first["orders_anonymized"] >= 1
        assert second["orders_anonymized"] == 0

        stale = await session.scalar(select(Order).where(Order.id == order_id))
        if stale is not None:
            await session.delete(stale)
            await session.commit()


async def test_inscription_is_erased_with_the_order(catalog) -> None:
    """Надпись на табличке — свободный текст покупателя («Маше 5 лет»), это ПДн (005a)."""
    async with SessionLocal() as session:
        order = await _make_order(session, status=OrderStatus.COMPLETED, created_at=_old())
        item = catalog.order_item("kids-cake", 1, "3800")
        item.inscription_text = "Маше 5 лет"
        item.inscription_price = Decimal("300")
        item.order_id = order.id
        session.add(item)
        await session.commit()
        order_id = order.id

    async with SessionLocal() as session:
        await retention.purge_expired(session)

    async with SessionLocal() as session:
        [item] = (
            await session.scalars(select(OrderItem).where(OrderItem.order_id == order_id))
        ).all()
        assert item.inscription_text is None
        # Цена надписи — не ПДн, сумма заказа остаётся объяснимой
        assert item.inscription_price == Decimal("300.00")
