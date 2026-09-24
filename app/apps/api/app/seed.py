"""Демо-данные для локальной разработки (01-data-model.md, раздел «Seed-данные»).

Важно: это НЕ контент заказчика. Реальные фото и тексты загружаются через админку
после сдачи; контент из старой SQLite не мигрируется (решение зафиксировано в спеке).
Изображения здесь — плейсхолдер-ключи, реальных файлов в S3 под ними нет.

Структура каталога — пять групп из PDF «Этап 1» (раздел 12, «Пересборка дерева»).
Цены и веса нескольких позиций взяты из того же документа как ориентир (Медовик,
Груша, Абрикосовый пирог), остальное — условные значения для проверки фильтров.

Запуск:  python -m app.seed
Скрипт идемпотентен: повторный запуск на непустой базе ничего не делает.
На проде сидируется только учётная запись owner (флаг --admin-only).
"""

import argparse
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AdminRole,
    AdminUser,
    Category,
    CustomCake,
    DietaryTag,
    Filling,
    GalleryItem,
    Occasion,
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

# (название группы, slug, [(подкатегория, slug, applies_fillings)])
CATEGORIES: list[tuple[str, str, list[tuple[str, str, bool]]]] = [
    (
        "Торты",
        "torty",
        [
            ("Бенто", "bento", True),
            ("Детские", "detskie", True),
            ("Свадебные", "svadebnye", True),
            ("Классические", "klassicheskie", True),
            ("Муссовые", "mussovye", True),
            ("Фирменные", "firmennye", True),
        ],
    ),
    (
        "Десерты и пирожные",
        "deserty",
        [
            ("Современные", "sovremennye", False),
            ("Классика", "klassika", False),
            ("Корпусные", "korpusnye", False),
            ("Трайфлы", "trayfly", False),
            ("Чизкейки", "chizkeyki", False),
        ],
    ),
    (
        "Печенье и конфеты",
        "pechene-i-konfety",
        [
            ("Овсяное", "ovsyanoe", False),
            ("Миндальное", "mindalnoe", False),
            ("Cookies", "cookies", False),
            ("Трюфели", "tryufeli", False),
            ("Плитки", "plitki", False),
        ],
    ),
    (
        "Пироги и рулеты",
        "pirogi-i-rulety",
        [("Пироги", "pirogi", False), ("Рулеты", "rulety", False)],
    ),
    (
        "Наборы и подарки",
        "nabory-i-podarki",
        [
            ("Ассорти", "assorti", False),
            ("Наборы конфет", "nabory-konfet", False),
            ("Сертификат", "sertifikat", False),
        ],
    ),
]


@dataclass(frozen=True)
class SeedProduct:
    """Демо-товар. Датакласс вместо кортежа из десяти позиций: у каждого
    значения есть имя, и перепутать вес с ценой при правке невозможно."""

    name: str
    slug: str
    category: str
    subcategory: str
    price: str
    weight_grams: int
    composition: str
    portions: tuple[int, int] | None = None
    lead_time_days: int = 0
    occasions: list[Occasion] = field(default_factory=list)
    dietary: list[DietaryTag] = field(default_factory=list)
    tags: list[ProductTag] = field(default_factory=list)
    featured: bool = False
    # КБЖУ на 100 г
    nutrition: tuple[str, str, str, str] | None = None
    shelf_life: str = "3 суток"
    storage: str = "В холодильнике при +2…+6 °C"
    transport: str | None = "До 3 часов"


