"""Демо-данные для локальной разработки (01-data-model.md, раздел «Seed-данные»).

Важно: это НЕ контент заказчика. Реальные фото и тексты загружаются через админку
после сдачи; контент из старой SQLite не мигрируется (решение зафиксировано в спеке).
Изображения здесь — плейсхолдер-ключи, реальных файлов в S3 под ними нет.

Запуск:  python -m app.seed
Скрипт идемпотентен: повторный запуск на непустой базе ничего не делает.
На проде сидируется только учётная запись owner (флаг --admin-only).
"""

import argparse
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AdminRole,
    AdminUser,
    Category,
    CustomCake,
    Filling,
    GalleryItem,
    PageContent,
    PageKey,
    Product,
    ProductImage,
    ProductTag,
    Review,
    ReviewSource,
    SubCategory,
)

logger = logging.getLogger(__name__)

# (название категории, slug, [(подкатегория, slug, applies_fillings)])
CATEGORIES: list[tuple[str, str, list[tuple[str, str, bool]]]] = [
    (
        "Торты",
        "torty",
        [
            ("Классические", "klassicheskie", True),
            ("Муссовые", "mussovye", True),
            ("Детские", "detskie", True),
        ],
    ),
    (
        "Десерты",
        "deserty",
        [("Пирожные", "pirozhnye", False), ("Эклеры", "eklery", False)],
    ),
    (
        "Капкейки",
        "kapkeyki",
        [("Ванильные", "vanilnye", False), ("Шоколадные", "shokoladnye", False)],
    ),
    (
        "Сезонное",
        "sezonnoe",
        [("Новогоднее", "novogodnee", False), ("Пасхальное", "pashalnoe", False)],
    ),
]

# (название, slug, индекс категории, индекс подкатегории внутри категории, цена, метки, featured)
PRODUCTS: list[tuple[str, str, int, int, str, list[ProductTag], bool]] = [
    ("Торт «Медовик»", "tort-medovik", 0, 0, "2400.00", [ProductTag.HIT], True),
    ("Торт «Наполеон»", "tort-napoleon", 0, 0, "2600.00", [], True),
    ("Торт «Красный бархат»", "tort-krasnyy-barhat", 0, 0, "2900.00", [ProductTag.HIT], True),
    ("Муссовый торт «Манго-маракуйя»", "muss-mango", 0, 1, "3200.00", [ProductTag.NEW], True),
    ("Муссовый торт «Три шоколада»", "muss-tri-shokolada", 0, 1, "3400.00", [], False),
    ("Детский торт «Единорог»", "detskiy-edinorog", 0, 2, "3800.00", [], False),
    ("Детский торт «Машинка»", "detskiy-mashinka", 0, 2, "3600.00", [], False),
    ("Пирожное «Картошка»", "pirozhnoe-kartoshka", 1, 0, "180.00", [], False),
    ("Пирожное «Тирамису»", "pirozhnoe-tiramisu", 1, 0, "260.00", [ProductTag.HIT], True),
    ("Эклер с ванильным кремом", "ekler-vanil", 1, 1, "190.00", [], False),
    ("Эклер с фисташкой", "ekler-fistashka", 1, 1, "230.00", [ProductTag.NEW], False),
    ("Капкейк ванильный", "kapkeyk-vanilnyy", 2, 0, "220.00", [], False),
    ("Капкейк «Ваниль-малина»", "kapkeyk-vanil-malina", 2, 0, "240.00", [], False),
    ("Капкейк шоколадный", "kapkeyk-shokoladnyy", 2, 1, "230.00", [], True),
    ("Капкейк «Шоколад-карамель»", "kapkeyk-shokolad-karamel", 2, 1, "250.00", [], False),
    ("Новогодний набор пряников", "novogodniy-nabor", 3, 0, "1200.00", [ProductTag.SEASON], True),
    ("Имбирный домик", "imbirnyy-domik", 3, 0, "1800.00", [ProductTag.SEASON], False),
    ("Пасхальный кулич", "pashalnyy-kulich", 3, 1, "650.00", [ProductTag.SEASON], False),
]

FILLINGS: list[tuple[str, str, str]] = [
    ("Ванильный крем", "Классический крем на основе натуральной ванили", "900.00"),
    ("Шоколадный ганаш", "Тёмный шоколад 54% и сливки", "1100.00"),
    ("Малиновое конфи", "Ягодная прослойка из свежей малины", "1200.00"),
    ("Солёная карамель", "Карамель на сливочном масле с морской солью", "1050.00"),
    ("Фисташковый пралине", "Обжаренная фисташка с нежным кремом", "1400.00"),
]

CUSTOM_CAKES: list[tuple[str, str, str]] = [
    ("Свадебный многоярусный", "Двух- и трёхъярусные торты с живыми цветами", "6000.00"),
    ("Юбилейный с декором", "Индивидуальный дизайн под событие", "4500.00"),
    ("Корпоративный с логотипом", "Печать логотипа на съедобной бумаге", "5000.00"),
    ("Бенто-торт", "Маленький торт на одну-две персоны", "1500.00"),
]

