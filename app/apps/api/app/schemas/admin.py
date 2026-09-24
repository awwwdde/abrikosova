"""Схемы админ-панели: CRUD каталога, контента, заказов и заявок."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    BackupStatus,
    BackupType,
    ConsultationSource,
    ConsultationStatus,
    DeliveryInterval,
    DeliveryMethod,
    DietaryTag,
    Occasion,
    OrderStatus,
    ProductTag,
    ReviewSource,
)

Slug = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]

# Ссылки, которые админка вписывает в контент и которые потом попадают в href
# на сайте. Только https: иначе в поле можно было бы сохранить `javascript:...`
# и получить XSS на каждой странице, где выводится ссылка.
HttpsUrl = Annotated[str, Field(max_length=500, pattern=r"^https://[^\s<>\"']+$")]

# КБЖУ на 100 г: белков/жиров/углеводов физически не больше 100 г,
# калорий — не больше 900 (чистый жир)
Macro = Annotated[Decimal | None, Field(default=None, ge=0, le=100, max_digits=5, decimal_places=1)]

# Максимум фотографий на товар — требование договора, в старом коде не проверялось
MAX_PRODUCT_IMAGES = 6


# Подтверждение восстановления: осмысленное слово, а не «yes» — чтобы его
# нельзя было отправить случайно
RESTORE_CONFIRMATION = "ВОССТАНОВИТЬ"


class BackupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    type: BackupType
    status: BackupStatus
    size_bytes: int | None
    created_at: datetime


class BackupRestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: str


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
    weight_grams: Annotated[int, Field(gt=0, le=100_000)]
    portions_min: Annotated[int | None, Field(default=None, ge=1, le=1000)]
    portions_max: Annotated[int | None, Field(default=None, ge=1, le=1000)]
    kcal: Annotated[
        Decimal | None, Field(default=None, ge=0, le=900, max_digits=6, decimal_places=1)
    ]
    proteins: Macro
    fats: Macro
    carbs: Macro
    shelf_life: Annotated[str | None, Field(default=None, max_length=100)]
    storage_conditions: str | None = None
    transport_time: Annotated[str | None, Field(default=None, max_length=100)]
    lead_time_days: Annotated[int, Field(ge=0, le=60)] = 0
    tags: list[ProductTag] = []
    occasions: list[Occasion] = []
    dietary: list[DietaryTag] = []
    is_featured: bool = False
    order: int = 0

    @field_validator("tags", "occasions", "dietary")
    @classmethod
    def _unique(cls, values: list) -> list:
        # Дубликаты в массиве ничего не ломают, но засоряют данные — убираем,
        # сохраняя порядок, в котором их выбрали в админке
        return list(dict.fromkeys(values))

    @model_validator(mode="after")
    def _portions_range(self) -> "ProductIn":
        """Порции — диапазон: оба конца или ни одного, и «от» не больше «до».

        Одно число («1 порция») вводится как одинаковые «от» и «до».
        То же правило стоит CHECK-ограничением в БД — здесь оно нужно,
        чтобы админка получила понятную 422, а не 409 от базы.
        """
        low, high = self.portions_min, self.portions_max
        if (low is None) != (high is None):
            raise ValueError("Укажите порции «от» и «до» (для одного значения — одинаковые)")
        if low is not None and high is not None and low > high:
            raise ValueError("Порции «от» не могут быть больше «до»")
        return self


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
    occasion: Occasion | None = None
    tiers: Annotated[int | None, Field(default=None, ge=1, le=10)]
    guests: Annotated[int | None, Field(default=None, ge=1, le=10_000)]
    made_in: date | None = None
    is_active: bool = True
    order: int = 0

    @field_validator("made_in")
    @classmethod
    def _first_day_of_month(cls, value: date | None) -> date | None:
        # Хранится месяц, а не день: приводим к первому числу, чтобы «12 мая»
        # и «30 мая» не выглядели разными месяцами при сортировке и выводе
        return value.replace(day=1) if value else None


class GalleryItemAdminOut(GalleryItemIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    created_at: datetime


class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int | None = None
    author_name: Annotated[str, Field(min_length=1, max_length=200)]
    text: str
    image_key: Annotated[str | None, Field(default=None, max_length=500)]
    rating: Annotated[int | None, Field(default=None, ge=1, le=5)]
    is_published: bool = False
    source: ReviewSource = ReviewSource.MANUAL


class ReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int | None = None
    author_name: Annotated[str | None, Field(default=None, min_length=1, max_length=200)]
    text: str | None = None
    rating: Annotated[int | None, Field(default=None, ge=1, le=5)]
    is_published: bool | None = None


class ReviewAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int | None
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
    yandex_rating: Annotated[
        Decimal | None, Field(default=None, ge=0, le=5, max_digits=2, decimal_places=1)
    ]
    yandex_reviews_count: Annotated[int | None, Field(default=None, ge=0)]
    yandex_maps_url: HttpsUrl | None = None
    telegram_url: HttpsUrl | None = None


class OrderAdminListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    customer_name: str
    customer_phone: str
    delivery_method: DeliveryMethod
    desired_date: date | None
    delivery_interval: DeliveryInterval | None
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
    occasion: Occasion | None
    event_date: date | None
    guests_count: int | None
    # Сам ключ закрытого объекта наружу не отдаём — только признак наличия.
    # Файл админка получает через GET /admin/consultations/{id}/reference.
    has_reference: bool
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
