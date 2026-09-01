"""Бизнес-логика каталога."""

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, Filling, Product, ProductImage, SubCategory
from app.schemas.catalog import ProductDetail, ProductListItem

RELATED_LIMIT = 4


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
        weight=product.weight,
        main_image=_main_image(product),
    )


async def list_products(
    session: AsyncSession,
    *,
    category: str | None = None,
    subcategory: str | None = None,
    search: str | None = None,
    sort: str | None = None,
    is_featured: bool | None = None,
    page: int = 1,
    page_size: int = 12,
) -> tuple[list[ProductListItem], int]:
    query = _visible_products()

    if category:
        query = query.join(Category, Product.category_id == Category.id).where(
            Category.slug == category
        )
    if subcategory:
        query = query.join(SubCategory, Product.subcategory_id == SubCategory.id).where(
            SubCategory.slug == subcategory
        )
    if search:
        # ILIKE с экранированием служебных символов: параметризованный запрос,
        # ручной склейки SQL нет нигде (требование по SQL-инъекциям)
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Product.name.ilike(f"%{escaped}%"))
    if is_featured is not None:
        query = query.where(Product.is_featured.is_(is_featured))

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0

    order_by = {
        "price_asc": (Product.price.asc(),),
        "price_desc": (Product.price.desc(),),
        "name": (Product.name.asc(),),
        "new": (Product.created_at.desc(),),
    }.get(sort or "", (Product.order.asc(), Product.id.asc()))

    query = (
        query.options(selectinload(Product.images))
        .order_by(*order_by)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    products = (await session.scalars(query)).unique().all()
    return [_to_list_item(p) for p in products], total


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
        description=product.description,
        composition=product.composition,
        weight=product.weight,
        portions=product.portions,
        shelf_life=product.shelf_life,
        storage_conditions=product.storage_conditions,
        tags=product.tags,
        main_image=_main_image(product),
        category=product.category,
        subcategory=product.subcategory,
        images=sorted(product.images, key=lambda i: (not i.is_main, i.order)),
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