GALLERY: list[str] = [
    "Свадебный торт с цветами",
    "Торт на юбилей 50 лет",
    "Детский торт с динозаврами",
    "Капкейки на выпускной",
    "Торт с зеркальной глазурью",
    "Пряничный домик",
    "Корпоративный торт с логотипом",
]

REVIEWS: list[tuple[str, str, int]] = [
    ("Мария", "Заказывала торт на день рождения дочери — восторг у всех гостей!", 5),
    ("Алексей", "Очень вкусный «Наполеон», забрал самовывозом ровно в срок.", 5),
    ("Ольга", "Красивый декор, сладость в меру. Буду заказывать ещё.", 5),
    ("Ирина", "Понравился муссовый торт, доставили аккуратно.", 4),
    ("Дмитрий", "Капкейки на корпоратив — коллеги были довольны.", 5),
]


async def _seed_admin(session, email: str, password_hash: str) -> None:
    exists = await session.scalar(select(func.count()).select_from(AdminUser))
    if exists:
        logger.info("Учётные записи администраторов уже есть — пропускаю")
        return

    session.add(
        AdminUser(email=email, password_hash=password_hash, role=AdminRole.OWNER, is_active=True)
    )
    logger.info("Создан администратор owner: %s", email)


async def _seed_demo(session) -> None:
    exists = await session.scalar(select(func.count()).select_from(Category))
    if exists:
        logger.info("Каталог уже наполнен — пропускаю демо-данные")
        return

    categories: list[Category] = []
    for order, (name, slug, subs) in enumerate(CATEGORIES):
        category = Category(name=name, slug=slug, order=order, is_active=True)
        category.subcategories = [
            SubCategory(
                name=sub_name,
                slug=sub_slug,
                order=sub_order,
                is_active=True,
                applies_fillings=applies,
            )
            for sub_order, (sub_name, sub_slug, applies) in enumerate(subs)
        ]
        categories.append(category)
        session.add(category)

    await session.flush()

    for order, (name, slug, cat_idx, sub_idx, price, tags, featured) in enumerate(PRODUCTS):
        category = categories[cat_idx]
        product = Product(
            name=name,
            slug=slug,
            category_id=category.id,
            subcategory_id=category.subcategories[sub_idx].id,
            price=Decimal(price),
            is_available=True,
            is_active=True,
            description=f"Демо-описание: {name}. Заменяется реальным текстом через админку.",
            composition="Мука, сахар, яйца, сливочное масло, натуральные ароматизаторы",
            weight="1 кг",
            portions="на 8–10 персон",
            shelf_life="3 суток при +2…+6°C",
            storage_conditions="Хранить в холодильнике, не замораживать",
            tags=tags,
            is_featured=featured,
            order=order,
        )
        product.images = [
            ProductImage(
                storage_key=f"placeholder/products/{slug}-{i}.webp", is_main=(i == 0), order=i
            )
            for i in range(2)
        ]
        session.add(product)

    for order, (name, description, price) in enumerate(FILLINGS):
        session.add(
            Filling(
                name=name,
                description=description,
                image_key=f"placeholder/fillings/{order}.webp",
                price_per_kg=Decimal(price),
                is_available=True,
                order=order,
            )
        )

    for order, (title, description, price) in enumerate(CUSTOM_CAKES):
        session.add(
            CustomCake(
                title=title,
                description=description,
                price_from=Decimal(price),
                image_key=f"placeholder/custom-cakes/{order}.webp",
                is_active=True,
                order=order,
            )
        )

    for order, caption in enumerate(GALLERY):
        session.add(
            GalleryItem(
                image_key=f"placeholder/gallery/{order}.webp",
                caption=caption,
                is_active=True,
                order=order,
            )
        )

    for author, text, rating in REVIEWS:
        session.add(
            Review(
                author_name=author,
                text=text,
                rating=rating,
                is_published=True,
                source=ReviewSource.MANUAL,
            )
        )

    for page_key in PageKey:
        session.add(PageContent(page_key=page_key, content={}))

    logger.info(
        "Созданы демо-данные: %d категорий, %d товаров, %d начинок, %d работ в галерее, %d отзывов",
        len(CATEGORIES),
        len(PRODUCTS),
        len(FILLINGS),
        len(GALLERY),
        len(REVIEWS),
    )


async def seed(admin_only: bool = False) -> None:
    settings = get_settings()

    async with SessionLocal() as session:
        if settings.admin_seed_email and settings.admin_seed_password:
            await _seed_admin(
                session,
                settings.admin_seed_email,
                hash_password(settings.admin_seed_password),
            )
        else:
            logger.warning(
                "ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD не заданы — администратор не создан"
            )

        if not admin_only:
            await _seed_demo(session)

        await session.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Наполнение базы данными для разработки")
    parser.add_argument(
        "--admin-only",
        action="store_true",
        help="только учётная запись owner, без демо-каталога (режим для прода)",
    )
    args = parser.parse_args()
    asyncio.run(seed(admin_only=args.admin_only))


if __name__ == "__main__":
    main()
