"""Адреса старого сайта (Django, abrikosova-elena.ru) → сущности нового (задание 012).

Старый сайт проиндексирован, и чтобы при переезде не потерять позиции, каждый
старый адрес должен одним шагом вести на новый (301). Для статичных адресов
хватает правил в middleware сайта, а этой таблице нужны те, что зависят от
данных: старый слаг товара, старый id подкатегории, старый путь картинки.

Цель хранится ссылкой на сущность (product_id, subcategory_id), а не готовым
адресом: если позже товар или подкатегорию переименуют, редирект пойдёт на
новый слаг сам. Удалили товар — строка удаляется каскадом, и сайт отдаёт
запасной вариант. Заполняется при переносе данных со старого сайта.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LegacyKind(enum.StrEnum):
    # /product/<slug>/ — старый слаг
    PRODUCT = "product"
    # /catalog/<id>/ и /catalog/subcategory/<id>/ — id подкатегории в старой базе
    SUBCATEGORY = "subcategory"
    # /media/<путь>/ — путь файла в старом MEDIA_ROOT
    MEDIA = "media"


class LegacyRedirect(Base):
    __tablename__ = "legacy_redirects"
    __table_args__ = (
        UniqueConstraint("kind", "old_key", name="uq_legacy_redirect_kind_key"),
        CheckConstraint(
            "kind IN ('product', 'subcategory', 'media')", name="ck_legacy_redirect_kind"
        ),
        # У каждого вида — ровно своя цель, чтобы строка не могла вести «никуда»
        CheckConstraint(
            "(kind = 'product' AND product_id IS NOT NULL)"
            " OR (kind = 'subcategory' AND subcategory_id IS NOT NULL)"
            " OR (kind = 'media' AND media_key IS NOT NULL)",
            name="ck_legacy_redirect_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    old_key: Mapped[str] = mapped_column(String(500), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    subcategory_id: Mapped[int | None] = mapped_column(
        ForeignKey("subcategories.id", ondelete="CASCADE")
    )
    # Ключ файла в новом хранилище (как ProductImage.storage_key)
    media_key: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
