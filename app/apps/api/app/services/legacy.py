"""Перенос адресов старого сайта и данные для sitemap.xml (задание 012)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, LegacyKind, LegacyRedirect, Product, SubCategory
from app.schemas.catalog import (
    CatalogSitemap,
    LegacyTarget,
    SitemapCategory,
    SitemapProduct,
    SitemapSubcategory,
)
from app.services.catalog import in_active_category


async def resolve(session: AsyncSession, kind: LegacyKind, old_key: str) -> LegacyTarget | None:
    """Новый адрес для старого или None.

    None и для скрытых сущностей: вести на страницу, которая ответит 404, —
    хуже, чем отдать сайту запасной вариант (для подкатегории это каталог).
    """
    if kind is LegacyKind.PRODUCT:
        slug = await session.scalar(
            select(Product.slug)
            .join(LegacyRedirect, LegacyRedirect.product_id == Product.id)
            .where(
                LegacyRedirect.kind == kind,
                LegacyRedirect.old_key == old_key,
                Product.is_active.is_(True),
            )
        )
        return LegacyTarget(location=f"/product/{slug}") if slug else None

    if kind is LegacyKind.SUBCATEGORY:
        row = (
            await session.execute(
                select(Category.slug, SubCategory.slug)
                .join(SubCategory, SubCategory.category_id == Category.id)
                .join(LegacyRedirect, LegacyRedirect.subcategory_id == SubCategory.id)
                .where(
                    LegacyRedirect.kind == kind,
                    LegacyRedirect.old_key == old_key,
                    Category.is_active.is_(True),
                    SubCategory.is_active.is_(True),
                )
            )
        ).first()
        return LegacyTarget(location=f"/catalog/{row[0]}/{row[1]}") if row else None

    media_key = await session.scalar(
        select(LegacyRedirect.media_key).where(
            LegacyRedirect.kind == kind, LegacyRedirect.old_key == old_key
        )
    )
    return LegacyTarget(media_key=media_key) if media_key else None


async def sitemap(session: AsyncSession) -> CatalogSitemap:
    """Активные категории с активными подкатегориями и активные товары.

    Правила видимости — те же, что у публичного каталога и карточки товара:
    в карту не должен попасть адрес, который отдаст 404.
    """
    categories = (
        await session.scalars(
            select(Category)
            .where(Category.is_active.is_(True))
            .options(selectinload(Category.subcategories))
            .order_by(Category.order, Category.id)
        )
    ).all()
    products = (
        await session.execute(
            select(Product.slug, Product.updated_at)
            # Товары скрытых разделов (007a, «К торту») страницы не имеют — и в карте их нет
            .where(Product.is_active.is_(True), in_active_category())
            .order_by(Product.id)
        )
    ).all()
    return CatalogSitemap(
        categories=[
            SitemapCategory(
                slug=category.slug,
                subcategories=[
                    SitemapSubcategory(slug=sub.slug)
                    for sub in sorted(category.subcategories, key=lambda s: (s.order, s.id))
                    if sub.is_active
                ],
            )
            for category in categories
        ],
        products=[SitemapProduct(slug=slug, updated_at=updated) for slug, updated in products],
    )
