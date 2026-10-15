"""Бизнес-логика каталога.

Каталог строится по типу продукта (5 групп → подкатегории), а всё, что описывает
ситуацию заказа, работает поверх дерева сквозными фильтрами: срок, состав, кому,
повод, порции и цена (PDF «Этап 1», раздел 12; макет `02-filters-open.png`).

Цена, вес и порции — у вариантов товара (005a). Товар попадает в «4–8 порций»
или в диапазон цены, если подходит ЛЮБОЙ его активный вариант, а сортировка
по цене идёт по `price_from` — минимальной цене активных вариантов.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from decimal import Decimal
from typing import Any, Final

from sqlalchemy import (
    ColumnElement,
    Select,
    and_,
    case,
    exists,
    func,
    or_,
    select,
    true,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.clock import local_today
from app.models import (
    Availability,
    Category,
    DietaryTag,
    Filling,
    Occasion,
    PortionsRange,
    Product,
    ProductImage,
    ProductVariant,
    Recipient,
    Review,
    SubCategory,
)
from app.schemas.catalog import (
    AVAILABILITY_LABELS,
    CATALOG_OCCASIONS,
    DIETARY_LABELS,
    OCCASION_LABELS,
    PORTIONS_LABELS,
    RECIPIENT_LABELS,
    CatalogFilters,
    CategoryOut,
    FilterOption,
    NearestSlot,
    Nutrition,
    PriceRange,
    ProductDetail,
    ProductListItem,
    ReviewOut,
    SubCategoryOut,
    SubCategoryRef,
    VariantOut,
    VariantShort,
)
from app.services import bakery_settings, slots

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
    availability: Availability | None = None
    dietary: list[DietaryTag] = field(default_factory=list)
    recipients: list[Recipient] = field(default_factory=list)
    occasions: list[Occasion] = field(default_factory=list)
    portions: list[PortionsRange] = field(default_factory=list)
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    page: int = 1
    page_size: int = 12


async def list_categories(session: AsyncSession) -> list[CategoryOut]:
    """Дерево активных разделов со счётчиком товаров, видимых на сайте.

    Счётчик — без учёта фильтров, одним запросом с группировкой: по нему сайт
    не показывает «таблетку» подраздела, в котором нечего купить (ревью 005a).
    """
    query = (
        select(Category)
        .where(Category.is_active.is_(True))
        .options(selectinload(Category.subcategories))
        .order_by(Category.order, Category.id)
    )
    categories = list((await session.scalars(query)).all())
    counts: dict[int, int] = dict(
        (
            await session.execute(
                select(Product.subcategory_id, func.count(Product.id))
                .where(_visible())
                .group_by(Product.subcategory_id)
            )
        ).all()
    )

    result: list[CategoryOut] = []
    for category in categories:
        # Скрытые подкатегории не просачиваются в меню вместе с активной категорией.
        # Список собирается заново, а не присваивается ORM-объекту: у связи
        # delete-orphan, и «отфильтрованная» коллекция могла бы удалить подразделы
        subcategories = [
            SubCategoryOut.model_validate(sub).model_copy(
                update={"product_count": counts.get(sub.id, 0)}
            )
            for sub in category.subcategories
            if sub.is_active
        ]
        out = CategoryOut.model_validate(
            {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "order": category.order,
                "intro": category.intro,
                "all_label": category.all_label,
                "subcategories": subcategories,
                "product_count": sum(sub.product_count for sub in subcategories),
            }
        )
        result.append(out)
    return result


# --- Условия по вариантам ---


def _has_active_variant(*conditions: ColumnElement[bool]) -> ColumnElement[bool]:
    """У товара есть активный вариант, удовлетворяющий условиям."""
    return exists().where(
        ProductVariant.product_id == Product.id,
        ProductVariant.is_active.is_(True),
        *conditions,
    )


def price_from_column() -> Any:
    """`price_from` — минимальная цена активных вариантов (коррелированный подзапрос)."""
    return (
        select(func.min(ProductVariant.price))
        .where(ProductVariant.product_id == Product.id, ProductVariant.is_active.is_(True))
        .correlate(Product)
        .scalar_subquery()
    )


def in_active_category() -> ColumnElement[bool]:
    """Раздел товара включён. Скрытый раздел (007a: «К торту» — свечи, открытки)
    прячет свои товары из каталога, со страницы товара и из sitemap, но корзина
    их по-прежнему принимает: их предлагает блок «К торту часто берут»."""
    return Product.category_id.in_(select(Category.id).where(Category.is_active.is_(True)))


def _visible() -> ColumnElement[bool]:
    """Товар виден на сайте: включён, его раздел включён и его можно купить хотя бы
    одним весом."""
    return and_(Product.is_active.is_(True), in_active_category(), _has_active_variant())


def _visible_products() -> Select[tuple[Product]]:
    return select(Product).where(_visible())


def escape_like(value: str) -> str:
    """Экранирует служебные символы LIKE, чтобы «%» в поиске искался как символ."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _portions_condition(ranges: Sequence[PortionsRange]) -> ColumnElement[bool]:
    """Товар попадает в корзину, если диапазон порций ЛЮБОГО его активного
    варианта пересекается с ней.

    Пересечение отрезков [a, b] и [lo, hi]: a <= hi и b >= lo. Варианты без
    порций (наборы, сертификаты) под фильтр по порциям не попадают вовсе.
    """
    buckets = []
    for portions_range in ranges:
        low, high = PORTIONS_BOUNDS[portions_range]
        bucket = ProductVariant.portions_max >= low
        if high is not None:
            bucket = and_(bucket, ProductVariant.portions_min <= high)
        buckets.append(bucket)
    return _has_active_variant(or_(*buckets))


