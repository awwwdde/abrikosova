"""Пользователи админ-панели и метаданные резервных копий (01-data-model.md, разделы 11, 13)."""

from sqlalchemy import BigInteger, Boolean, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import AdminRole, BackupStatus, BackupType
from app.models.mixins import CreatedAtMixin


class AdminUser(Base, CreatedAtMixin):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
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
