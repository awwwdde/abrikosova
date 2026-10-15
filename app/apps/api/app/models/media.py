"""Файлы хранятся порциями: ролик не требует одной большой строки BYTEA."""

from sqlalchemy import BigInteger, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class MediaObject(Base):
    __tablename__ = "media_objects"

    key: Mapped[str] = mapped_column(String(500), primary_key=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)


class MediaChunk(Base):
    __tablename__ = "media_chunks"

    key: Mapped[str] = mapped_column(
        ForeignKey("media_objects.key", ondelete="CASCADE"), primary_key=True
    )
    number: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


# Дампы исключаются из pg_dump отдельной схемой: иначе каждая новая копия
# содержала бы все предыдущие копии и росла в геометрической прогрессии.
class BackupObject(Base):
    __tablename__ = "objects"
    __table_args__ = {"schema": "backup_storage"}

    key: Mapped[str] = mapped_column(String(500), primary_key=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)


class BackupChunk(Base):
    __tablename__ = "chunks"
    __table_args__ = {"schema": "backup_storage"}

    key: Mapped[str] = mapped_column(
        ForeignKey("backup_storage.objects.key", ondelete="CASCADE"), primary_key=True
    )
    number: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
