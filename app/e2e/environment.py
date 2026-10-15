"""Подготовка редиректа и удаление только помеченных данных smoke-теста."""

import asyncio
import json
import sys
import uuid

from sqlalchemy import delete, func, select

from app.core.db import SessionLocal
from app.models import Cart, ConsultationRequest, Order, Product
from app.models.audit import AuditLogEntry
from app.models.legacy import LegacyKind, LegacyRedirect
from app.services import legacy, storage


def emit(value):
    # stdout — протокол между помощником в контейнере и хостовым пакетом.
    sys.stdout.write(f"{value}\n")


async def main():
    mode, data = sys.argv[1], json.loads(sys.argv[2])
    if mode == "email":
        from email_validator import EmailNotValidError, validate_email

        for value in data:
            try:
                validate_email(value, check_deliverability=False)
                emit(f"{value}: accepted")
            except EmailNotValidError as error:
                emit(f"{value}: {error}")
        return
    async with SessionLocal() as db:
        if mode == "legacy":
            for row in (await db.scalars(select(LegacyRedirect).order_by(LegacyRedirect.id))).all():
                target = await legacy.resolve(db, LegacyKind(row.kind), row.old_key)
                if target and target.location:
                    source = (
                        f"/product/{row.old_key}/"
                        if row.kind == "product"
                        else f"/catalog/{row.old_key}/"
                    )
                    emit(json.dumps({"source": source, "target": target.location}))
                    return
            # В пустой таблице создаём временный старый адрес для выбранного товара.
            product = await db.get(Product, data["product_id"])
            key = f"smoke-{data['run']}"
            db.add(LegacyRedirect(kind="product", old_key=key, product_id=product.id))
            await db.commit()
            emit(json.dumps({"source": f"/product/{key}/", "target": f"/product/{product.slug}"}))
            return

        prefix = data["prefix"]
        if not prefix.startswith("SMOKE Тест "):
            raise ValueError("Очистка разрешена только для метки smoke-теста")
        orders = (
            await db.scalars(
                select(Order).where(
                    Order.customer_name.startswith(prefix),
                    Order.customer_email.endswith("@example.com"),
                )
            )
        ).all()
        requests = (
            await db.scalars(
                select(ConsultationRequest).where(
                    ConsultationRequest.name.startswith(prefix),
                    ConsultationRequest.email.endswith("@example.com"),
                )
            )
        ).all()
        if mode == "verify":
            emit(json.dumps({"orders_SMOKE": len(orders), "consultations_SMOKE": len(requests)}))
            return
        keys = [image.storage_key for row in requests for image in row.images]
        for key in keys:
            await storage.delete_image(key)
            if await storage.read_object(key) is not None:
                raise RuntimeError("Тестовое фото не удалено из хранилища")
        for entity, rows in [("order", orders), ("consultation", requests)]:
            if rows:
                await db.execute(
                    delete(AuditLogEntry).where(
                        AuditLogEntry.entity == entity,
                        AuditLogEntry.entity_id.in_([str(row.id) for row in rows]),
                    )
                )
            for row in rows:
                await db.delete(row)
        carts = [uuid.UUID(value) for value in data.get("carts", [])]
        if carts:
            await db.execute(delete(Cart).where(Cart.id.in_(carts)))
        if data.get("run"):
            await db.execute(
                delete(LegacyRedirect).where(LegacyRedirect.old_key == f"smoke-{data['run']}")
            )
        await db.commit()
        emit(
            json.dumps(
                {
                    "deleted_orders": len(orders),
                    "deleted_consultations": len(requests),
                    "deleted_photos": len(keys),
                    "deleted_carts": len(carts),
                }
            )
        )
        remaining = await db.scalar(
            select(func.count()).select_from(Order).where(Order.customer_name.startswith(prefix))
        )
        if remaining:
            raise RuntimeError("После очистки остались тестовые заказы")


asyncio.run(main())
