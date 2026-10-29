"""Схемы админ-панели: CRUD каталога, контента, заказов и заявок."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    BackupStatus,
    BackupType,
    CakeDecoration,
    CakeImageRole,
    ConsultationSource,
    ConsultationStatus,
    ContactMethod,
    DeliveryInterval,
    DeliveryMethod,
    DietaryTag,
    GalleryOccasion,
    ImageRole,
    Occasion,
    OrderStatus,
    ProductTag,
    Recipient,
    RequestOccasion,
    ReviewSource,
)
from app.schemas.common import HttpsUrl

Slug = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]

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
    # Кто создал (имя сотрудника из журнала); пусто — автоматическая копия (011f)
    created_by: str | None = None
    # «Перед восстановлением» — страховочная копия, снятая перед откатом
    note: str | None = None


class BackupRestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: str


class ProductImagesOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: Annotated[list[int], Field(min_length=1, max_length=MAX_PRODUCT_IMAGES)]


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    is_main: bool
    order: int
    role: ImageRole | None = None


class ProductImageRoleIn(BaseModel):
    """Подпись фото: «Целиком», «Срез», «Деталь», «Упаковка»; null — без подписи."""

    model_config = ConfigDict(extra="forbid")

    role: ImageRole | None


class CategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=100)]
    slug: Slug
    order: int = 0
    is_active: bool = True
    # «Текст под списком» на странице раздела
    intro: Annotated[str | None, Field(default=None, max_length=2000)]
    # Подпись первой «таблетки» подразделов: «Все торты»; пусто — «Все»
    all_label: Annotated[str | None, Field(default=None, max_length=50)]

    @field_validator("intro", "all_label")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class SubCategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: int
    name: Annotated[str, Field(min_length=1, max_length=100)]
    slug: Slug
    order: int = 0
    is_active: bool = True
    applies_fillings: bool = False
    intro: Annotated[str | None, Field(default=None, max_length=2000)]

    @field_validator("intro")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class SubCategoryAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    name: str
    slug: str
    order: int
    is_active: bool
    applies_fillings: bool
    intro: str | None = None


class CategoryAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    is_active: bool
    intro: str | None = None
    all_label: str | None = None
    subcategories: list[SubCategoryAdminOut] = []


class VariantIn(BaseModel):
    """Вариант товара в форме админки. `id` — у существующего варианта; без id —
    новый. Порядок вариантов — порядок в списке."""

    model_config = ConfigDict(extra="forbid")

    id: int | None = None
    label: Annotated[str, Field(min_length=1, max_length=50)]
    price: Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]
    # Пусто — для сертификатов и услуг: у них веса нет, а «1 г» вводит в заблуждение
    weight_grams: Annotated[int | None, Field(default=None, gt=0, le=100_000)]
    portions_min: Annotated[int | None, Field(default=None, ge=1, le=1000)]
    portions_max: Annotated[int | None, Field(default=None, ge=1, le=1000)]
    size_note: Annotated[str | None, Field(default=None, max_length=100)]
    is_active: bool = True

    @field_validator("label")
    @classmethod
    def _strip_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Укажите подпись варианта: «1 кг», «6 шт.»")
        return value

    @field_validator("size_note")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    @model_validator(mode="after")
    def _portions_range(self) -> "VariantIn":
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


class VariantAdminOut(VariantIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int  # type: ignore[assignment]
    # Вариант есть в заказах — удалить нельзя, только выключить
    in_orders: bool = False


class ProductIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=200)]
    slug: Slug
    category_id: int
    subcategory_id: int
    is_available: bool = True
    is_active: bool = True
    description: str
    composition: str
    subtitle: Annotated[str | None, Field(default=None, max_length=120)]
    # Короткий состав для карточки — отдельно от полного, не обрезкой
    card_ingredients: Annotated[str | None, Field(default=None, max_length=120)]
    allergens: Annotated[str | None, Field(default=None, max_length=200)]
    packaging: Annotated[str | None, Field(default=None, max_length=200)]
    kcal: Annotated[
        Decimal | None, Field(default=None, ge=0, le=900, max_digits=6, decimal_places=1)
    ]
    proteins: Macro
    fats: Macro
    carbs: Macro
    shelf_life: Annotated[str | None, Field(default=None, max_length=100)]
    storage_conditions: str | None = None
    transport_time: Annotated[str | None, Field(default=None, max_length=100)]
    # Подпись типа позиции в карточке («фирменная позиция»); пусто — подкатегория
    card_label: Annotated[str | None, Field(default=None, max_length=50)]
    lead_time_days: Annotated[int, Field(ge=0, le=60)] = 0
    # «Закончилось сегодня» (006b): до полуночи по Москве — под заказ на завтра.
    # В базе — дата (`sold_out_on`), здесь — переключатель на сегодняшний день
    sold_out_today: bool = False
    tags: list[ProductTag] = []
    occasions: list[Occasion] = []
    dietary: list[DietaryTag] = []
    recipients: list[Recipient] = []
    allows_inscription: bool = False
    is_featured: bool = False
    # «Предлагать в корзине» (007a): блок «К торту часто берут»
    is_upsell: bool = False
    order: int = 0
    # Хотя бы один вариант, и хотя бы один из них включён: иначе товар нечем купить
    variants: Annotated[list[VariantIn], Field(min_length=1, max_length=20)]

    @field_validator("tags", "occasions", "dietary", "recipients")
    @classmethod
    def _unique(cls, values: list) -> list:
        # Дубликаты в массиве ничего не ломают, но засоряют данные — убираем,
        # сохраняя порядок, в котором их выбрали в админке
        return list(dict.fromkeys(values))

    @field_validator("occasions")
    @classmethod
    def _no_kids_occasion(cls, values: list[Occasion]) -> list[Occasion]:
        # «Детский» у товара — получатель («Кому: для детей»), а не повод (005a)
        if Occasion.KIDS in values:
            raise ValueError("«Детский» — не повод, отметьте «Кому: для детей»")
        return values

    @field_validator("subtitle", "card_ingredients", "allergens", "packaging")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    @model_validator(mode="after")
    def _variants(self) -> "ProductIn":
        if not any(variant.is_active for variant in self.variants):
            raise ValueError("Включите хотя бы один вариант — иначе товар нельзя купить")
        ids = [variant.id for variant in self.variants if variant.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("Вариант указан дважды")
        return self


class ProductAdminOut(ProductIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    created_at: datetime
    updated_at: datetime
    variants: list[VariantAdminOut]  # type: ignore[assignment]
    # «от 2 400 ₽» — минимальная цена включённых вариантов
    price_from: Decimal | None


class ProductAdminListItem(ProductAdminOut):
    """Строка списка каталога (011e): товар + главное фото и названия разделов,
    чтобы список не делал по запросу на строку."""

    main_image: str | None = None
    category_name: str = ""
    subcategory_name: str = ""


class ProductBulkAction(BaseModel):
    """Массовое действие над товарами (011e). Один запрос — дифф по каждому товару."""

    model_config = ConfigDict(extra="forbid")

    ids: Annotated[list[int], Field(min_length=1, max_length=200)]
    # sold_out / back_in_stock — «Закончилось сегодня» и обратно (006b)
    action: Literal["hide", "show", "unavailable", "available", "sold_out", "back_in_stock"]


class ProductBulkResult(BaseModel):
    updated: int


class OrderIds(BaseModel):
    """Новый порядок — весь список id целиком (как у фото товара в 011d)."""

    model_config = ConfigDict(extra="forbid")

    ids: Annotated[list[int], Field(min_length=1, max_length=500)]


class CustomCakeImageIn(BaseModel):
    """Фото дизайна: ключ из `POST /admin/upload?prefix=custom-cakes` и подпись."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    storage_key: Annotated[str, Field(min_length=1, max_length=500)]
    role: CakeImageRole | None = None

    @field_validator("storage_key")
    @classmethod
    def _custom_cake_storage_key(cls, value: str) -> str:
        if not value.startswith(("custom-cakes/", "placeholder/custom-cakes/")):
            raise ValueError("Фото должно находиться в каталоге custom-cakes")
        return value