PRODUCTS: list[SeedProduct] = [
    # --- Торты ---
    SeedProduct(
        name="Бенто-торт «Ваниль и клубника»",
        slug="bento-vanil-klubnika",
        category="torty",
        subcategory="bento",
        price="1500.00",
        weight_grams=450,
        composition="Ванильный бисквит, сливочный крем, клубничное конфи",
        portions=(2, 3),
        lead_time_days=1,
        occasions=[Occasion.BIRTHDAY, Occasion.TEA],
        tags=[ProductTag.HIT],
        featured=True,
    ),
    SeedProduct(
        name="Детский торт «Молочная девочка»",
        slug="detskiy-molochnaya-devochka",
        category="torty",
        subcategory="detskie",
        price="3800.00",
        weight_grams=1500,
        composition="Коржи на сгущённом молоке, сливочный крем, ягоды",
        portions=(12, 15),
        lead_time_days=3,
        occasions=[Occasion.KIDS, Occasion.BIRTHDAY],
        dietary=[DietaryTag.LOW_SUGAR],
        featured=True,
        nutrition=("310.0", "5.2", "17.8", "32.0"),
    ),
    SeedProduct(
        name="Свадебный торт двухъярусный",
        slug="svadebnyy-dvuhyarusnyy",
        category="torty",
        subcategory="svadebnye",
        price="12000.00",
        weight_grams=4000,
        composition="Состав согласуется с Еленой: начинка на выбор из авторской линии",
        portions=(35, 45),
        lead_time_days=14,
        occasions=[Occasion.WEDDING],
    ),
    SeedProduct(
        name="Торт «Медовик»",
        slug="tort-medovik",
        category="torty",
        subcategory="klassicheskie",
        price="2600.00",
        weight_grams=1200,
        composition="Мука, мёд, сливки, сливочное масло, сахар, яйцо",
        portions=(10, 12),
        occasions=[Occasion.BIRTHDAY, Occasion.TEA],
        tags=[ProductTag.HIT],
        featured=True,
        nutrition=("380.0", "5.1", "21.0", "42.5"),
    ),
    SeedProduct(
        name="Муссовый торт «Базилик и маракуйя»",
        slug="muss-bazilik-marakuyya",
        category="torty",
        subcategory="mussovye",
        price="3400.00",
        weight_grams=1200,
        composition="Миндальный бисквит, мусс из маракуйи, базиликовое желе",
        portions=(10, 12),
        lead_time_days=2,
        occasions=[Occasion.BIRTHDAY, Occasion.CORPORATE],
        dietary=[DietaryTag.GLUTEN_FREE],
        tags=[ProductTag.NEW],
        featured=True,
    ),
    SeedProduct(
        name="Торт «Абрикос, миндаль и белый перец»",
        slug="tort-abrikos-mindal-perets",
        category="torty",
        subcategory="firmennye",
        price="3600.00",
        weight_grams=1200,
        composition="Миндальный бисквит, абрикосовое конфи, крем с ноткой белого перца",
        portions=(10, 12),
        lead_time_days=2,
        occasions=[Occasion.BIRTHDAY, Occasion.CORPORATE],
        tags=[ProductTag.HIT],
    ),
    # --- Десерты и пирожные ---
    SeedProduct(
        name="Медовик порционный",
        slug="medovik-portsionnyy",
        category="deserty",
        subcategory="klassika",
        price="480.00",
        weight_grams=100,
        composition="Мука, мёд, сливки, сливочное масло, сахар, яйцо",
        portions=(1, 1),
        occasions=[Occasion.TEA],
        shelf_life="2 суток",
    ),
    SeedProduct(
        name="Корпусный десерт «Груша»",
        slug="korpusnyy-grusha",
        category="deserty",
        subcategory="korpusnye",
        price="650.00",
        weight_grams=60,
        composition="Грушевое конфи, ванильный мусс, миндальный сабле",
        portions=(1, 1),
        occasions=[Occasion.TEA],
        tags=[ProductTag.NEW],
        featured=True,
        shelf_life="2 суток",
    ),
    SeedProduct(
        name="Корпусный десерт «Кофейное зерно»",
        slug="korpusnyy-kofeynoe-zerno",
        category="deserty",
        subcategory="korpusnye",
        price="650.00",
        weight_grams=60,
        composition="Кофейный мусс, карамель, шоколадный бисквит",
        portions=(1, 1),
        occasions=[Occasion.TEA],
        shelf_life="2 суток",
    ),
    SeedProduct(
        name="Трайфл «Шпинат и лайм»",
        slug="trayfl-shpinat-laym",
        category="deserty",
        subcategory="trayfly",
        price="420.00",
        weight_grams=150,
        composition="Шпинатный бисквит, крем с лаймом, сливки",
        portions=(1, 1),
        occasions=[Occasion.TEA],
        dietary=[DietaryTag.LOW_SUGAR],
        shelf_life="1 сутки",
    ),
    SeedProduct(
        name="Чизкейк без глютена",
        slug="chizkeyk-bez-glyutena",
        category="deserty",
        subcategory="chizkeyki",
        price="390.00",
        weight_grams=120,
        composition="Сливочный сыр, яйцо, сахар, миндальная мука",
        portions=(1, 1),
        occasions=[Occasion.TEA],
        dietary=[DietaryTag.GLUTEN_FREE],
        nutrition=("290.0", "7.0", "20.0", "19.0"),
    ),
    # --- Печенье и конфеты ---
    SeedProduct(
        name="Овсяное печенье с клюквой",
        slug="ovsyanoe-klyukva",
        category="pechene-i-konfety",
        subcategory="ovsyanoe",
        price="300.00",
        weight_grams=200,
        composition="Овсяные хлопья, мука, сливочное масло, клюква, тростниковый сахар",
        portions=(3, 4),
        occasions=[Occasion.TEA],
        shelf_life="14 суток",
        storage="В сухом месте при комнатной температуре",
        transport=None,
    ),
    SeedProduct(
        name="Миндальное печенье",
        slug="mindalnoe-pechene",
        category="pechene-i-konfety",
        subcategory="mindalnoe",
        price="350.00",
        weight_grams=180,
        composition="Миндальная мука, белок, сахар",
        portions=(3, 4),
        occasions=[Occasion.TEA],
        dietary=[DietaryTag.GLUTEN_FREE, DietaryTag.LACTOSE_FREE],
        shelf_life="14 суток",
        storage="В сухом месте при комнатной температуре",
        transport=None,
    ),
    SeedProduct(
        name="Трюфели ручной работы, 9 шт.",
        slug="tryufeli-9",
        category="pechene-i-konfety",
        subcategory="tryufeli",
        price="900.00",
        weight_grams=135,
        composition="Тёмный шоколад 70%, сливки, какао",
        occasions=[Occasion.TEA, Occasion.CORPORATE],
        shelf_life="10 суток",
    ),
    # --- Пироги и рулеты ---
    SeedProduct(
        name="Абрикосовый пирог",
        slug="abrikosovyy-pirog",
        category="pirogi-i-rulety",
        subcategory="pirogi",
        price="3400.00",
        weight_grams=1200,
        composition="Мука, абрикос, сливочное масло, сахар",
        portions=(10, 12),
        lead_time_days=1,
        occasions=[Occasion.TEA, Occasion.BIRTHDAY],
        dietary=[DietaryTag.LOW_SUGAR],
        tags=[ProductTag.HIT],
        featured=True,
        nutrition=("265.0", "4.0", "12.5", "34.0"),
    ),
    SeedProduct(
        name="Рулет маковый",
        slug="rulet-makovyy",
        category="pirogi-i-rulety",
        subcategory="rulety",
        price="900.00",
        weight_grams=500,
        composition="Дрожжевое тесто, мак, мёд, изюм",
        portions=(5, 6),
        occasions=[Occasion.TEA],
        shelf_life="3 суток",
        storage="При комнатной температуре",
    ),
    # --- Наборы и подарки ---
    SeedProduct(
        name="Ассорти пирожных, 6 шт.",
        slug="assorti-6",
        category="nabory-i-podarki",
        subcategory="assorti",
        price="2800.00",
        weight_grams=480,
        composition="Состав каждого пирожного — в описании набора",
        portions=(4, 6),
        lead_time_days=1,
        occasions=[Occasion.CORPORATE, Occasion.BIRTHDAY],
        featured=True,
    ),
    SeedProduct(
        name="Подарочный набор конфет",
        slug="nabor-konfet",
        category="nabory-i-podarki",
        subcategory="nabory-konfet",
        price="1600.00",
        weight_grams=240,
        composition="Тёмный и молочный шоколад, пралине, орехи",
        occasions=[Occasion.CORPORATE],
        tags=[ProductTag.SEASON],
        shelf_life="30 суток",
        storage="При +15…+18 °C",
        transport=None,
    ),
    SeedProduct(
        name="Подарочный сертификат на 3000 ₽",
        slug="sertifikat-3000",
        category="nabory-i-podarki",
        subcategory="sertifikat",
        price="3000.00",
        weight_grams=1,
        composition="Сертификат действует на все позиции витрины и торты на заказ",
        shelf_life="Действует 6 месяцев",
        storage="—",
        transport=None,
    ),
]

