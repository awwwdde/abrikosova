"""Схемы корзины, заказов, заявок, галереи, отзывов и контента страниц."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Self

from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.clock import local_today
from app.models.enums import DeliveryInterval, DeliveryMethod, Occasion, OrderStatus, PageKey
from app.schemas.catalog import FillingOut, ReviewOut
from app.schemas.common import ConsentMixin, HoneypotMixin, PersonName, Phone

__all__ = ["ReviewOut"]  # переэкспорт: схема живёт в catalog, её отдают и /reviews, и карточка

# --- Галерея, отзывы, страницы ---


class GalleryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_key: str
    caption: str
    description: str | None
    occasion: Occasion | None
    tiers: int | None
    guests: int | None
    made_in: date | None


class PageContentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_key: PageKey
    content: dict[str, Any]
    address: str | None = None
    phone: str | None = None
    work_hours_weekdays: str | None = None
    work_hours_weekend: str | None = None
    delivery_hours: str | None = None
    map_embed_code: str | None = None
    yandex_rating: Decimal | None = None
    yandex_reviews_count: int | None = None
    yandex_maps_url: str | None = None
    telegram_url: str | None = None


class CustomCakeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    price_from: Decimal
    image_key: str


class CustomCakesPageOut(BaseModel):
    cakes: list[CustomCakeOut]
    fillings: list[FillingOut]
    page: PageContentOut | None


# --- Корзина ---


class CartItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int
    quantity: Annotated[int, Field(ge=1, le=99)] = 1


class CartItemQuantityIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # 0 и меньше — удаление позиции (02-api-contract.md)
    quantity: Annotated[int, Field(ge=0, le=99)]


class CartItemOut(BaseModel):
    product_id: int
    name: str
    slug: str
    price: Decimal
    quantity: int
    line_total: Decimal
    main_image: str | None
    is_available: bool
    lead_time_days: int


class CartOut(BaseModel):
    items: list[CartItemOut]
    total_items: int
    total_price: Decimal
    # Самая ранняя дата, к которой можно получить весь заказ: сегодня плюс
    # наибольший срок изготовления среди позиций. Фронтенд ставит её минимумом
    # в календаре оформления, бэкенд проверяет её же при создании заказа.
    earliest_date: date


# --- Заказы ---


class OrderCreate(ConsentMixin, HoneypotMixin):
    customer_name: PersonName
    customer_phone: Phone
    customer_comment: Annotated[str | None, Field(default=None, max_length=2000)]
    delivery_method: DeliveryMethod
    delivery_address: Annotated[str | None, Field(default=None, max_length=500)]
    desired_date: date | None = None
    delivery_interval: DeliveryInterval | None = None

    @model_validator(mode="after")
    def _address_required_for_delivery(self) -> Self:
        is_delivery = self.delivery_method is DeliveryMethod.DELIVERY
        if is_delivery and not (self.delivery_address or "").strip():
            raise ValueError("При доставке адрес обязателен")
        return self

    @model_validator(mode="after")
    def _desired_date_not_in_past(self) -> Self:
        if self.desired_date and self.desired_date < local_today():
            raise ValueError("Желаемая дата не может быть в прошлом")
        return self


class OrderItemOut(BaseModel):
    product_id: int
    name: str
    quantity: int
    price: Decimal
    line_total: Decimal


class OrderOut(BaseModel):
    order_number: str
    customer_name: str
    customer_phone: str
    customer_comment: str | None
    delivery_method: DeliveryMethod
    delivery_address: str | None
    desired_date: date | None
    delivery_interval: DeliveryInterval | None
    total_price: Decimal
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]


class OrderCreated(BaseModel):
    order_number: str


# --- Заявки ---


class ConsultationCreate(ConsentMixin, HoneypotMixin):
    """Заявка на торт под событие (путь 2 из PDF «Этап 1», раздел 13).

    Приходит как multipart/form-data: вместе с полями может ехать фото-референс.
    Повод, дата и гости необязательны — человек может не знать их на старте,
    но если знает, Елене не придётся переспрашивать.
    """

    name: PersonName
    phone: Phone
    description: Annotated[str | None, Field(default=None, max_length=2000)]
    occasion: Occasion | None = None
    event_date: date | None = None
    guests_count: Annotated[int | None, Field(default=None, ge=1, le=1000)]

    @model_validator(mode="after")
    def _event_date_not_in_past(self) -> Self:
        if self.event_date and self.event_date < local_today():
            raise ValueError("Дата события не может быть в прошлом")
        return self


class ConsultationForm(ConsultationCreate):
    """Та же заявка в виде multipart-формы — с необязательным файлом.

    Файл объявлен внутри модели, а не отдельным параметром эндпоинта:
    FastAPI разворачивает форму-модель в плоские поля только тогда, когда
    она единственный параметр тела запроса.
    """

    reference: UploadFile | None = None


class FeedbackCreate(ConsentMixin, HoneypotMixin):
    name: PersonName
    phone: Phone
    message: Annotated[str | None, Field(default=None, max_length=2000)]


class RequestAccepted(BaseModel):
    id: int
    message: str = "Заявка отправлена, свяжемся с вами в ближайшее время"


CustomCakesPageOut.model_rebuild()
