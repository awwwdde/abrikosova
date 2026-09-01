"""Удаление персональных данных по истечении срока хранения.

152-ФЗ требует, чтобы данные не хранились дольше, чем нужно для цели их
обработки. Цель здесь — выполнить заказ или отработать заявку; после этого
имя, телефон и адрес клиента лежать в базе не должны.

Удаляются только завершённые и отменённые заказы и обработанные заявки:
активный заказ нельзя чистить по сроку, даже если он давно создан.

Сам факт заказа при этом не теряется — обезличенная строка остаётся, чтобы
не рушить историю продаж и связанную статистику. Стирается только то, что
делает запись персональной.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ConsultationRequest, ConsultationStatus, Order, OrderStatus
from app.services.orders import retention_cutoff

logger = logging.getLogger(__name__)

ANONYMIZED_NAME = "Удалено по сроку хранения"
ANONYMIZED_PHONE = "—"


async def purge_expired(session: AsyncSession) -> dict[str, int]:
    """Обезличивает заказы и удаляет заявки, у которых истёк срок хранения."""
    cutoff = retention_cutoff()

    orders_query = select(Order).where(
        Order.created_at < cutoff,
        Order.status.in_([OrderStatus.COMPLETED, OrderStatus.CANCELLED]),
        # Уже обезличенные повторно не трогаем
        Order.customer_name != ANONYMIZED_NAME,
    )
    orders = list((await session.scalars(orders_query)).all())

    for order in orders:
        order.customer_name = ANONYMIZED_NAME
        order.customer_phone = ANONYMIZED_PHONE
        order.customer_comment = None
        order.delivery_address = None

    # Заявка после обработки не несёт ценности без контактов — удаляем целиком
    requests_query = select(ConsultationRequest).where(
        ConsultationRequest.created_at < cutoff,
        ConsultationRequest.status == ConsultationStatus.COMPLETED,
    )
    requests = list((await session.scalars(requests_query)).all())

    for row in requests:
        await session.delete(row)

    await session.commit()

    result = {"orders_anonymized": len(orders), "requests_deleted": len(requests)}
    if orders or requests:
        logger.info(
            "Очистка ПДн: обезличено заказов — %s, удалено заявок — %s",
            result["orders_anonymized"],
            result["requests_deleted"],
        )
    return result