FILLINGS: list[tuple[str, str, str]] = [
    ("Абрикос, миндаль и белый перец", "Перец подчёркивает сладость фрукта", "2400.00"),
    ("Базилик и маракуйя", "Свежая кислинка маракуйи и травяная нота базилика", "2600.00"),
    ("Шпинат и лайм", "Зелёный бисквит и крем с цедрой лайма", "2500.00"),
    ("Молочная девочка", "Нежные коржи на сгущёнке — любимая начинка детских тортов", "2200.00"),
    ("Три шоколада", "Тёмный, молочный и белый шоколадный мусс", "2300.00"),
    ("Медовик", "Классические медовые коржи со сливочным кремом", "2100.00"),
]

CUSTOM_CAKES: list[tuple[str, str, str]] = [
    ("Свадебный многоярусный", "Ярусы и декор под стилистику торжества", "12000.00"),
    ("Торт на юбилей", "Авторская начинка и декор под событие", "5000.00"),
    ("Корпоративный с логотипом", "Торт для команды или партнёров", "6000.00"),
    ("Детский тематический", "Без мастики, сниженный сахар, тема праздника", "4500.00"),
]

# (подпись, повод, ярусы, гости, месяц)
GALLERY: list[tuple[str, Occasion, int | None, int | None, date]] = [
    ("Свадебный торт с живыми цветами", Occasion.WEDDING, 3, 60, date(2026, 6, 1)),
    ("Свадебный торт в стиле минимализм", Occasion.WEDDING, 2, 45, date(2026, 8, 1)),
    ("Торт на шестилетие с единорогом", Occasion.KIDS, 1, 12, date(2026, 5, 1)),
    ("Бенто-торты для выпускного", Occasion.KIDS, 1, 2, date(2026, 6, 1)),
    ("Торт на юбилей 50 лет", Occasion.BIRTHDAY, 2, 30, date(2026, 3, 1)),
    ("Торт с логотипом компании", Occasion.CORPORATE, 1, 25, date(2026, 4, 1)),
    ("Абрикосовый пирог к чаю", Occasion.TEA, None, None, date(2026, 7, 1)),
]

