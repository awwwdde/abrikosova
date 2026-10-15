"""Пользователи админ-панели и метаданные резервных копий (01-data-model.md, разделы 11, 13)."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import AdminRole, BackupStatus, BackupType
from app.models.mixins import CreatedAtMixin


class AdminUser(Base, CreatedAtMixin):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    # Как обращаться к сотруднику в админке: «Добрый день, Елена», «Ольга Т.» в журнале.
    # Служебное имя коллеги, а не ПДн клиента (011c)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Только хеш (argon2/bcrypt) — пароль в открытом виде не хранится и не логируется
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[AdminRole] = mapped_column(
        SAEnum(AdminRole, name="admin_role", values_callable=lambda e: [i.value for i in e]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class BackupRecord(Base, CreatedAtMixin):
    __tablename__ = "backup_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[BackupType] = mapped_column(
        SAEnum(BackupType, name="backup_type", values_callable=lambda e: [i.value for i in e]),
        nullable=False,
    )
    status: Mapped[BackupStatus] = mapped_column(
        SAEnum(BackupStatus, name="backup_status", values_callable=lambda e: [i.value for i in e]),
        default=BackupStatus.PENDING,
        nullable=False,
    )
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)


class AdminSession(Base):
    """Сессия входа в админку (задание 011a).

    Refresh-токен несёт `sid` этой записи и `jti`, который должен совпасть
    с `current_jti`: так сервер знает все входы сотрудника, умеет «выйти везде»
    и замечает повторное использование уже обменянного refresh-токена (признак
    кражи). Раньше был только denylist отозванных `jti` в Redis — он не давал ни
    списка входов, ни общего отзыва.

    Время жизни: 7 дней без активности (`last_used_at`) и 30 дней абсолютно
    (`expires_at`). Строки удаляет ночная задача через 30 дней после окончания:
    история нужна, чтобы узнать «новое устройство» и для разбора инцидентов.
    """

    __tablename__ = "admin_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[int] = mapped_column(
        ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    current_jti: Mapped[str] = mapped_column(String(64), nullable=False)
    # Предыдущий jti и время ротации: две вкладки админки обновляют токен почти
    # одновременно, и вторая приходит со старым jti. Это не кража — в течение
    # короткого окна (services/sessions.py, ROTATION_GRACE) такой запрос не
    # отзывает сессию, а получает токены на текущий jti.
    previous_jti: Mapped[str | None] = mapped_column(String(64))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
