"""Заявки на консультацию и с формы обратной связи (01-data-model.md, раздел 9).

Обе формы сайта пишут в одну таблицу и различаются полем `source`:
`custom_cake` — страница «Торты на заказ», `contact_page` — страница «Контакты».
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.content import GalleryItem
    from app.models.custom_cakes import CustomCake, Filling
from app.models.enums import (
    ConsultationSource,
    ConsultationStatus,
    ContactMethod,
    DeliveryMethod,
    RequestOccasion,
)
from app.models.mixins import TimestampMixin

# Не больше пяти фото-образцов в заявке (окно заявки, 008a)
MAX_REFERENCE_IMAGES = 5


class ConsultationRequest(Base, TimestampMixin):
    __tablename__ = "consultation_requests"
    __table_args__ = (
        CheckConstraint("guests_count IS NULL OR guests_count >= 1", name="ck_consultation_guests"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # «З-20261007-4F2A» — у заявок на торт (008a); у формы «Контактов» номера нет.
    # Случайный хвост, как у заказа: номер виден человеку и не должен выдавать,
    # сколько заявок приходит
    number: Mapped[str | None] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    # Обязательна для новых заявок на торт — на неё уходит копия; у старых её нет
    email: Mapped[str | None] = mapped_column(String(254))
    contact_method: Mapped[ContactMethod | None] = mapped_column(
        SAEnum(
            ContactMethod,
            name="contact_method",
            values_callable=lambda e: [i.value for i in e],
            create_type=False,
        )
    )
    description: Mapped[str | None] = mapped_column(Text)
    # Путь 2 «Торт на заказ» (PDF «Этап 1», раздел 13): заявка сразу несёт повод,
    # дату и число гостей — то, без чего Елена не может начать разговор про вес
    # и эскиз. Для формы с «Контактов» поля пустые.
    # Свой набор поводов (008a): тот, что в окне заявки
    occasion: Mapped[RequestOccasion | None] = mapped_column(
        SAEnum(
            RequestOccasion,
            name="request_occasion",
            values_callable=lambda e: [i.value for i in e],
        )
    )
    event_date: Mapped[date | None] = mapped_column(Date)
    guests_count: Mapped[int | None] = mapped_column(Integer)
    # Что выбрано на сайте: дизайн из списка, «Заказать похожий» с работы (009)
    # или ничего — «Свой дизайн». Удаление дизайна заявку не трогает
    design_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_cakes.id", ondelete="SET NULL"), index=True
    )
    gallery_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("gallery_items.id", ondelete="SET NULL")
    )
    # Пусто — «Помогите выбрать»
    filling_id: Mapped[int | None] = mapped_column(ForeignKey("fillings.id", ondelete="SET NULL"))
    # «Пожелания к виду». description остаётся сообщением формы «Контактов»
    wishes: Mapped[str | None] = mapped_column(Text)
    # Дополнения со снапшотом цены: [{"name": "Свечи", "price": 200, "from": true}].
    # Снапшот — потому что список в настройках правится, а заявка должна помнить,
    # что человек видел в момент отправки
    extras: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    delivery_method: Mapped[DeliveryMethod | None] = mapped_column(
        SAEnum(
            DeliveryMethod,
            name="delivery_method",
            values_callable=lambda e: [i.value for i in e],
            create_type=False,
        )
    )
    # Ориентир «от X ₽» на момент заявки: {"weight_kg": "6.0", "tiers": 3, "price_from": 27000}
    estimate: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
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

    # Для карточки в админке: название дизайна, подпись работы, начинка
    design: Mapped["CustomCake | None"] = relationship(lazy="selectin")
    gallery_item: Mapped["GalleryItem | None"] = relationship(lazy="selectin")
    filling: Mapped["Filling | None"] = relationship(lazy="selectin")
    images: Mapped[list["ConsultationImage"]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ConsultationImage.order",
        lazy="selectin",
    )

    @property
    def has_reference(self) -> bool:
        return bool(self.images)


class ConsultationImage(Base):
    """Фото-образец заявки (до пяти). Лежит в закрытом префиксе `references/`:
    снимок присылает частное лицо, публичной ссылки у него нет — админка читает
    файл через свой эндпоинт с записью в журнал."""

    __tablename__ = "consultation_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("consultation_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    request: Mapped[ConsultationRequest] = relationship(back_populates="images")
