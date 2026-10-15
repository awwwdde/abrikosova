"""Удаление персональных данных по истечении срока хранения.

152-ФЗ требует, чтобы данные не хранились дольше, чем нужно для цели их
обработки. Цель здесь — выполнить заказ или отработать заявку; после этого
имя, телефон и адрес клиента лежать в базе не должны.

Удаляются только завершённые и отменённые заказы и обработанные заявки:
активный заказ нельзя чистить по сроку, даже если он давно создан.

Сам факт заказа при этом не теряется — обезличенная строка остаётся, чтобы
не рушить историю продаж и связанную статистику. Стирается только то, что
делает запись персональной.

ПРАВИЛО: любое новое свободное текстовое поле в заказе или заявке (комментарий,
причина, пометка сотрудника) сразу добавляется в список очистки ниже. В свободный
текст люди пишут имена и телефоны, даже если поле задумано «не про клиента» —
так было с `cancel_reason` (011d), который сначала забыли обезличивать (011e).
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ConsultationRequest, ConsultationStatus, Order, OrderStatus
from app.services import storage
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
    orders = list((await session.scalars(orders_query.options(selectinload(Order.items)))).all())

    for order in orders:
        order.customer_name = ANONYMIZED_NAME
        order.customer_phone = ANONYMIZED_PHONE
        order.customer_comment = None
        order.delivery_address = None
        # Оформление 007a: почта, получатель, квартира/подъезд/этаж, комментарий
        # курьеру («домофон 25, спросить Олю») — всё это ПДн
        order.customer_email = None
        order.recipient_name = None
        order.recipient_phone = None
        order.address_apartment = None
        order.address_entrance = None
        order.address_floor = None
        order.courier_comment = None
        # «Клиентка Мария передумала, номер …» — причина отмены тоже ПДн (011e)
        order.cancel_reason = None
        # Надпись на табличке — свободный текст покупателя: «С днём рождения,
        # Маша!» — это имя (005a)
        for item in order.items:
            item.inscription_text = None

    # Заявка после обработки не несёт ценности без контактов — удаляем целиком
    requests_query = select(ConsultationRequest).where(
        ConsultationRequest.created_at < cutoff,
        ConsultationRequest.status == ConsultationStatus.COMPLETED,
    )
    requests = list((await session.scalars(requests_query)).all())

    # Фото-образцы — такие же персональные данные, как телефон и почта в строке
    # заявки (с телефона в них ещё и лицо, интерьер квартиры). Удалить строку
    # и оставить файлы в хранилище значило бы потерять на них ссылку, но не сами
    # файлы. Почта уходит вместе со строкой.
    reference_keys = [image.storage_key for row in requests for image in row.images]
    for row in requests:
        await session.delete(row)

    await session.commit()

    # Файлы удаляем после коммита: если коммит упадёт, заявки останутся
    # вместе со своими фото, а не превратятся в строки с битыми ссылками
    for key in reference_keys:
        await storage.delete_image(key)

    result = {"orders_anonymized": len(orders), "requests_deleted": len(requests)}
    if orders or requests:
        logger.info(
            "Очистка ПДн: обезличено заказов — %s, удалено заявок — %s",
            result["orders_anonymized"],
            result["requests_deleted"],
        )
    return result
