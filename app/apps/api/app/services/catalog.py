"""Бизнес-логика каталога.

Каталог строится по типу продукта (5 групп → подкатегории), а всё, что описывает
ситуацию заказа, работает поверх дерева сквозными фильтрами: повод, ограничения
в питании, срок, порции и цена (PDF «Этап 1», раздел 12).
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Final

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Availability,
    Category,
    DietaryTag,
    Filling,
    Occasion,
    PortionsRange,
    Product,
    ProductImage,
    Review,
    SubCategory,
)
from app.schemas.catalog import (
    AVAILABILITY_LABELS,
    DIETARY_LABELS,
    OCCASION_LABELS,
    PORTIONS_LABELS,
    CatalogFilters,
    FilterOption,
    Nutrition,
    PriceRange,
    ProductDetail,
    ProductListItem,
    ReviewOut,
)

RELATED_LIMIT: Final = 4
# Сколько отзывов отдать прямо в карточке. Остальные — через GET /reviews?product=
PRODUCT_REVIEWS_LIMIT: Final = 6

# Границы корзин фильтра «Порции». None — нет верхней границы.
# Корзины намеренно соприкасаются на 4 и 8: торт «на 4–6 порций» честно
# подходит и под «до 4», и под «4–8», и прятать его из одной из них незачем.
PORTIONS_BOUNDS: Final[dict[PortionsRange, tuple[int, int | None]]] = {
    PortionsRange.UP_TO_4: (1, 4),
    PortionsRange.FROM_4_TO_8: (4, 8),
    PortionsRange.FROM_8_TO_15: (8, 15),
    PortionsRange.OVER_15: (16, None),
}


@dataclass(frozen=True, slots=True)
class ProductQuery:
    """Параметры выборки каталога.

    Собраны в один объект, а не переданы дюжиной именованных аргументов:
    так роутер, сервис и тесты говорят на одном языке, а добавление фильтра
    не меняет сигнатуры всех функций по цепочке.
    """

    category: str | None = None
    subcategory: str | None = None
    search: str | None = None
    sort: str | None = None
    is_featured: bool | None = None
    occasions: list[Occasion] = field(default_factory=list)
    dietary: list[DietaryTag] = field(default_factory=list)
    portions: list[PortionsRange] = field(default_factory=list)
    availability: Availability | None = None
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    page: int = 1
    page_size: int = 12


async def list_categories(session: AsyncSession) -> list[Category]:
    query = (
        select(Category)
        .where(Category.is_active.is_(True))
        .options(selectinload(Category.subcategories))
        .order_by(Category.order, Category.id)
    )
    categories = list((await session.scalars(query)).all())

    # Скрытые подкатегории не должны просачиваться в меню вместе с активной категорией
    for category in categories:
        category.subcategories = [sub for sub in category.subcategories if sub.is_active]

    return categories


def _visible_products() -> Select[tuple[Product]]:
    return select(Product).where(Product.is_active.is_(True))


def escape_like(value: str) -> str:
    """Экранирует служебные символы LIKE, чтобы «%» в поиске искался как символ."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _portions_condition(ranges: list[PortionsRange]) -> ColumnElement[bool]:
    """Товар попадает в корзину, если его диапазон порций пересекается с ней.

    Пересечение отрезков [a, b] и [lo, hi]: a <= hi и b >= lo. Товары без
    порций (наборы, сертификаты) под фильтр по порциям не попадают вовсе.
    """
    conditions = []
    for portions_range in ranges:
        low, high = PORTIONS_BOUNDS[portions_range]
        bucket = Product.portions_max >= low
        if high is not None:
            bucket = and_(bucket, Product.portions_min <= high)
        conditions.append(bucket)
    return or_(*conditions)


def _apply_filters[Q: Select](query: Q, params: ProductQuery) -> Q:
    """Навешивает фильтры на запрос. Работает и для выборки товаров, и для
    агрегатов (границы цены в справочнике фильтров) — отсюда обобщённый тип."""
    if params.category:
        query = query.join(Category, Product.category_id == Category.id).where(
            Category.slug == params.category
        )
    if params.subcategory:
        query = query.join(SubCategory, Product.subcategory_id == SubCategory.id).where(
            SubCategory.slug == params.subcategory
        )
    if params.search:
        # ILIKE с экранированием служебных символов: параметризованный запрос,
        # ручной склейки SQL нет нигде (требование по SQL-инъекциям)
        query = query.where(Product.name.ilike(f"%{escape_like(params.search)}%"))
    if params.is_featured is not None:
        query = query.where(Product.is_featured.is_(params.is_featured))

    # Повод — через ИЛИ: «детский или день рождения» расширяет выбор
    if params.occasions:
        query = query.where(Product.occasions.overlap(params.occasions))
    # Ограничения — через И: человеку без глютена и без лактозы нужен товар,
    # который удовлетворяет обоим условиям, а не хотя бы одному
    if params.dietary:
        query = query.where(Product.dietary.contains(params.dietary))
    if params.portions:
        query = query.where(_portions_condition(params.portions))

    if params.availability is Availability.TODAY:
        query = query.where(Product.lead_time_days == 0, Product.is_available.is_(True))
    elif params.availability is Availability.PREORDER:
        query = query.where(Product.lead_time_days > 0)

    if params.price_min is not None:
        query = query.where(Product.price >= params.price_min)
    if params.price_max is not None:
        query = query.where(Product.price <= params.price_max)
    return query


def _main_image(product: Product) -> str | None:
    for image in product.images:
        if image.is_main:
            return image.storage_key
    return product.images[0].storage_key if product.images else None