# (автор, текст, оценка, slug товара или None — общий отзыв)
REVIEWS: list[tuple[str, str, int, str | None]] = [
    (
        "Мария",
        "Заказывала торт на день рождения дочери — дети съели всё.",
        5,
        "detskiy-molochnaya-devochka",
    ),
    (
        "Алексей",
        "Медовик как у бабушки, только лучше. Забрал самовывозом ровно в срок.",
        5,
        "tort-medovik",
    ),
    ("Ольга", "Абрикосовый пирог берём каждые выходные к чаю.", 5, "abrikosovyy-pirog"),
    ("Ирина", "Базилик с маракуйей — необычно и очень свежо.", 5, "muss-bazilik-marakuyya"),
    ("Дмитрий", "Ассорти на корпоратив — коллеги были довольны.", 4, "assorti-6"),
    ("Анна", "Свадебный торт совпал с эскизом до мелочей. Спасибо Елене!", 5, None),
]

# Стартовая структура контента страниц. Это и есть договорённость с фронтендом
# о форме JSON в PageContent.content (см. new/spec/03-pages-wireframes.md);
# тексты — черновые, финальные пишутся на этапе текстов.
PAGE_CONTENT: dict[PageKey, dict[str, Any]] = {
    PageKey.HOME: {
        "hero": {
            "eyebrow": "Авторская кондитерская · Москва",
            "title": "Торты и десерты по авторским рецептурам",
            "subtitle": "Кофейня на Гжатской, доставка по Москве и самовывоз.",
            "primary_cta": {"label": "Смотреть витрину", "href": "/catalog"},
            "secondary_cta": {"label": "Заказать торт", "href": "/custom-cakes"},
        },
        "ticker": ["Медовик", "Корпусные десерты", "Торты под событие", "Кофе с собой"],
        "author": {
            "quote": "Начинки я придумываю сама, а торт под событие мы собираем вместе с вами.",
            "signature": "Елена Абрикосова · шеф-кондитер",
        },
        "coffee_shop": {
            "title": "Кофейня на Гжатской",
            "text": "Витрина с десертами дня и кофе с собой.",
        },
        "final_cta": {"title": "Соберите заказ или напишите Елене"},
    },
    PageKey.ABOUT: {
        "title": "О кондитерской",
        "main_text": "Черновой текст о Елене и подходе. Заменяется на этапе текстов.",
        "principles": [
            {"title": "Автор", "text": "Начинки придумывает Елена"},
            {"title": "Вкус со своим почерком", "text": "Сочетания, которых нет у других"},
            {"title": "Заказ под событие", "text": "Эскиз, начинку и вес согласуем лично"},
        ],
        "coffee_shop": {"title": "Кофейня", "text": "Приходите на Гжатскую, 5к8."},
    },
    PageKey.CUSTOM_CAKES: {
        "title": "Торты на заказ",
        "subtitle": "Торт под вашу дату, повод и число гостей",
        # Четыре этапа и точки связи — ответ на тревогу «про меня не забыли?»
        # (PDF «Этап 1», путь Ани, решение 03)
        "stages": [
            {"title": "Заявка", "text": "Повод, дата, число гостей и референсы"},
            {"title": "Согласование", "text": "Эскиз, начинка, вес и цена — лично с Еленой"},
            {"title": "Предоплата", "text": "Фиксируем дату и интервал"},
            {"title": "Получение", "text": "Доставка по Москве или самовывоз с Гжатской"},
        ],
        "consultation_text": "Оставьте заявку — Елена свяжется, чтобы обсудить детали.",
    },
    PageKey.CONTACTS: {
        "title": "Контакты",
        # Блок 05 карточки товара «Доставка и оплата» читает эти поля отсюда,
        # чтобы условия не дублировались в каждом товаре
        "delivery": "Доставка по Москве",
        "pickup": "Самовывоз с Гжатской, 5к8",
        "payment": "Оплата при получении",
        "socials": [{"label": "Telegram", "href": "https://t.me/"}],
    },
}

