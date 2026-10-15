"""Запись действий администраторов в журнал."""

import enum
from datetime import date, datetime
from decimal import Decimal
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


async def record_auth(
    session: AsyncSession,
    request: Request,
    *,
    action: str,
    admin: AdminUser | None = None,
    email_hash: str | None = None,
    session_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Событие входа (задание 011a): вход, неудача, блокировка, выход, отзыв сессии,
    смена пароля, подозрение на кражу refresh-токена.

    Пароль сюда не попадает никогда. E-mail — только если аккаунт существует;
    для несуществующего пишется хеш: журнал не должен копить адреса, по которым
    перебирали пароли. User-agent обрезается до 300 символов.
    """
    user_agent = request.headers.get("user-agent", "")[:300]
    extra = {"user_agent": user_agent, **(details or {})}
    if admin is None and email_hash:
        extra["email_hash"] = email_hash
    session.add(
        AuditLogEntry(
            actor_id=admin.id if admin else None,
            actor_email=admin.email if admin else None,
            action=action,
            entity="auth",
            entity_id=session_id,
            details=extra,
            ip=client_ip(request),
        )
    )


# --- «Было → стало» (011c) ---

# Поля, значения которых можно хранить в журнале: цены, наличие, видимость, порядок.
# Всё остальное (описания, состав, подписи, имена авторов отзывов) — только имя поля:
# журнал не должен становиться копией контента, а тем более ПДн клиентов.
SAFE_FIELDS = frozenset(
    {
        "name",
        "price",
        "is_available",
        "is_active",
        "lead_time_days",
        "sold_out_today",
        "price_per_kg",
        "weight_grams",
        "order",
    }
)
# Публикация отзыва: важно «опубликован/снят», а не текст и автор
REVIEW_SAFE_FIELDS = frozenset({"is_published", "created_at"})


def _plain(value: Any) -> Any:
    """Значение для JSONB: Decimal → строка «5000.00», enum → его значение."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def apply_changes(
    obj: Any, values: dict[str, Any], safe: frozenset[str] = SAFE_FIELDS
) -> dict[str, Any] | None:
    """Применяет `values` к объекту и возвращает details для журнала — только по
    реально изменённым полям: `{"changes": {"price": ["5000.00", "5200.00"]},
    "fields": ["description"]}`. Ничего не изменилось — None, и запись не нужна:
    `PUT` формы целиком без правок не должен засорять ленту."""
    changes: dict[str, list[Any]] = {}
    fields: list[str] = []
    for field, new in values.items():
        old = getattr(obj, field)
        if old == new:
            continue
        setattr(obj, field, new)
        if field in safe:
            changes[field] = [_plain(old), _plain(new)]
        else:
            fields.append(field)
    if not changes and not fields:
        return None
    details: dict[str, Any] = {}
    if changes:
        details["changes"] = changes
    if fields:
        details["fields"] = fields
    return details


async def record_site(
    session: AsyncSession,
    *,
    action: str,
    entity: str,
    entity_id: str | int | None,
    details: dict[str, Any] | None = None,
) -> None:
    """Событие с сайта: новый заказ, новая заявка (011c). Автора нет (`actor_id` и
    `actor_email` пустые) — в ленте это «Сайт». Ни имени, ни телефона, ни IP
    покупателя: в details только номер, сумма, повод и дата."""
    session.add(
        AuditLogEntry(
            actor_id=None,
            actor_email=None,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details,
            ip=None,
        )
    )