def _to_list_item(product: Product) -> ProductListItem:
    return ProductListItem(
        id=product.id,
        name=product.name,
        slug=product.slug,
        price=product.price,
        is_available=product.is_available,
        tags=product.tags,
        dietary=product.dietary,
        occasions=product.occasions,
        composition=product.composition,
        weight_grams=product.weight_grams,
        portions_min=product.portions_min,
        portions_max=product.portions_max,
        lead_time_days=product.lead_time_days,
        main_image=_main_image(product),
    )


def _nutrition(product: Product) -> Nutrition | None:
    values = (product.kcal, product.proteins, product.fats, product.carbs)
    if all(value is None for value in values):
        return None
    return Nutrition(
        kcal=product.kcal, proteins=product.proteins, fats=product.fats, carbs=product.carbs
    )


async def list_products(
    session: AsyncSession, params: ProductQuery
) -> tuple[list[ProductListItem], int]:
    query = _apply_filters(_visible_products(), params)

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Вторичный ключ по id обязателен: без него товары с одинаковой ценой
    # могли бы «переезжать» между страницами при пагинации
    order_by = {
        "price_asc": (Product.price.asc(), Product.id.asc()),
        "price_desc": (Product.price.desc(), Product.id.asc()),
        "name": (Product.name.asc(), Product.id.asc()),
        "new": (Product.created_at.desc(), Product.id.desc()),
    }.get(params.sort or "", (Product.order.asc(), Product.id.asc()))

    query = (
        query.options(selectinload(Product.images))
        .order_by(*order_by)
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )

    products = (await session.scalars(query)).unique().all()
    return [_to_list_item(p) for p in products], total


async def get_filters(session: AsyncSession, category: str | None = None) -> CatalogFilters:
    """Справочник фильтров и границы цены — по всему каталогу или по категории."""
    price_query = _apply_filters(
        select(func.min(Product.price), func.max(Product.price)).where(Product.is_active.is_(True)),
        ProductQuery(category=category),
    )
    price_min, price_max = (await session.execute(price_query)).one()

    return CatalogFilters(
        occasions=[FilterOption(value=k, label=v) for k, v in OCCASION_LABELS.items()],
        dietary=[FilterOption(value=k, label=v) for k, v in DIETARY_LABELS.items()],
        portions=[FilterOption(value=k, label=v) for k, v in PORTIONS_LABELS.items()],
        availability=[FilterOption(value=k, label=v) for k, v in AVAILABILITY_LABELS.items()],
        price=PriceRange(min=price_min, max=price_max),
    )


def published_reviews() -> Select[tuple[Review]]:
    return select(Review).where(Review.is_published.is_(True)).options(selectinload(Review.product))


async def get_product_detail(session: AsyncSession, slug: str) -> ProductDetail | None:
    query = (
        _visible_products()
        .where(Product.slug == slug)
        .options(
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.subcategory),
        )
    )
    product = (await session.scalars(query)).unique().one_or_none()
    if product is None:
        return None

    related_query = (
        _visible_products()
        .where(
            Product.subcategory_id == product.subcategory_id,
            Product.id != product.id,
        )
        .options(selectinload(Product.images))
        .order_by(Product.order, Product.id)
        .limit(RELATED_LIMIT)
    )
    related = (await session.scalars(related_query)).unique().all()

    reviews_query = published_reviews().where(Review.product_id == product.id)
    reviews_total = (
        await session.scalar(select(func.count()).select_from(reviews_query.subquery())) or 0
    )
    reviews = (
        await session.scalars(
            reviews_query.order_by(Review.created_at.desc(), Review.id.desc()).limit(
                PRODUCT_REVIEWS_LIMIT
            )
        )
    ).all()

    # Начинки показываем только для подкатегорий, помеченных флагом в админке,
    # а не по совпадению слова «торт» в названии, как это делалось раньше
    fillings: list[Filling] = []
    if product.subcategory.applies_fillings:
        fillings_query = (
            select(Filling)
            .where(Filling.is_available.is_(True))
            .order_by(Filling.order, Filling.id)
        )
        fillings = list((await session.scalars(fillings_query)).all())

    return ProductDetail(
        id=product.id,
        name=product.name,
        slug=product.slug,
        price=product.price,
        is_available=product.is_available,
        weight_grams=product.weight_grams,
        portions_min=product.portions_min,
        portions_max=product.portions_max,
        lead_time_days=product.lead_time_days,
        description=product.description,
        composition=product.composition,
        nutrition=_nutrition(product),
        tags=product.tags,
        dietary=product.dietary,
        occasions=product.occasions,
        shelf_life=product.shelf_life,
        storage_conditions=product.storage_conditions,
        transport_time=product.transport_time,
        main_image=_main_image(product),
        category=product.category,
        subcategory=product.subcategory,
        images=sorted(product.images, key=lambda i: (not i.is_main, i.order)),
        reviews=[ReviewOut.model_validate(r) for r in reviews],
        reviews_total=reviews_total,
        related_products=[_to_list_item(p) for p in related],
        fillings=fillings,
    )


async def enforce_single_main_image(session: AsyncSession, product_id: int, image_id: int) -> None:
    """Главное фото ровно одно — сбрасываем остальные на уровне сервиса.

    Полагаться на то, что клиент пришлёт корректный набор флагов, нельзя.
    """
    images = (
        await session.scalars(select(ProductImage).where(ProductImage.product_id == product_id))
    ).all()
    for image in images:
        image.is_main = image.id == image_id