CONTACTS_FIELDS: dict[str, Any] = {
    "address": "Москва, ул. Гжатская, 5к8",
    "phone": "8-962-352-22-77",
    "work_hours_weekdays": "пн–пт 08:00–20:00",
    "work_hours_weekend": "сб–вс 09:00–20:00",
    "delivery_hours": "доставка 09:00–21:00",
    "yandex_rating": Decimal("5.0"),
    "yandex_reviews_count": 166,
}


async def _seed_admin(session, email: str, password_hash: str) -> None:
    exists = await session.scalar(select(func.count()).select_from(AdminUser))
    if exists:
        logger.info("Учётные записи администраторов уже есть — пропускаю")
        return

    session.add(
        AdminUser(email=email, password_hash=password_hash, role=AdminRole.OWNER, is_active=True)
    )
    logger.info("Создан администратор owner: %s", email)


def _product(seed: SeedProduct, category: Category, order: int) -> Product:
    subcategory = next(s for s in category.subcategories if s.slug == seed.subcategory)
    kcal, proteins, fats, carbs = (
        (Decimal(v) for v in seed.nutrition) if seed.nutrition else (None,) * 4
    )
    product = Product(
        name=seed.name,
        slug=seed.slug,
        category_id=category.id,
        subcategory_id=subcategory.id,
        price=Decimal(seed.price),
        is_available=True,
        is_active=True,
        description=f"Демо-описание: {seed.name}. Заменяется реальным текстом через админку.",
        composition=seed.composition,
        weight_grams=seed.weight_grams,
        portions_min=seed.portions[0] if seed.portions else None,
        portions_max=seed.portions[1] if seed.portions else None,
        kcal=kcal,
        proteins=proteins,
        fats=fats,
        carbs=carbs,
        shelf_life=seed.shelf_life,
        storage_conditions=seed.storage,
        transport_time=seed.transport,
        lead_time_days=seed.lead_time_days,
        tags=seed.tags,
        occasions=seed.occasions,
        dietary=seed.dietary,
        is_featured=seed.featured,
        order=order,
    )
    product.images = [
        ProductImage(
            storage_key=f"placeholder/products/{seed.slug}-{i}.webp", is_main=(i == 0), order=i
        )
        for i in range(2)
    ]
    return product


async def _seed_demo(session) -> None:
    exists = await session.scalar(select(func.count()).select_from(Category))
    if exists:
        logger.info("Каталог уже наполнен — пропускаю демо-данные")
        return

    categories: dict[str, Category] = {}
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
        categories[slug] = category
        session.add(category)

    await session.flush()

    products: dict[str, Product] = {}
    for order, seed in enumerate(PRODUCTS):
        product = _product(seed, categories[seed.category], order)
        products[seed.slug] = product
        session.add(product)

    await session.flush()

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

    for order, (caption, occasion, tiers, guests, made_in) in enumerate(GALLERY):
        session.add(
            GalleryItem(
                image_key=f"placeholder/gallery/{order}.webp",
                caption=caption,
                occasion=occasion,
                tiers=tiers,
                guests=guests,
                made_in=made_in,
                is_active=True,
                order=order,
            )
        )

    for author, text, rating, product_slug in REVIEWS:
        session.add(
            Review(
                product_id=products[product_slug].id if product_slug else None,
                author_name=author,
                text=text,
                rating=rating,
                is_published=True,
                source=ReviewSource.MANUAL,
            )
        )

    for page_key in PageKey:
        extra = CONTACTS_FIELDS if page_key is PageKey.CONTACTS else {}
        session.add(PageContent(page_key=page_key, content=PAGE_CONTENT[page_key], **extra))

    logger.info(
        "Созданы демо-данные: %d групп каталога, %d товаров, %d начинок, "
        "%d работ в галерее, %d отзывов",
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
