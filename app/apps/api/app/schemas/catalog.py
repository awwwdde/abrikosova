"""Схемы каталога."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    Availability,
    DietaryTag,
    Occasion,
    PortionsRange,
    ProductTag,
)

# Подписи значений фильтров. Живут на бэкенде, чтобы фронтенд и админка
# не хранили по своей копии перевода и не расходились между собой.
OCCASION_LABELS: dict[Occasion, str] = {
    Occasion.BIRTHDAY: "День рождения",
    Occasion.KIDS: "Детский",
    Occasion.WEDDING: "Свадьба",
    Occasion.CORPORATE: "Корпоратив",
    Occasion.TEA: "К чаю",
}

DIETARY_LABELS: dict[DietaryTag, str] = {
    DietaryTag.GLUTEN_FREE: "Без глютена",
    DietaryTag.LACTOSE_FREE: "Без лактозы",
    DietaryTag.LOW_SUGAR: "Сниженный сахар",
}

PORTIONS_LABELS: dict[PortionsRange, str] = {
    PortionsRange.UP_TO_4: "До 4",
    PortionsRange.FROM_4_TO_8: "4–8",
    PortionsRange.FROM_8_TO_15: "8–15",
    PortionsRange.OVER_15: "Больше 15",
}

AVAILABILITY_LABELS: dict[Availability, str] = {
    Availability.TODAY: "В наличии сегодня",
    Availability.PREORDER: "На заказ",
}


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    is_main: bool
    order: int


class SubCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    applies_fillings: bool


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    subcategories: list[SubCategoryOut] = []


class ProductListItem(BaseModel):
    """Карточка товара в сетке каталога.

    Кроме названия и цены несёт ответ на «первый вопрос про размер» — вес
    и порции, а также состав строкой и метки ограничений: по макету карточки
    они видны ещё до перехода на страницу товара (PDF «Этап 1», раздел 14).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    price: Decimal
    is_available: bool
    tags: list[ProductTag]
    dietary: list[DietaryTag]
    occasions: list[Occasion]
    composition: str
    weight_grams: int
    portions_min: int | None
    portions_max: int | None
    lead_time_days: int
    main_image: str | None = None


class CategoryBreadcrumb(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class SubCategoryBreadcrumb(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str
    applies_fillings: bool


class FillingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    image_key: str
    price_per_kg: Decimal


class Nutrition(BaseModel):
    """КБЖУ на 100 г. Приходит `null`, если не заполнен ни один показатель."""

    kcal: Decimal | None
    proteins: Decimal | None
    fats: Decimal | None
    carbs: Decimal | None


class ReviewProductRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    text: str
    image_key: str | None
    rating: int | None
    created_at: datetime
    # К какой позиции отзыв — чтобы на главной можно было подписать
    # «о Медовике» и дать ссылку на карточку
    product: ReviewProductRef | None = None


class ProductDetail(BaseModel):
    """Карточка товара. Порядок полей повторяет порядок блоков на странице:
    галерея → цена и размер → состав и метки → хранение → отзывы и похожие."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    price: Decimal
    is_available: bool
    weight_grams: int
    portions_min: int | None
    portions_max: int | None
    lead_time_days: int
    description: str
    composition: str
    nutrition: Nutrition | None
    tags: list[ProductTag]
    dietary: list[DietaryTag]
    occasions: list[Occasion]
    shelf_life: str | None
    storage_conditions: str | None
    transport_time: str | None
    main_image: str | None = None
    category: CategoryBreadcrumb
    subcategory: SubCategoryBreadcrumb
    images: list[ProductImageOut]
    reviews: list[ReviewOut] = []
    reviews_total: int = 0
    related_products: list[ProductListItem] = []
    fillings: list[FillingOut] = []


# --- Справочник фильтров ---


class FilterOption[T](BaseModel):
    value: T
    label: str


class PriceRange(BaseModel):
    min: Decimal | None
    max: Decimal | None


class CatalogFilters(BaseModel):
    """Всё, что нужно фронтенду, чтобы нарисовать панель фильтров:
    допустимые значения, их подписи и границы цены по текущей выборке."""

    occasions: list[FilterOption[Occasion]]
    dietary: list[FilterOption[DietaryTag]]
    portions: list[FilterOption[PortionsRange]]
    availability: list[FilterOption[Availability]]
    price: PriceRange