def _availability_condition(value: Availability | None) -> ColumnElement[bool] | None:
    if value is Availability.TODAY:
        return and_(Product.effective_lead_time_days == 0, Product.is_available.is_(True))
    if value is Availability.PREORDER:
        # «Закончилось сегодня» (006b) — тоже «под заказ»: на завтра
        return Product.effective_lead_time_days > 0
    return None


def _dietary_condition(tags: Sequence[DietaryTag]) -> ColumnElement[bool] | None:
    # Ограничения — через И: человеку без глютена и без лактозы нужен товар,
    # который удовлетворяет обоим условиям, а не хотя бы одному
    return Product.dietary.contains(list(tags)) if tags else None


def _facet_conditions(params: ProductQuery) -> dict[str, ColumnElement[bool] | None]:
    """Условия групп фильтров панели. Ключ — группа, None — группа не выбрана.

    Повод, «кому» и порции — через ИЛИ: «день рождения или к чаю» расширяет выбор.
    """
    return {
        "availability": _availability_condition(params.availability),
        "dietary": _dietary_condition(params.dietary),
        "recipients": (
            Product.recipients.overlap(params.recipients) if params.recipients else None
        ),
        "occasions": Product.occasions.overlap(params.occasions) if params.occasions else None,
        "portions": _portions_condition(params.portions) if params.portions else None,
    }


def _base_conditions(params: ProductQuery) -> list[ColumnElement[bool]]:
    """Условия вне панели фильтров: видимость, раздел, поиск, витрина, цена."""
    conditions: list[ColumnElement[bool]] = [_visible()]
    if params.category:
        conditions.append(
            Product.category_id.in_(select(Category.id).where(Category.slug == params.category))
        )
    if params.subcategory:
        conditions.append(
            Product.subcategory_id.in_(
                select(SubCategory.id).where(SubCategory.slug == params.subcategory)
            )
        )
    if params.search:
        # ILIKE с экранированием служебных символов: параметризованный запрос,
        # ручной склейки SQL нет нигде (требование по SQL-инъекциям)
        conditions.append(Product.name.ilike(f"%{escape_like(params.search)}%"))
    if params.is_featured is not None:
        conditions.append(Product.is_featured.is_(params.is_featured))
    price = _price_condition(params)
    if price is not None:
        conditions.append(price)
    return conditions


def _price_condition(params: ProductQuery) -> ColumnElement[bool] | None:
    """Товар в диапазоне цены, если в него попадает любой активный вариант."""
    bounds = []
    if params.price_min is not None:
        bounds.append(ProductVariant.price >= params.price_min)
    if params.price_max is not None:
        bounds.append(ProductVariant.price <= params.price_max)
    return _has_active_variant(*bounds) if bounds else None


def _all_conditions(params: ProductQuery) -> list[ColumnElement[bool]]:
    facets = [c for c in _facet_conditions(params).values() if c is not None]
    return [*_base_conditions(params), *facets]


# --- Ответы ---


def _main_image(product: Product) -> str | None:
    for image in product.images:
        if image.is_main:
            return image.storage_key
    return product.images[0].storage_key if product.images else None


def _active_variants(product: Product) -> list[ProductVariant]:
    return [v for v in product.variants if v.is_active]


