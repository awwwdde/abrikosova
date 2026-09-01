"""Журнал действий в админ-панели.

02-api-contract.md требует логировать любую мутацию в Admin API («кто, когда,
что изменил»). Отдельная таблица, а не только updated_by в записи: нужна история,
переживающая удаление объекта, — в том числе чтобы понимать, кто и когда смотрел
или менял персональные данные клиентов (152-ФЗ, контроль доступа к ПДн).

Само содержимое ПДн сюда не пишется — только идентификатор объекта и тип
действия, иначе журнал сам стал бы неконтролируемой копией базы клиентов.
"""

from typing import Any

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import CreatedAtMixin


class AuditLogEntry(Base, CreatedAtMixin):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # SET NULL: удаление сотрудника не должно стирать историю его действий
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"), index=True
    )
    actor_email: Mapped[str | None] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(50))
    # Только служебные детали (какие поля затронуты), без значений ПДн
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(String(64))
