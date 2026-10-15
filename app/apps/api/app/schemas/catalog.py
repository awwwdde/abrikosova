"""Схемы каталога."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    Availability,
    DeliveryInterval,
    DietaryTag,
    ImageRole,
    Occasion,
    PortionsRange,
    ProductTag,
    Recipient,
    ReviewSource,
)

# Подписи значений фильтров. Живут на бэкенде, чтобы фронтенд и админка
# не хранили по своей копии перевода и не расходились между собой.
OCCASION_LABELS: dict[Occasion, str] = {
    Occasion.BIRTHDAY: "День рождения",
    Occasion.KIDS: "Детский",
    Occasion.WEDDING: "Свадьба",
    Occasion.CORPORATE: "Корпоратив",
    Occasion.TEA: "К чаю",
    Occasion.ANNIVERSARY: "Юбилей",
}

# Поводы фильтра каталога — как в макете. «Детский» здесь не повод, а «Кому:
# для детей»; в галерее работ `kids` остаётся поводом (задание 009).
CATALOG_OCCASIONS: tuple[Occasion, ...] = (
    Occasion.BIRTHDAY,
    Occasion.WEDDING,
    Occasion.CORPORATE,
    Occasion.TEA,
)

RECIPIENT_LABELS: dict[Recipient, str] = {
    Recipient.HER: "Для неё",
    Recipient.HIM: "Для него",
    Recipient.KIDS: "Для детей",
}

DIETARY_LABELS: dict[DietaryTag, str] = {
    DietaryTag.GLUTEN_FREE: "Без глютена",
    DietaryTag.LACTOSE_FREE: "Без лактозы",
    DietaryTag.LOW_SUGAR: "Сниженный сахар",
}

# Подписи — как в панели фильтров макета (`02-filters-open.png`)
PORTIONS_LABELS: dict[PortionsRange, str] = {
    PortionsRange.UP_TO_4: "До 4 порций",
    PortionsRange.FROM_4_TO_8: "4–8 порций",
    PortionsRange.FROM_8_TO_15: "8–15 порций",
    PortionsRange.OVER_15: "Больше 15 порций",
}

AVAILABILITY_LABELS: dict[Availability, str] = {
    Availability.ANY: "Любой срок",
    Availability.TODAY: "Можно забрать сегодня",
    Availability.PREORDER: "Под заказ",
}

IMAGE_ROLE_LABELS: dict[ImageRole, str] = {
    ImageRole.WHOLE: "Целиком",
    ImageRole.CUT: "Срез",
    ImageRole.DETAIL: "Деталь",
    ImageRole.PACKAGE: "Упаковка",
}


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    is_main: bool
    order: int
    # «Целиком», «Срез», «Деталь», «Упаковка» — подпись миниатюры; пусто — без подписи
    role: ImageRole | None = None


class SubCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    applies_fillings: bool
    # Абзац под сеткой подраздела
    intro: str | None = None
    # Сколько товаров подраздела видно на сайте (без учёта фильтров). 0 — сайт
    # не показывает «таблетку» подраздела
    product_count: int = 0


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    # Абзац под сеткой раздела
    intro: str | None = None
    # Подпись первой «таблетки» подразделов («Все торты»); пусто — «Все»
    all_label: str | None = None
    subcategories: list[SubCategoryOut] = []
    # Сумма по показанным подразделам
    product_count: int = 0


class SubCategoryRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class VariantShort(BaseModel):
    """Вариант в карточке сетки: строку «1–2 кг · 8–10 порций» и «от 2 400 ₽»
    собирает фронтенд из этих полей. Только активные, по порядку; первый —
    вариант по умолчанию."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    price: Decimal
    weight_grams: int | None
    portions_min: int | None
    portions_max: int | None


class VariantOut(VariantShort):
    """Вариант на странице товара — с размером для строки «Вес и размер»."""

    size_note: str | None