class CustomCakeIn(BaseModel):
    """Дизайн торта на заказ (008a). Цены «от» здесь нет — её считает сервер
    из минимума гостей и цены за кг оформления (Настройки → «Торты на заказ»)."""

    model_config = ConfigDict(extra="forbid")

    slug: Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]
    title: Annotated[str, Field(min_length=1, max_length=200)]
    subtitle: Annotated[str | None, Field(default=None, max_length=300)]
    description: Annotated[str, Field(max_length=5000)] = ""
    occasion: GalleryOccasion
    tiers: Annotated[int, Field(ge=1, le=10)] = 1
    min_guests: Annotated[int, Field(ge=1, le=1000)] = 10
    decoration: CakeDecoration = CakeDecoration.CLASSIC
    # По порядку: первое фото — обложка карточки
    images: Annotated[list[CustomCakeImageIn], Field(max_length=12)] = []
    is_active: bool = True
    order: int = 0


class CustomCakeAdminOut(CustomCakeIn):
    model_config = ConfigDict(extra="ignore")

    id: int
    # Рассчитанное, только для показа: «от 27 000 ₽ · 6 кг · 3 яруса»
    price_from: int
    weight_kg: Decimal
    price_per_kg: int


class FillingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=100)]
    description: str
    # Строка под названием в карточке; пусто — берётся описание
    short_description: Annotated[str | None, Field(default=None, max_length=120)]
    dietary: list[DietaryTag] = []
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
    # Второй кадр при наведении; загружается тем же POST /admin/uploads?prefix=gallery
    detail_image_key: Annotated[str | None, Field(default=None, max_length=500)]
    caption: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None
    occasion: Occasion | None = None
    tiers: Annotated[int | None, Field(default=None, ge=1, le=10)]
    weight_grams: Annotated[int | None, Field(default=None, gt=0, le=100_000)]
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

    @field_validator("image_key", "detail_image_key")
    @classmethod
    def _gallery_storage_key(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("gallery/", "placeholder/gallery/")):
            raise ValueError("Фото должно находиться в каталоге gallery")
        return value


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
    # Ссылка на оригинал — у отзывов с Яндекс.Карт («Читать на Яндекс.Картах»)
    external_url: HttpsUrl | None = None
    # Дата отзыва; пусто — сегодня (011e)
    review_date: date | None = None


class ReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int | None = None
    author_name: Annotated[str | None, Field(default=None, min_length=1, max_length=200)]
    text: str | None = None
    rating: Annotated[int | None, Field(default=None, ge=1, le=5)]
    is_published: bool | None = None
    source: ReviewSource | None = None
    external_url: HttpsUrl | None = None
    # Дата отзыва (011e): у отзывов с Яндекса это дата на Яндекс.Картах, а не день,
    # когда его перенесли в админку. Хранится в created_at — по нему сортирует сайт
    review_date: date | None = None


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
    external_url: str | None
    created_at: datetime
    # Название товара, к которому привязан отзыв, — для строки списка (011e)
    product_name: str | None = None


class ReviewListPage(BaseModel):
    items: list[ReviewAdminOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class PageContentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Для `home` и `contacts` проверяется схемой из schemas/pages.py (в роутере:
    # ключ страницы приходит в пути, а не в теле), у остальных — только ссылки
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
    # Состав одной строкой: «Медовик ×2, Прага» (011d)
    items_summary: str = ""


class OrderListPage(BaseModel):
    """Список заказов (011d): страница + счётчики вкладок по статусам с теми же
    фильтрами даты и способа, чтобы цифры на вкладках совпадали со списком."""

    items: list[OrderAdminListItem]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class OrderAdminItem(BaseModel):
    product_id: int
    # Снапшоты на момент заказа
    name: str
    variant_label: str
    quantity: int
    price: Decimal
    # Надпись на табличке — её пишет кондитер, в карточке заказа она крупно
    inscription_text: str | None
    inscription_price: Decimal | None
    line_total: Decimal
    image_key: str | None


class OrderAdminDetail(BaseModel):
    """Карточка заказа в админке: всё, что нужно менеджеру, включая контакты.
    Каждый просмотр пишется в журнал (152-ФЗ: кто смотрел ПДн клиента)."""

    id: int
    order_number: str
    customer_name: str
    customer_phone: str
    customer_comment: str | None
    # Оформление 007a: почта, способ связи, получатель, адрес по частям
    customer_email: str | None
    contact_method: ContactMethod | None
    recipient_name: str | None
    recipient_phone: str | None
    delivery_method: DeliveryMethod
    delivery_address: str | None
    address_apartment: str | None
    address_entrance: str | None
    address_floor: str | None
    courier_comment: str | None
    desired_date: date | None
    delivery_interval: DeliveryInterval | None
    subtotal: Decimal
    delivery_price: Decimal
    total_price: Decimal
    status: OrderStatus
    cancel_reason: str | None
    created_at: datetime
    # «Пришёл ночью»: вне часов ответа из настроек — звонить утром
    after_hours: bool
    items: list[OrderAdminItem]


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatus
    # Только для отмены, необязательно. Хранится в заказе, в журнал не пишется
    reason: Annotated[str | None, Field(default=None, max_length=500)]


class ConsultationRef(BaseModel):
    """Что выбрано на сайте: дизайн, работа или начинка — id и название."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str


class ConsultationExtra(BaseModel):
    name: str
    price: int
    price_from: Annotated[bool, Field(validation_alias="from")] = False


class ConsultationEstimate(BaseModel):
    weight_kg: Decimal
    tiers: int
    price_per_kg: int
    price_from: int


class ConsultationAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # «З-20261007-4F2A»; у формы «Контактов» номера нет
    number: str | None
    name: str
    phone: str
    email: str | None
    contact_method: ContactMethod | None
    description: str | None
    occasion: RequestOccasion | None
    event_date: date | None
    guests_count: int | None
    design: ConsultationRef | None
    gallery_item: ConsultationRef | None
    filling: ConsultationRef | None
    wishes: str | None
    extras: list[ConsultationExtra]
    delivery_method: DeliveryMethod | None
    estimate: ConsultationEstimate | None
    # Ключи закрытых файлов наружу не отдаём — только id фото-образцов.
    # Файл админка получает через GET /admin/consultations/{id}/images/{image_id}
    image_ids: list[int]
    has_reference: bool
    source: ConsultationSource
    status: ConsultationStatus
    consent_pd: bool
    consent_at: datetime | None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _from_row(cls, value: Any) -> Any:
        # Строка из базы: связи → {id, title}, фото → только id
        if isinstance(value, dict) or not hasattr(value, "images"):
            return value

        def ref(obj: Any, attr: str) -> dict[str, Any] | None:
            return {"id": obj.id, "title": getattr(obj, attr)} if obj is not None else None

        data = {name: getattr(value, name) for name in cls.model_fields if hasattr(value, name)}
        data["design"] = ref(value.design, "title")
        data["gallery_item"] = ref(value.gallery_item, "caption")
        data["filling"] = ref(value.filling, "name")
        data["image_ids"] = [image.id for image in value.images]
        return data


class ConsultationListPage(BaseModel):
    """Заявки (011e): страница + счётчики вкладок с теми же фильтрами."""

    items: list[ConsultationAdminOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


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


class VideoUploadOut(BaseModel):
    storage_key: str
    poster_key: str
