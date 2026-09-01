"""Запись действий администраторов в журнал."""

from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import client_ip
from app.models import AdminUser, AuditLogEntry


async def record(
    session: AsyncSession,
    request: Request,
    admin: AdminUser,
    *,
    action: str,
    entity: str,
    entity_id: str | int | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Фиксирует, кто и что изменил.

    В details попадают только имена изменённых полей — не значения: иначе журнал
    станет второй копией персональных данных клиентов со своим сроком хранения.
    """
    session.add(
        AuditLogEntry(
            actor_id=admin.id,
            actor_email=admin.email,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details,
            ip=client_ip(request),
        )
    )
