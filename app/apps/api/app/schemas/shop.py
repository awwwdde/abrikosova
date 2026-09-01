"""Схемы корзины, заказов, заявок, галереи, отзывов и контента страниц."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DeliveryMethod, OrderStatus, PageKey
from app.schemas.catalog import FillingOut
from app.schemas.common import ConsentMixin, HoneypotMixin, PersonName, Phone

# --- Галерея, отзывы, страницы ---


class GalleryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_key: str
    caption: str
    description: str | None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    text: str
    image_key: str | None
    rating: int | None
    created_at: datetime


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


class CartOut(BaseModel):
    items: list[CartItemOut]
    total_items: int
    total_price: Decimal


# --- Заказы ---


class OrderCreate(ConsentMixin, HoneypotMixin):
    customer_name: PersonName
    customer_phone: Phone
    customer_comment: Annotated[str | None, Field(default=None, max_length=2000)]
    delivery_method: DeliveryMethod
    delivery_address: Annotated[str | None, Field(default=None, max_length=500)]
    desired_date: date | None = None

    @model_validator(mode="after")
    def _address_required_for_delivery(self) -> Self:
        is_delivery = self.delivery_method is DeliveryMethod.DELIVERY
        if is_delivery and not (self.delivery_address or "").strip():
            raise ValueError("При доставке адрес обязателен")
        return self

    @model_validator(mode="after")
    def _desired_date_not_in_past(self) -> Self:
        if self.desired_date and self.desired_date < date.today():
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
    total_price: Decimal
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]


class OrderCreated(BaseModel):
    order_number: str


# --- Заявки ---


class ConsultationCreate(ConsentMixin, HoneypotMixin):
    name: PersonName
    phone: Phone
    description: Annotated[str | None, Field(default=None, max_length=2000)]


class FeedbackCreate(ConsentMixin, HoneypotMixin):
    name: PersonName
    phone: Phone
    message: Annotated[str | None, Field(default=None, max_length=2000)]


class RequestAccepted(BaseModel):
    id: int
    message: str = "Заявка отправлена, свяжемся с вами в ближайшее время"


CustomCakesPageOut.model_rebuild()
