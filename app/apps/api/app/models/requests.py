"""Заявки на консультацию и с формы обратной связи (01-data-model.md, раздел 9).

Обе формы сайта пишут в одну таблицу и различаются полем `source`:
`custom_cake` — страница «Торты на заказ», `contact_page` — страница «Контакты».
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import ConsultationSource, ConsultationStatus
from app.models.mixins import TimestampMixin


class ConsultationRequest(Base, TimestampMixin):
    __tablename__ = "consultation_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Актуально только для заявки по торту на заказ
    reference_image_key: Mapped[str | None] = mapped_column(String(500))
    # В старом коде чекбокс был только в вёрстке и на бэкенде не сохранялся.
    # По 152-ФЗ оператор должен уметь доказать факт согласия, поэтому кроме флага
    # фиксируем момент и редакцию политики, с которой человек согласился.
    consent_pd: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_policy_version: Mapped[str | None] = mapped_column(String(20))
    source: Mapped[ConsultationSource] = mapped_column(
        SAEnum(
            ConsultationSource,
            name="consultation_source",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
        index=True,
    )
    status: Mapped[ConsultationStatus] = mapped_column(
        SAEnum(
            ConsultationStatus,
            name="consultation_status",
            values_callable=lambda e: [i.value for i in e],
        ),
        default=ConsultationStatus.NEW,
        nullable=False,
        index=True,
    )