class ProductListItem(BaseModel):
    """Карточка товара в сетке каталога.

    Кроме названия и цены несёт ответ на «первый вопрос про размер» — варианты
    с весом и порциями, а также короткий состав и метки ограничений: по макету
    карточки они видны ещё до перехода на страницу товара.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    # Минимальная цена активных вариантов — «от 2 400 ₽», если цены разные
    price_from: Decimal
    # Больше одного активного варианта
    has_variants: bool
    variants: list[VariantShort]
    is_available: bool
    tags: list[ProductTag]
    dietary: list[DietaryTag]
    occasions: list[Occasion]
    recipients: list[Recipient]
    # Короткий состав для карточки; пусто — строку не показывать
    card_ingredients: str | None
    # «+» в карточке кладёт товар в корзину, только если выбирать нечего:
    # один вариант и без надписи. Иначе «+» ведёт на страницу товара (005b)
    allows_inscription: bool
    # Срок с учётом «закончилось сегодня» (006b): у закончившегося — не меньше 1
    lead_time_days: int
    # Закончилось сегодня, можно заказать на завтра (006b). Не «нет в наличии»:
    # то — is_available = False
    sold_out_today: bool = False
    # Строка «классика · 100 г» в карточке: card_label, а если пусто — подкатегория
    subcategory: SubCategoryRef
    card_label: str | None = None
    main_image: str | None = None


class NearestSlot(BaseModel):
    """Ближайшее окно выдачи: «Можно забрать сегодня · ближайшее окно 15:00–18:00».
    Дата завтрашняя — «Можно забрать завтра»."""

    date: date
    interval: DeliveryInterval
    # Сколько дней до окна по часам кондитерской: 0 — «Можно забрать сегодня»,
    # 1 — «завтра». Считает бэкенд: у сайта нет своего «сегодня» по Москве (006)
    days_ahead: int


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
    # Отзыв с Яндекс.Карт показывается со ссылкой на оригинал
    source: ReviewSource
    external_url: str | None = None
    # К какой позиции отзыв — чтобы на главной можно было подписать
    # «о Медовике» и дать ссылку на карточку
    product: ReviewProductRef | None = None


class ProductDetail(BaseModel):
    """Карточка товара. Порядок полей повторяет порядок блоков на странице:
    галерея → название, варианты и цена → состав и метки → хранение → отзывы
    и похожие."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    subtitle: str | None
    price_from: Decimal
    has_variants: bool
    variants: list[VariantOut]
    # Надпись на табличке: можно ли и сколько стоит (цена — из настроек сайта)
    allows_inscription: bool
    inscription_price: Decimal
    # Строка «Доставка … от 500 ₽, бесплатно от 5 000 ₽» — из настроек (007a),
    # а не текстом в контенте контактов
    delivery_price: Decimal
    free_delivery_from: Decimal
    # null — товар сейчас не заказать (снят с наличия)
    nearest_slot: NearestSlot | None
    is_available: bool
    # Срок с учётом «закончилось сегодня» (006b)
    lead_time_days: int
    sold_out_today: bool = False
    # Короткий состав из карточки: у пирожного это строка под названием (006b, «Эстерхази»)
    card_ingredients: str | None = None
    description: str
    composition: str
    allergens: str | None
    packaging: str | None
    nutrition: Nutrition | None
    tags: list[ProductTag]
    dietary: list[DietaryTag]
    occasions: list[Occasion]
    recipients: list[Recipient]
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
    # Сколько товаров останется, если ДОБАВИТЬ это значение к текущему выбору.
    # 0 — значение в панели неактивно («Больше 15 порций 0»)
    count: int


class PriceRange(BaseModel):
    min: Decimal | None
    max: Decimal | None


class CatalogFilters(BaseModel):
    """Всё, что нужно фронтенду, чтобы нарисовать панель фильтров: значения,
    подписи и счётчики по текущему выбору. Группы — в порядке макета."""

    # «Срок» — радио: значение заменяет выбор, а не добавляется к нему
    availability: list[FilterOption[Availability]]
    # «Состав» — через И
    dietary: list[FilterOption[DietaryTag]]
    # «Кому», «Повод», «Порции» — через ИЛИ
    recipients: list[FilterOption[Recipient]]
    occasions: list[FilterOption[Occasion]]
    portions: list[FilterOption[PortionsRange]]
    # Границы цены по выбору без учёта самого фильтра цены. Макет цену в панели
    # не показывает, поле оставлено для будущего
    price: PriceRange
    # Сколько товаров при текущем выборе — для кнопки «Показать»
    total: int


class SitemapSubcategory(BaseModel):
    slug: str


class SitemapCategory(BaseModel):
    slug: str
    subcategories: list[SitemapSubcategory]


class SitemapProduct(BaseModel):
    slug: str
    updated_at: datetime


class CatalogSitemap(BaseModel):
    """Всё, что нужно sitemap.xml сайта, одним лёгким запросом (задание 012).

    Список товаров каталога для этого не годится: он постраничный (до 60 на
    страницу) и тянет фото, цены и метки, а карте нужны только слаги и даты.
    """

    categories: list[SitemapCategory]
    products: list[SitemapProduct]


class LegacyTarget(BaseModel):
    """Куда вести старый адрес: путь на сайте или ключ файла в хранилище.

    Для картинки — ключ, а не готовый адрес: публичный адрес хранилища знает
    сайт (на проде это домен бакета), бэкенду он не нужен.
    """

    location: str | None = None
    media_key: str | None = None
