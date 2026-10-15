"""Настройки кондитерской, которые владелец меняет в админке (011c).

Отдельная таблица «ключ → JSONB», а не запись в `page_content`: там контент
публичных страниц — его отдаёт публичный API и после правки сбрасывается кэш
сайта. Настройки же видит только админка, и смешивать их с содержимым страниц
значило бы рисковать, что пороги однажды уедут в публичный ответ. Ключ-значение,
а не колонка на каждую настройку: новые пороги добавляются без миграции,
проверку формы делает Pydantic-схема.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class SiteSetting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