def _to_list_item(product: Product) -> ProductListItem:
    variants = _active_variants(product)
    return ProductListItem(
        id=product.id,
        name=product.name,
        slug=product.slug,
        price_from=min(v.price for v in variants),
        has_variants=len(variants) > 1,
        variants=[VariantShort.model_validate(v) for v in variants],
        is_available=product.is_available,
        tags=product.tags,
        dietary=product.dietary,
        occasions=product.occasions,
        recipients=product.recipients,
        card_ingredients=product.card_ingredients,
        allows_inscription=product.allows_inscription,
        lead_time_days=product.effective_lead_time_days,
        sold_out_today=product.sold_out_today,
        subcategory=SubCategoryRef.model_validate(product.subcategory),
        card_label=product.card_label,
        main_image=_main_image(product),
    )


def _nutrition(product: Product) -> Nutrition | None:
    values = (product.kcal, product.proteins, product.fats, product.carbs)
    if all(value is None for value in values):
        return None
    return Nutrition(
        kcal=product.kcal, proteins=product.proteins, fats=product.fats, carbs=product.carbs
    )


def _list_options() -> list:
    return [
        selectinload(Product.images),
        selectinload(Product.subcategory),
        selectinload(Product.variants),
    ]


def _order_by(sort: str | None) -> tuple[Any, ...]:
    """Вторичный ключ по id обязателен: без него товары с одинаковой ценой
    могли бы «переезжать» между страницами при пагинации."""
    if sort == "price_asc":
        return (price_from_column().asc(), Product.id.asc())
    if sort == "price_desc":
        return (price_from_column().desc(), Product.id.asc())
    if sort == "new":
        return (Product.created_at.desc(), Product.id.desc())
    # today_first — по умолчанию: сначала то, что можно забрать сегодня,
    # внутри — порядок, заданный в админке
    ready_today = case(
        (and_(Product.effective_lead_time_days == 0, Product.is_available.is_(True)), 0), else_=1
    )
    return (ready_today, Product.order.asc(), Product.id.asc())


CAKES_CATEGORY_SLUG: Final = "torty"
UPSELL_LIMIT: Final = 4


async def list_upsell(
    session: AsyncSession, cart_product_ids: Sequence[int]
) -> list[ProductListItem]:
    """«К торту часто берут» (007a): до четырёх товаров «Предлагать в корзине»,
    которые можно забрать сегодня и которых ещё нет в корзине.

    Блок только для корзины с тортом: свечи и открытка к пирожному не нужны. Раздел
    товара может быть скрыт («К торту») — поэтому здесь не `_visible()`, а включённый
    товар с включённым вариантом.
    """
    if not cart_product_ids:
        return []
    has_cake = await session.scalar(
        select(func.count(Product.id))
        .join(Category, Category.id == Product.category_id)
        .where(Product.id.in_(cart_product_ids), Category.slug == CAKES_CATEGORY_SLUG)
    )
    if not has_cake:
        return []
    query = (
        select(Product)
        .where(
            Product.is_upsell.is_(True),
            Product.is_active.is_(True),
            Product.is_available.is_(True),
            Product.effective_lead_time_days == 0,
            _has_active_variant(),
            Product.id.not_in(cart_product_ids),
        )
        .options(*_list_options())
        .order_by(Product.order, Product.id)
        .limit(UPSELL_LIMIT)
    )
    return [_to_list_item(product) for product in (await session.scalars(query)).unique()]


