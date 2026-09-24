"""Заявки на консультацию и с формы обратной связи (01-data-model.md, раздел 9).

Обе формы сайта пишут в одну таблицу и различаются полем `source`:
`custom_cake` — страница «Торты на заказ», `contact_page` — страница «Контакты».
"""

from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import ConsultationSource, ConsultationStatus, Occasion
from app.models.mixins import TimestampMixin


class ConsultationRequest(Base, TimestampMixin):
    __tablename__ = "consultation_requests"
    __table_args__ = (
        CheckConstraint("guests_count IS NULL OR guests_count >= 1", name="ck_consultation_guests"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Путь 2 «Торт на заказ» (PDF «Этап 1», раздел 13): заявка сразу несёт повод,
    # дату и число гостей — то, без чего Елена не может начать разговор про вес
    # и эскиз. Для формы с «Контактов» поля пустые.
    occasion: Mapped[Occasion | None] = mapped_column(
        SAEnum(Occasion, name="occasion", values_callable=lambda e: [i.value for i in e])
    )
    event_date: Mapped[date | None] = mapped_column(Date)
    guests_count: Mapped[int | None] = mapped_column(Integer)
    # Актуально только для заявки по торту на заказ. Лежит в закрытом префиксе
    # хранилища: референс присылает частное лицо, и публичной ссылки у него нет —
    # админка получает временную подписанную ссылку.
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

    @property
    def has_reference(self) -> bool:
        return self.reference_image_key is not None
