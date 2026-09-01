"""Схемы админ-панели: CRUD каталога, контента, заказов и заявок."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    ConsultationSource,
    ConsultationStatus,
    DeliveryMethod,
    OrderStatus,
    ProductTag,
    ReviewSource,
)

Slug = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]

# Максимум фотографий на товар — требование договора, в старом коде не проверялось
MAX_PRODUCT_IMAGES = 6


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    is_main: bool
    order: int


class CategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=100)]
    slug: Slug
    order: int = 0
    is_active: bool = True


class SubCategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: int
    name: Annotated[str, Field(min_length=1, max_length=100)]
    slug: Slug
    order: int = 0
    is_active: bool = True
    applies_fillings: bool = False


class SubCategoryAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    name: str
    slug: str
    order: int
    is_active: bool
    applies_fillings: bool


class CategoryAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    is_active: bool
    subcategories: list[SubCategoryAdminOut] = []


class ProductIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=200)]
    slug: Slug
    category_id: int
    subcategory_id: int
    price: Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]
    is_available: bool = True
    is_active: bool = True
    description: str
    composition: str
    weight: Annotated[str, Field(min_length=1, max_length=50)]
    portions: Annotated[str | None, Field(default=None, max_length=50)]
    shelf_life: Annotated[str | None, Field(default=None, max_length=100)]
    storage_conditions: str | None = None
    tags: list[ProductTag] = []
    is_featured: bool = False
    order: int = 0


class ProductAdminOut(ProductIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    created_at: datetime
    updated_at: datetime


class CustomCakeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: str
    price_from: Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]
    image_key: Annotated[str, Field(max_length=500)]
    is_active: bool = True
    order: int = 0


class CustomCakeAdminOut(CustomCakeIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int


class FillingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=100)]
    description: str
    image_key: Annotated[str, Field(max_length=500)]
    price_per_kg: Annotated[Decimal, Field(gt=0, max_digits=8, decimal_places=2)]
    is_available: bool = True
    order: int = 0


class FillingAdminOut(FillingIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int


class GalleryItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_key: Annotated[str, Field(max_length=500)]
    caption: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None
    is_active: bool = True
    order: int = 0


class GalleryItemAdminOut(GalleryItemIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    created_at: datetime


class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    author_name: Annotated[str, Field(min_length=1, max_length=200)]
    text: str
    image_key: Annotated[str | None, Field(default=None, max_length=500)]
    rating: Annotated[int | None, Field(default=None, ge=1, le=5)]
    is_published: bool = False
    source: ReviewSource = ReviewSource.MANUAL


class ReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    author_name: Annotated[str | None, Field(default=None, min_length=1, max_length=200)]
    text: str | None = None
    rating: Annotated[int | None, Field(default=None, ge=1, le=5)]
    is_published: bool | None = None


class ReviewAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    text: str
    image_key: str | None
    rating: int | None
    is_published: bool
    source: ReviewSource
    created_at: datetime


class PageContentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: dict[str, Any] = {}
    address: Annotated[str | None, Field(default=None, max_length=500)]
    phone: Annotated[str | None, Field(default=None, max_length=50)]
    work_hours_weekdays: Annotated[str | None, Field(default=None, max_length=100)]
    work_hours_weekend: Annotated[str | None, Field(default=None, max_length=100)]
    delivery_hours: Annotated[str | None, Field(default=None, max_length=100)]
    map_embed_code: str | None = None


class OrderAdminListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    customer_name: str
    customer_phone: str
    delivery_method: DeliveryMethod
    desired_date: date | None
    total_price: Decimal
    status: OrderStatus
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatus


class ConsultationAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    description: str | None
    reference_image_key: str | None
    source: ConsultationSource
    status: ConsultationStatus
    consent_pd: bool
    consent_at: datetime | None
    created_at: datetime


class ConsultationStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ConsultationStatus


class DashboardStats(BaseModel):
    orders_new: int
    orders_today: int
    orders_week: int
    consultations_new: int
    consultations_week: int
    products_total: int
    reviews_unpublished: int