async def list_products(
    session: AsyncSession, params: ProductQuery
) -> tuple[list[ProductListItem], int]:
    conditions = _all_conditions(params)

    total = await session.scalar(select(func.count(Product.id)).where(*conditions)) or 0

    query = (
        select(Product)
        .where(*conditions)
        .options(*_list_options())
        .order_by(*_order_by(params.sort))
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    products = (await session.scalars(query)).unique().all()
    return [_to_list_item(p) for p in products], total


async def get_filters(session: AsyncSession, params: ProductQuery) -> CatalogFilters:
    """Справочник фильтров со счётчиками по текущему выбору (фасеты).

    Счётчик значения — сколько товаров останется, если ДОБАВИТЬ его к выбору:
    * в группах через ИЛИ (кому, повод, порции) выбор своей группы при подсчёте
      не учитывается — добавление значения расширяет выдачу;
    * в группе через И (состав) — учитывается вместе с новым значением;
    * «Срок» — радио: значение заменяет выбор своей группы.

    Все счётчики — один запрос `count(*) FILTER (WHERE …)` по выборке без
    условий панели; второй запрос — границы цены.
    """
    facets = _facet_conditions(params)
    base = _base_conditions(params)

    def without(group: str, extra: ColumnElement[bool] | None) -> ColumnElement[bool]:
        parts = [c for g, c in facets.items() if g != group and c is not None]
        if extra is not None:
            parts.append(extra)
        return and_(true(), *parts)

    # (группа, значение, условие значения): своё условие группы заменяется им
    values: list[tuple[str, Any, ColumnElement[bool] | None]] = [
        *(("availability", v, _availability_condition(v)) for v in AVAILABILITY_LABELS),
        # Состав — через И: к уже выбранному добавляется новое значение
        *(
            ("dietary", tag, _dietary_condition(list(dict.fromkeys([*params.dietary, tag]))))
            for tag in DIETARY_LABELS
        ),
        *(("recipients", r, Product.recipients.overlap([r])) for r in RECIPIENT_LABELS),
        *(("occasions", o, Product.occasions.overlap([o])) for o in CATALOG_OCCASIONS),
        *(("portions", b, _portions_condition([b])) for b in PORTIONS_LABELS),
    ]
    columns = [(group, value, without(group, extra)) for group, value, extra in values]

    counts_query = select(
        func.count().filter(without("", None)),
        *(func.count().filter(condition) for _, _, condition in columns),
    ).where(*base)
    total, *counts = (await session.execute(counts_query)).one()

    options: dict[str, list[FilterOption[Any]]] = {
        "availability": [],
        "dietary": [],
        "recipients": [],
        "occasions": [],
        "portions": [],
    }
    labels: dict[str, dict[Any, str]] = {
        "availability": AVAILABILITY_LABELS,
        "dietary": DIETARY_LABELS,
        "recipients": RECIPIENT_LABELS,
        "occasions": OCCASION_LABELS,
        "portions": PORTIONS_LABELS,
    }
    for (group, value, _), count in zip(columns, counts, strict=True):
        options[group].append(FilterOption(value=value, label=labels[group][value], count=count))

    # Границы цены — по активным вариантам выборки без самого фильтра цены.
    # Внешний вариант — под псевдонимом: условия выборки содержат EXISTS по
    # product_variants, и без псевдонима подзапрос «прилип» бы к внешней таблице
    no_price = replace(params, price_min=None, price_max=None)
    outer = aliased(ProductVariant)
    price_query = (
        select(func.min(outer.price), func.max(outer.price))
        .join(Product, Product.id == outer.product_id)
        .where(outer.is_active.is_(True), *_all_conditions(no_price))
    )
    price_min, price_max = (await session.execute(price_query)).one()

    return CatalogFilters(
        availability=options["availability"],
        dietary=options["dietary"],
        recipients=options["recipients"],
        occasions=options["occasions"],
        portions=options["portions"],
        price=PriceRange(min=price_min, max=price_max),
        total=total,
    )


def published_reviews() -> Select[tuple[Review]]:
    return select(Review).where(Review.is_published.is_(True)).options(selectinload(Review.product))


async def get_product_detail(session: AsyncSession, slug: str) -> ProductDetail | None:
    query = (
        _visible_products()
        .where(Product.slug == slug)
        .options(
            *_list_options(),
            selectinload(Product.category),
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
        .options(*_list_options())
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

    settings = await bakery_settings.load(session)
    variants = _active_variants(product)
    # Окно — та же функция, что проверяет дату в заказе: карточка не обещает
    # того, что потом не примет оформление
    nearest = (
        slots.nearest_slot([product.effective_lead_time_days], settings.slot_cutoff_minutes)
        if product.is_available
        else None
    )

    return ProductDetail(
        id=product.id,
        name=product.name,
        slug=product.slug,
        subtitle=product.subtitle,
        price_from=min(v.price for v in variants),
        has_variants=len(variants) > 1,
        variants=[VariantOut.model_validate(v) for v in variants],
        allows_inscription=product.allows_inscription,
        inscription_price=Decimal(settings.inscription_price).quantize(Decimal("0.01")),
        delivery_price=Decimal(settings.delivery_price).quantize(Decimal("0.01")),
        free_delivery_from=Decimal(settings.free_delivery_from).quantize(Decimal("0.01")),
        nearest_slot=(
            NearestSlot(
                date=nearest.date,
                interval=nearest.interval,
                days_ahead=(nearest.date - local_today()).days,
            )
            if nearest
            else None
        ),
        is_available=product.is_available,
        lead_time_days=product.effective_lead_time_days,
        sold_out_today=product.sold_out_today,
        card_ingredients=product.card_ingredients,
        description=product.description,
        composition=product.composition,
        allergens=product.allergens,
        packaging=product.packaging,
        nutrition=_nutrition(product),
        tags=product.tags,
        dietary=product.dietary,
        occasions=product.occasions,
        recipients=product.recipients,
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
