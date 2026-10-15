"""Демо-данные для локальной разработки (01-data-model.md, раздел «Seed-данные»).

Важно: это НЕ контент заказчика. Реальные фото и тексты загружаются через админку
после сдачи; контент из старой SQLite не мигрируется (решение зафиксировано в спеке).

Позиции «Готово сегодня» и работы «Сделано на заказ» повторяют макет главной
(new/design/1512.png): названия, состав, подписи, цены, метки. Их фото вырезаны
из макета и лежат в app/seed_assets/; сид загружает их в хранилище тем же путём,
что и админка (конвертация в WEBP). Если хранилище недоступно, остаются
плейсхолдер-ключи — сид не должен падать без S3. У остальных позиций фото нет.

Структура каталога — пять групп из PDF «Этап 1» (раздел 12, «Пересборка дерева»).
Товары, тексты карточек и абзацы под сеткой разделов — с макетов каталога
и страницы товара (new/design/catalog/, new/design/product/, задание 005a).

Запуск:  python -m app.seed
Скрипт идемпотентен: повторный запуск на непустой базе ничего не делает.
На проде сидируется только учётная запись owner (флаг --admin-only).
"""

import argparse
import asyncio
import copy
import logging
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AdminRole,
    AdminUser,
    Category,
    CustomCake,
    CustomCakeImage,
    DietaryTag,
    Filling,
    GalleryItem,
    ImageRole,
    Occasion,
    PageContent,
    PageKey,
    Product,
    ProductImage,
    ProductTag,
    ProductVariant,
    Recipient,
    Review,
    ReviewSource,
    SubCategory,
)
from app.models.enums import CakeDecoration, CakeImageRole, GalleryOccasion
from app.services import storage

logger = logging.getLogger(__name__)

ASSETS_DIR = Path(__file__).parent / "seed_assets"


@dataclass(frozen=True)
class SeedSub:
    name: str
    slug: str
    applies_fillings: bool = False
    intro: str | None = None


@dataclass(frozen=True)
class SeedCategory:
    name: str
    slug: str
    subcategories: list[SeedSub]
    # Подпись первой «таблетки» и абзац под сеткой — с макетов new/design/catalog/
    all_label: str | None = None
    intro: str | None = None
    # Скрытый раздел (007a, «К торту»): товары не видны в каталоге, меню и sitemap,
    # но их можно положить в корзину из блока «К торту часто берут»
    is_active: bool = True


DESSERTS_SUFFIX = "Витрина собирается каждое утро, доставка по Москве в окно по три часа."

# Порядок разделов — как в табах макета каталога: «Десерты и пирожные» перед «Тортами».
# Переносы в абзацах под сеткой — тоже с макетов (\n сохраняется на сайте)
CATEGORIES: list[SeedCategory] = [
    SeedCategory(
        "Десерты и пирожные",
        "deserty",
        [
            # Порядок — как в «таблетках» макета 04-desserts.png
            SeedSub(
                "Классика",
                "klassika",
                intro=(
                    "Классические пирожные: медовик, Прага, эстерхази, наполеон, трубочки"
                    " со сгущёнкой, муравейник и\nкартошка. " + DESSERTS_SUFFIX
                ),
            ),
            SeedSub("Современные", "sovremennye"),
            SeedSub("Корпусные", "korpusnye"),
            SeedSub("Муссовые", "mussovye"),
            SeedSub("Чизкейки", "chizkeyki"),
            SeedSub("Трайфлы", "trayfly"),
            SeedSub("Макарон", "makaron"),
            SeedSub("Капкейки", "kapkeyki"),
            SeedSub("Кейкпопсы", "keykpopsy"),
        ],
        all_label="Все десерты",
        intro=(
            "Пирожные с витрины на Гжатской: классика вроде медовика, Праги и эстерхази,"
            " современные муссовые десерты и корпусные пирожные.\n" + DESSERTS_SUFFIX
        ),
    ),
    SeedCategory(
        "Торты",
        "torty",
        [
            # Порядок — как в колонке «Торты» подвала на макете 1512.png и в
            # «таблетках» макета 03-cakes.png (там только первые четыре: детских
            # и свадебных готовых тортов на витрине нет)
            SeedSub("Бенто", "bento", True),
            SeedSub("Классические", "klassicheskie", True),
            SeedSub("Муссовые", "mussovye", True),
            SeedSub("Фирменные", "firmennye", True),
            SeedSub("Детские", "detskie", True),
            SeedSub("Свадебные", "svadebnye", True),
        ],
        all_label="Все торты",
        intro=(
            "Готовые торты фиксированного веса: классические медовик и Прага, муссовые"
            " и фирменные торты, бенто на небольшую компанию.\nТорт под свадьбу, детский"
            " праздник или юбилей собирается на заказ под число гостей."
        ),
    ),
    SeedCategory(
        "Печенье и конфеты",
        "pechene-i-konfety",
        [
            SeedSub("Овсяное", "ovsyanoe"),
            SeedSub("Миндальное", "mindalnoe"),
            SeedSub("Cookies", "cookies"),
            SeedSub("Трюфели", "tryufeli"),
            SeedSub("Плитки", "plitki"),
        ],
    ),
    SeedCategory(
        "Пироги и рулеты",
        "pirogi-i-rulety",
        [SeedSub("Пироги", "pirogi"), SeedSub("Рулеты", "rulety")],
    ),
    SeedCategory(
        "Наборы и подарки",
        "nabory-i-podarki",
        [
            SeedSub("Ассорти", "assorti"),
            SeedSub("Наборы конфет", "nabory-konfet"),
            SeedSub("Сертификат", "sertifikat"),
        ],
    ),
    # Допродажа в корзине (007a): свечи и открытка — не витрина, а «к торту»
    SeedCategory(
        "К торту",
        "k-tortu",
        [
            SeedSub("Свечи и открытки", "svechi-i-otkrytki"),
            # Дегустационный сет (008a): плашка в «Начинках» «Тортов на заказ»
            SeedSub("Дегустация", "degustaciya"),
        ],
        is_active=False,
    ),
]


@dataclass(frozen=True)
class SeedVariant:
    label: str
    price: str
    weight_grams: int | None
    portions: tuple[int, int] | None = None
    size_note: str | None = None


@dataclass(frozen=True)
class SeedProduct:
    """Демо-товар. Датакласс вместо кортежа из десяти позиций: у каждого
    значения есть имя, и перепутать вес с ценой при правке невозможно."""

    name: str
    slug: str
    category: str
    subcategory: str
    # Варианты по порядку; первый — вариант по умолчанию для карточки
    variants: list[SeedVariant]
    # Короткий состав для карточки — дословно с макетов каталога
    card_ingredients: str
    # Полный состав; пусто — тот же, что в карточке
    composition: str | None = None
    subtitle: str | None = None
    allergens: str | None = None
    packaging: str | None = None
    allows_inscription: bool = False
    lead_time_days: int = 0
    occasions: list[Occasion] = field(default_factory=list)
    recipients: list[Recipient] = field(default_factory=list)
    dietary: list[DietaryTag] = field(default_factory=list)
    tags: list[ProductTag] = field(default_factory=list)
    featured: bool = False
    # «Предлагать в корзине» (007a): блок «К торту часто берут»
    upsell: bool = False
    # КБЖУ на 100 г
    nutrition: tuple[str, str, str, str] | None = None
    shelf_life: str | None = "3 суток"
    storage: str | None = "В холодильнике при +2…+6 °C"
    transport: str | None = "До 3 часов"
    # Подпись типа позиции в карточке; пусто — название подкатегории
    card_label: str | None = None
    # Файл фото в seed_assets/products без расширения; None — плейсхолдер
    image: str | None = None
    # Подписи плейсхолдеров фото на странице товара (макет 01-medovik-whole.png)
    image_roles: tuple[ImageRole, ...] = ()
    # Файлы фото по ролям — в том же порядке, что image_roles (006b). Нет файла —
    # плейсхолдер с подписью роли
    role_images: tuple[str, ...] = ()


def one(label: str, price: str, weight: int | None, portions: tuple[int, int] | None = None):
    """Товар с единственным вариантом — пирожное, пирог, набор."""
    return [SeedVariant(label, price, weight, portions)]


# Четыре торта (Молочная девочка, Три шоколада, Бенто, Фисташка и малина) — под
# заказ за 1–2 дня (ревью 005a): на макете у них «+», но без позиций под заказ
# фильтр «Под заказ» и такое состояние карточки не на чем проверить.
#
# Все позиции макета каталога «Все» (new/design/catalog/01-catalog.png) — названия,
# состав в карточке, подписи, веса, порции, цены и метки дословно с макета.
# Порядок — как на макете, с одним исключением: «Смородина-жасмин» стоит перед
# «Прагой», потому что «Готово сегодня» на главной (тот же `order`) показывает
# их в таком порядке, а главная меняться не должна (см. отчёт 005a).
PRODUCTS: list[SeedProduct] = [
    SeedProduct(
        name="Медовик",
        slug="medovik",
        category="deserty",
        subcategory="klassika",
        variants=one("100 г", "480.00", 100),
        card_ingredients="мука, сметана, мёд, сгущёнка, сливочное масло",
        occasions=[Occasion.TEA],
        featured=True,
        shelf_life="2 суток",
        image="medovik",
    ),
    SeedProduct(
        name="Медовик целый",
        slug="medovik-celyj",
        category="torty",
        subcategory="klassicheskie",
        # Цены 2 кг на макетах нет (видна только кнопка) — условная, вдвое от 1 кг
        variants=[
            SeedVariant("1 кг", "2400.00", 1000, (8, 10), "диаметр 18 см, высота 8 см"),
            SeedVariant("2 кг", "4800.00", 2000, (16, 20), "диаметр 24 см, высота 9 см"),
        ],
        card_ingredients="мука, сметана, мёд, сгущёнка, сливочное масло",
        composition=(
            "мука пшеничная, сметана, мёд, сгущённое молоко, сливочное масло, сахар, яйцо"
        ),
        subtitle="Тонкие медовые коржи и сметанный крем",
        allergens="глютен, молоко, яйцо",
        packaging="Коробка с окном и лентой",
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY, Occasion.TEA],
        recipients=[Recipient.HER, Recipient.HIM],
        tags=[ProductTag.HIT],
        nutrition=("390.0", "5.4", "18.0", "52.0"),
        shelf_life="72 часа при температуре от +2 до +6 °C",
        image_roles=(ImageRole.WHOLE, ImageRole.CUT, ImageRole.DETAIL, ImageRole.PACKAGE),
        # Четыре фото — из макета 09.10 (product-frames/f0-1.png, 006b). Целиком —
        # кадр 576×720; срез, деталь и упаковка в макете есть только превью 96×120
        role_images=(
            "medovik-celyj",
            "medovik-celyj-srez",
            "medovik-celyj-detal",
            "medovik-celyj-upakovka",
        ),
    ),
    SeedProduct(
        name="Смородина-жасмин",
        slug="smorodina-zhasmin",
        category="deserty",
        subcategory="sovremennye",
        variants=one("100 г", "550.00", 100),
        card_ingredients="сливки, смородина, жасмин, белый шоколад",
        occasions=[Occasion.TEA],
        recipients=[Recipient.HER],
        dietary=[DietaryTag.GLUTEN_FREE],
        featured=True,
        shelf_life="2 суток",
        # Подпись с макета главной; макет каталога пишет «современные» — см. отчёт 005a
        card_label="современные десерты",
        image="smorodina-zhasmin",
    ),
    SeedProduct(
        name="Прага",
        slug="praga",
        category="deserty",
        subcategory="klassika",
        variants=one("120 г", "680.00", 120),
        card_ingredients="мука, какао, сгущёнка, сливочное масло, яйцо",
        occasions=[Occasion.TEA],
        featured=True,
        image="praga",
    ),
    SeedProduct(
        name="Прага целая",
        slug="praga-celaya",
        category="torty",
        subcategory="klassicheskie",
        variants=one("1,2 кг", "3200.00", 1200, (10, 12)),
        card_ingredients="мука, какао, сгущёнка, сливочное масло, яйцо",
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY],
        recipients=[Recipient.HIM],
    ),
    SeedProduct(
        name="Абрикосовый пирог",
        slug="abrikosovyy-pirog",
        category="pirogi-i-rulety",
        subcategory="pirogi",
        variants=one("1,2 кг", "3400.00", 1200, (10, 12)),
        card_ingredients="мука, абрикос, сливочное масло, сахар, яйцо",
        occasions=[Occasion.TEA, Occasion.BIRTHDAY],
        dietary=[DietaryTag.LOW_SUGAR, DietaryTag.LACTOSE_FREE],
        tags=[ProductTag.HIT],
        featured=True,
        nutrition=("265.0", "4.0", "12.5", "34.0"),
        # Подпись с макета главной; макет каталога пишет «пироги» — см. отчёт 005a
        card_label="фирменная позиция",
        image="abrikosovyy-pirog",
    ),
    SeedProduct(
        name="Картошка шоколадная с солёной карамелью",
        slug="kartoshka-shokoladnaya",
        category="deserty",
        subcategory="klassika",
        variants=one("90 г", "350.00", 90),
        card_ingredients="бисквитная крошка, какао, солёная карамель",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Эстерхази",
        slug="esterhazi",
        category="deserty",
        subcategory="klassika",
        variants=one("100 г", "480.00", 100),
        card_ingredients="миндальная мука, орехи, сливочный крем",
        occasions=[Occasion.TEA],
        dietary=[DietaryTag.GLUTEN_FREE],
        # Четыре заглушки с подписями ролей — как в макете товара 09.10 (f3-1)
        image_roles=(ImageRole.WHOLE, ImageRole.CUT, ImageRole.DETAIL, ImageRole.PACKAGE),
    ),
    SeedProduct(
        name="Картошка миндальная с ягодной начинкой",
        slug="kartoshka-mindalnaya",
        category="deserty",
        subcategory="klassika",
        variants=one("90 г", "350.00", 90),
        card_ingredients="миндаль, бисквит, ягодный конфитюр",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Груша",
        slug="grusha",
        category="deserty",
        subcategory="korpusnye",
        variants=one("110 г", "650.00", 110),
        card_ingredients="груша, карамель, ванильный мусс",
        occasions=[Occasion.TEA],
        recipients=[Recipient.HER],
        tags=[ProductTag.NEW],
        shelf_life="2 суток",
    ),
    SeedProduct(
        name="Трубочки со сгущёнкой",
        slug="trubochki-so-sguschenkoy",
        category="deserty",
        subcategory="klassika",
        variants=one("100 г", "350.00", 100),
        card_ingredients="слоёное тесто, сгущёнка",
        occasions=[Occasion.TEA],
        recipients=[Recipient.KIDS],
    ),
    SeedProduct(
        name="Кофейное зерно",
        slug="kofeynoe-zerno",
        category="deserty",
        subcategory="korpusnye",
        variants=one("110 г", "650.00", 110),
        card_ingredients="кофейный мусс, шоколад, какао",
        occasions=[Occasion.TEA],
        recipients=[Recipient.HIM],
        shelf_life="2 суток",
    ),
    SeedProduct(
        name="Ассорти печенья",
        slug="assorti-pechenya",
        category="nabory-i-podarki",
        subcategory="assorti",
        variants=one("400 г", "1800.00", 400),
        card_ingredients="овсяное, миндальное и шоколадное печенье",
        occasions=[Occasion.TEA, Occasion.CORPORATE],
        shelf_life="14 суток",
        storage="В сухом месте при комнатной температуре",
        transport=None,
    ),
    SeedProduct(
        name="Кокос",
        slug="kokos",
        category="deserty",
        subcategory="sovremennye",
        variants=one("100 г", "550.00", 100),
        card_ingredients="кокос, сливки, белый шоколад",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Пирожное Шу",
        slug="pirozhnoe-shu",
        category="deserty",
        subcategory="sovremennye",
        variants=one("70 г", "320.00", 70),
        card_ingredients="заварное тесто, ванильный крем",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Муравейник",
        slug="muraveynik",
        category="deserty",
        subcategory="klassika",
        variants=one("120 г", "380.00", 120),
        card_ingredients="песочное тесто, варёная сгущёнка, мак",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Пирожное Банан mini",
        slug="pirozhnoe-banan-mini",
        category="deserty",
        subcategory="sovremennye",
        variants=one("50 г", "300.00", 50),
        card_ingredients="банановый мусс, карамель",
        occasions=[Occasion.TEA],
        recipients=[Recipient.KIDS],
        # В корзине с тортом — четвёртая карточка «К торту часто берут» (макет 007a)
        upsell=True,
        image="pirozhnoe-banan-mini",
    ),
    SeedProduct(
        name="Молочная девочка",
        slug="molochnaya-devochka",
        lead_time_days=2,
        category="torty",
        subcategory="firmennye",
        variants=one("1,5 кг", "3600.00", 1500, (12, 14)),
        card_ingredients="тонкие коржи на сгущёнке, сливочный крем",
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY],
        recipients=[Recipient.HER, Recipient.KIDS],
        dietary=[DietaryTag.LOW_SUGAR],
        nutrition=("310.0", "5.2", "17.8", "32.0"),
    ),
    SeedProduct(
        name="Три шоколада",
        slug="tri-shokolada",
        lead_time_days=2,
        category="torty",
        subcategory="mussovye",
        variants=one("1,4 кг", "3900.00", 1400, (10, 12)),
        card_ingredients="шоколадный бисквит, три шоколадных мусса",
        # Подзаголовок и заглушки ролей — макет товара 09.10 (f1-1)
        subtitle="Шоколадный бисквит и три мусса: тёмный, молочный и белый",
        image_roles=(ImageRole.WHOLE, ImageRole.CUT, ImageRole.DETAIL, ImageRole.PACKAGE),
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY, Occasion.CORPORATE],
        recipients=[Recipient.HIM],
    ),
    SeedProduct(
        name="Бенто с надписью",
        slug="bento-s-nadpisyu",
        lead_time_days=1,
        category="torty",
        subcategory="bento",
        variants=one("450 г", "1900.00", 450, (2, 3)),
        card_ingredients="ванильный бисквит, сливочный крем, ягоды",
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY],
        recipients=[Recipient.HER],
    ),
    SeedProduct(
        name="Фисташка и малина",
        slug="fistashka-i-malina",
        lead_time_days=1,
        category="torty",
        subcategory="mussovye",
        variants=one("1,2 кг", "3700.00", 1200, (8, 10)),
        card_ingredients="фисташковый бисквит, малиновое конфи, мусс",
        allows_inscription=True,
        occasions=[Occasion.BIRTHDAY, Occasion.WEDDING],
        dietary=[DietaryTag.LACTOSE_FREE],
        tags=[ProductTag.NEW],
    ),
    SeedProduct(
        name="Рулет с ягодами",
        slug="rulet-s-yagodami",
        category="pirogi-i-rulety",
        subcategory="rulety",
        variants=one("600 г", "1600.00", 600, (6, 8)),
        card_ingredients="бисквит, сливочный крем, сезонные ягоды",
        occasions=[Occasion.TEA],
    ),
    SeedProduct(
        name="Конфеты ручной работы",
        slug="konfety-ruchnoy-raboty",
        category="nabory-i-podarki",
        subcategory="nabory-konfet",
        variants=one("240 г", "2400.00", 240),
        card_ingredients="трюфели, пралине, шоколад 70%",
        occasions=[Occasion.CORPORATE],
        tags=[ProductTag.SEASON],
        shelf_life="30 суток",
        storage="При +15…+18 °C",
        transport=None,
    ),
    # На макете главной пятая карточка обрезана краем окна, фото — заглушка;
    # здесь тоже без фото. Состав в карточке — каталожный (решение по ревью 005a)
    SeedProduct(
        name="Наполеон",
        slug="napoleon",
        category="deserty",
        subcategory="klassika",
        variants=one("120 г", "580.00", 120),
        card_ingredients="слоёное тесто, заварной крем",
        composition="мука, сливочное масло, молоко, сахар, яйцо",
        occasions=[Occasion.TEA],
        featured=True,
        shelf_life="2 суток",
        # Заглушки ролей — макет «Закончилось сегодня» 09.10 (f2-1)
        image_roles=(ImageRole.WHOLE, ImageRole.CUT, ImageRole.DETAIL, ImageRole.PACKAGE),
    ),
    # Подразделы, которые показывает мега-меню «Каталог» (макет 09.10, задание 014):
    # подраздел без товаров меню прячет, поэтому в каждом — хотя бы один товар.
    # Стоят в конце и «под заказ за день»: не сдвигают первые страницы каталога
    # и витрину «Готово сегодня», сверенные с макетами 004–006
    SeedProduct(
        name="Манго-маракуйя",
        slug="mango-marakuyya",
        category="deserty",
        subcategory="mussovye",
        variants=one("100 г", "560.00", 100),
        card_ingredients="мусс манго, маракуйя, миндальный бисквит",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Чизкейк Нью-Йорк",
        slug="chizkeyk-nyu-york",
        category="deserty",
        subcategory="chizkeyki",
        variants=one("120 г", "520.00", 120),
        card_ingredients="сливочный сыр, сливки, песочная основа",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Трайфл вишня-шоколад",
        slug="trayfl-vishnya-shokolad",
        category="deserty",
        subcategory="trayfly",
        variants=one("150 г", "450.00", 150),
        card_ingredients="шоколадный бисквит, вишня, сливочный крем",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Макарон, 6 штук",
        slug="makaron-6-shtuk",
        category="deserty",
        subcategory="makaron",
        variants=one("90 г", "720.00", 90),
        card_ingredients="миндальная мука, белок, ганаш",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Ванильный капкейк",
        slug="vanilnyy-kapkeyk",
        category="deserty",
        subcategory="kapkeyki",
        variants=one("90 г", "320.00", 90),
        card_ingredients="ванильный бисквит, сливочный крем",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Кейкпопс шоколадный",
        slug="keykpops-shokoladnyy",
        category="deserty",
        subcategory="keykpopsy",
        variants=one("40 г", "180.00", 40),
        card_ingredients="шоколадный бисквит, ганаш, глазурь",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Овсяное печенье",
        slug="ovsyanoe-pechene",
        category="pechene-i-konfety",
        subcategory="ovsyanoe",
        variants=one("200 г", "420.00", 200),
        card_ingredients="овсяные хлопья, изюм, сливочное масло",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Миндальное печенье",
        slug="mindalnoe-pechene",
        category="pechene-i-konfety",
        subcategory="mindalnoe",
        variants=one("200 г", "560.00", 200),
        card_ingredients="миндальная мука, сахар, белок",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Cookies с шоколадом",
        slug="cookies-s-shokoladom",
        category="pechene-i-konfety",
        subcategory="cookies",
        variants=one("200 г", "480.00", 200),
        card_ingredients="мука, шоколад 55%, сливочное масло",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Трюфели",
        slug="tryufeli",
        category="pechene-i-konfety",
        subcategory="tryufeli",
        variants=one("120 г", "690.00", 120),
        card_ingredients="шоколад 70%, сливки, какао",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Шоколадная плитка",
        slug="shokoladnaya-plitka",
        category="pechene-i-konfety",
        subcategory="plitki",
        variants=one("100 г", "450.00", 100),
        card_ingredients="шоколад 70%, орехи, сушёные ягоды",
        lead_time_days=1,
    ),
    SeedProduct(
        name="Подарочный сертификат",
        slug="podarochnyy-sertifikat",
        category="nabory-i-podarki",
        subcategory="sertifikat",
        variants=one("3 000 ₽", "3000.00", None),
        card_ingredients="на любой торт или набор с витрины",
        lead_time_days=1,
        shelf_life="1 год",
        storage="Хранения не требует",
        transport=None,
    ),
    # Скрытый раздел «К торту» (007a): карточки «К торту часто берут» из макета корзины,
    # подписи и цены — с кадра, фото вырезаны из него же (cart-checkout.png)
    SeedProduct(
        name="Набор свечей, 12 шт.",
        slug="nabor-svechey",
        category="k-tortu",
        subcategory="svechi-i-otkrytki",
        variants=one("12 шт.", "200.00", None),
        card_ingredients="тонкие белые свечи",
        composition="парафин, хлопковый фитиль",
        shelf_life=None,
        storage="В сухом месте",
        transport=None,
        upsell=True,
        image="nabor-svechey",
    ),
    SeedProduct(
        name="Свеча-цифра",
        slug="svecha-cifra",
        category="k-tortu",
        subcategory="svechi-i-otkrytki",
        variants=one("1 шт.", "250.00", None),
        card_ingredients="цифру уточним при подтверждении",
        composition="парафин, хлопковый фитиль",
        shelf_life=None,
        storage="В сухом месте",
        transport=None,
        upsell=True,
        image="svecha-cifra",
    ),
    SeedProduct(
        name="Открытка",
        slug="otkrytka",
        category="k-tortu",
        subcategory="svechi-i-otkrytki",
        variants=one("1 шт.", "150.00", None),
        card_ingredients="текст уточним при подтверждении",
        composition="дизайнерская бумага, лента",
        shelf_life=None,
        storage=None,
        transport=None,
        upsell=True,
        image="otkrytka",
    ),
    # «Дегустационный сет» (008a): обычный товар в скрытом разделе — плашка в «Начинках»
    # берёт из него цену и ссылку, «Заказать сет» кладёт его в корзину
    SeedProduct(
        name="Дегустационный сет",
        slug="degustacionnyy-set",
        category="k-tortu",
        subcategory="degustaciya",
        variants=one("6 кусочков", "1200.00", None),
        card_ingredients=(
            "Шесть начинок по кусочку, чтобы выбрать до заказа. Особенно выручает перед свадьбой."
        ),
        composition="шесть начинок из списка по кусочку",
        lead_time_days=1,
    ),
]


@dataclass(frozen=True)
class SeedFilling:
    name: str
    # Полное описание — его же показывает блок «Вкус изнутри» на главной
    description: str
    # Строка под названием в карточке «Тортов на заказ» (008a)
    short: str
    price: str
    # Файл в seed_assets/fillings без расширения; None — плейсхолдер
    image: str | None = None
    dietary: tuple[DietaryTag, ...] = ()


# Порядок и подписи — как в блоке «Начинки» макета custom-cakes.png (008a); первые
# пять — они же во «Вкусе изнутри» на главной. Фото вырезаны из кадра; у «Молочной
# девочки» и «Трёх шоколадов» в макете плашки. Последние три — для «Показать все»
FILLINGS: list[SeedFilling] = [
    SeedFilling(
        "Абрикос, миндаль, белый перец",
        "Острота подчёркивает сладость фрукта",
        "Острота подчёркивает сладость фрукта",
        "2400.00",
        "abrikos-mindal-perets",
    ),
    SeedFilling(
        "Освежающий базилик",
        "Травяная нота базилика и кислинка маракуйи",
        "Базиликовый бисквит и маракуйя",
        "2600.00",
        "osvezhayushchiy-bazilik",
    ),
    SeedFilling(
        "Шпинат и хрустящий лайм",
        "Зелёный бисквит и крем с цедрой лайма",
        "Лаймовый кранч и сырный крем",
        "2500.00",
        "shpinat-i-layim",
    ),
    SeedFilling(
        "Фисташка и малина",
        "Фисташковый крем и малиновое конфи",
        "Ореховая основа и ягодная кислинка",
        "2600.00",
        "fistashka-i-malina",
    ),
    SeedFilling(
        "Сникерс",
        "Карамель, солёный арахис и шоколадный мусс",
        "Солёный арахис и карамель",
        "2300.00",
        "snikers",
    ),
    SeedFilling(
        "Молочная девочка",
        "Тонкие коржи на сгущёнке и лёгкий сливочный крем",
        "Тонкие коржи на сгущёнке",
        "2200.00",
        dietary=(DietaryTag.LOW_SUGAR,),
    ),
    SeedFilling(
        "Три шоколада",
        "Тёмный, молочный и белый шоколадный мусс на шоколадном бисквите",
        "Тёмный, молочный и белый мусс",
        "2500.00",
    ),
    SeedFilling(
        "Медовик",
        "Классические медовые коржи со сливочным кремом",
        "Медовые коржи и сливочный крем",
        "2100.00",
    ),
    SeedFilling(
        "Красный бархат",
        "Бархатный бисквит с какао и крем-чиз",
        "Бисквит с какао и крем-чиз",
        "2400.00",
    ),
    SeedFilling(
        "Морковный с грецким орехом",
        "Пряный морковный бисквит, грецкий орех и сырный крем",
        "Пряный бисквит и грецкий орех",
        "2300.00",
    ),
]


@dataclass(frozen=True)
class SeedDesign:
    title: str
    slug: str
    occasion: GalleryOccasion
    tiers: int
    min_guests: int
    decoration: CakeDecoration
    subtitle: str | None = None
    # Фото в seed_assets/custom-cakes с ролями; пусто — плейсхолдер «Целиком»
    images: tuple[tuple[str, CakeImageRole], ...] = ()


# Дизайны из кадра списка custom-cakes.png (008a) — в том же порядке, с теми же
# поводами, ярусами и гостями. Оформление подобрано так, чтобы «от … ₽» в кадре
# сходилось с расчётом: 40 гостей × 150 г = 6 кг × 4 500 ₽ = 27 000 ₽. Фото — у трёх
# первых и срез «Белого с пионами» из кадра дизайна (там он миниатюрой 96×120)
CUSTOM_CAKES: list[SeedDesign] = [
    SeedDesign(
        "Белый с пионами",
        "belyy-s-pionami",
        GalleryOccasion.WEDDING,
        3,
        40,
        CakeDecoration.MULTI_TIER,
        "Белый крем и пионы, нарисованные кремом по бокам ярусов",
        (
            ("belyy-s-pionami", CakeImageRole.WHOLE),
            ("belyy-s-pionami-srez", CakeImageRole.CUT),
        ),
    ),
    SeedDesign(
        "Шоколад и вишня",
        "shokolad-i-vishnya",
        GalleryOccasion.BIRTHDAY,
        2,
        20,
        CakeDecoration.MULTI_TIER,
        "Шоколадный крем волнами и свежая вишня сверху",
        (("shokolad-i-vishnya", CakeImageRole.WHOLE),),
    ),
    SeedDesign(
        "Лисёнок",
        "lisenok",
        GalleryOccasion.KIDS,
        1,
        13,
        CakeDecoration.CREAM_DRAWING,
        "Мордочка лисёнка из оранжевого крема и травка по низу",
        (("lisenok", CakeImageRole.WHOLE),),
    ),
    SeedDesign(
        "Открытый с ягодами",
        "otkrytyy-s-yagodami",
        GalleryOccasion.WEDDING,
        2,
        27,
        CakeDecoration.MULTI_TIER,
        "Коржи без крема по бокам и сезонные ягоды",
    ),
    SeedDesign(
        "Мятный с ромашками",
        "myatnyy-s-romashkami",
        GalleryOccasion.BIRTHDAY,
        1,
        13,
        CakeDecoration.CREAM_DRAWING,
        "Мятный крем и ромашки, нарисованные кремом",
    ),
    SeedDesign(
        "Единорог",
        "edinorog",
        GalleryOccasion.KIDS,
        1,
        13,
        CakeDecoration.CREAM_DRAWING,
        "Пастельная грива из крема и золотой рог",
    ),
    SeedDesign(
        "Кремовый с поталью",
        "kremovyy-s-potalyu",
        GalleryOccasion.WEDDING,
        4,
        60,
        CakeDecoration.MULTI_TIER,
        "Четыре яруса в сливочном креме и золотая поталь",
    ),
    SeedDesign(
        "Строгий белый",
        "strogiy-belyy",
        GalleryOccasion.ANNIVERSARY_CORPORATE,
        1,
        20,
        CakeDecoration.CLASSIC,
        "Гладкий белый крем без декора — под логотип или надпись",
    ),
    SeedDesign(
        "Космос",
        "kosmos",
        GalleryOccasion.KIDS,
        2,
        20,
        CakeDecoration.MULTI_TIER,
        "Тёмно-синий крем, планеты и звёзды",
    ),
    SeedDesign(
        "Медовый с цифрой",
        "medovyy-s-cifroy",
        GalleryOccasion.ANNIVERSARY_CORPORATE,
        2,
        27,
        CakeDecoration.MULTI_TIER,
        "Медовые коржи и цифра юбилея сверху",
    ),
    SeedDesign(
        "Чёрная сфера",
        "chernaya-sfera",
        GalleryOccasion.BIRTHDAY,
        1,
        13,
        CakeDecoration.CLASSIC,
        "Чёрная глазурь и шоколадная сфера",
    ),
]


@dataclass(frozen=True)
class SeedWork:
    caption: str
    occasion: Occasion | None
    tiers: int | None
    weight_grams: int | None
    guests: int | None
    made_in: date
    # Файл фото в seed_assets/gallery без расширения; None — плейсхолдер
    image: str | None = None
    # Второй кадр (срез) — показывается при наведении на карточку
    detail_image: str | None = None


GALLERY: list[SeedWork] = [
    # «Работы» по макету works.png (009) — в том же порядке и с теми же подписями;
    # первые три с фото, они же — «Сделано на заказ» на главной (1512.png). Четвёртая
    # на макете главной обрезана краем окна («СВА…», «О…», «2 яр…») — это она же
    SeedWork("Белый с пионами", Occasion.WEDDING, 3, 6000, 45, date(2025, 8, 1), "belyy-s-pionami"),
    # Срез вырезан из состояния наведения на works.png (tasks/009-screens/cut_srez.py)
    SeedWork(
        "Шоколад и вишня",
        Occasion.BIRTHDAY,
        2,
        3000,
        20,
        date(2026, 3, 1),
        "shokolad-i-vishnya",
        "shokolad-i-vishnya-srez",
    ),
    SeedWork("Лисёнок", Occasion.BIRTHDAY, 1, 1800, 12, date(2026, 6, 1), "lisenok"),
    SeedWork("Открытый с ягодами", Occasion.WEDDING, 2, 4000, 30, date(2025, 6, 1)),
    SeedWork("Мятный с ромашками", Occasion.BIRTHDAY, 1, 2000, 14, date(2026, 5, 1)),
    SeedWork("Единорог", Occasion.BIRTHDAY, 1, 1500, 10, date(2026, 4, 1)),
    SeedWork("Кремовый с поталью", Occasion.WEDDING, 4, 9000, 70, date(2025, 9, 1)),
    SeedWork("Чёрная сфера", Occasion.BIRTHDAY, 1, 2000, 12, date(2026, 2, 1)),
    SeedWork("Космос", Occasion.BIRTHDAY, 2, 3000, 20, date(2025, 10, 1)),
    SeedWork("Медовый с цифрой", Occasion.ANNIVERSARY, 2, 4000, 30, date(2026, 4, 1)),
    SeedWork("Строгий белый", Occasion.CORPORATE, 1, 3000, 20, date(2025, 12, 1)),
    SeedWork("Нюдовый с сухоцветами", Occasion.WEDDING, 2, 5000, 35, date(2026, 5, 1)),
    # Вторая страница — для «Показать ещё»; среди них детские, чтобы фильтр «Детский»
    # не был пустым
    SeedWork("Бенто-торты для выпускного", Occasion.KIDS, 1, 450, 2, date(2026, 6, 1)),
    SeedWork("Торт на шестилетие с единорогом", Occasion.KIDS, 1, 1500, 12, date(2026, 5, 1)),
    SeedWork("Свадебный с живыми цветами", Occasion.WEDDING, 3, 7000, 60, date(2026, 6, 1)),
    SeedWork("Торт с логотипом компании", Occasion.CORPORATE, 1, 2500, 25, date(2026, 4, 1)),
]

# (автор, текст, оценка, slug товара или None — общий отзыв)
REVIEWS: list[tuple[str, str, int, str | None]] = [
    (
        "Мария",
        "Заказывала торт на день рождения дочери — дети съели всё.",
        5,
        "molochnaya-devochka",
    ),
    (
        "Алексей",
        "Медовик как у бабушки, только лучше. Забрал самовывозом ровно в срок.",
        5,
        "medovik-celyj",
    ),
    ("Ольга", "Абрикосовый пирог берём каждые выходные к чаю.", 5, "abrikosovyy-pirog"),
    ("Ирина", "Фисташка с малиной — необычно и очень свежо.", 5, "fistashka-i-malina"),
    ("Дмитрий", "Ассорти печенья на корпоратив — коллеги были довольны.", 4, "assorti-pechenya"),
    ("Анна", "Свадебный торт совпал с эскизом до мелочей. Спасибо Елене!", 5, None),
]

# Карточка кондитерской на Яндекс.Картах (прислал заказчик 30.09.2026; параметры
# ll/z из его ссылки — положение карты в браузере, они не нужны).
# Карточка — «Построить маршрут», её вкладка отзывов — «Читать все отзывы»
# и «Читать на Яндекс.Картах» под каждым отзывом.
YANDEX_ORG_URL = "https://yandex.ru/maps/org/konditerskaya_ye_abrikosovoy/160020775716/"
YANDEX_REVIEWS_URL = YANDEX_ORG_URL + "reviews/"

# «Что говорят гости» на главной — дословно с макета, включая заглушку текста.
# (автор, текст, оценка, месяц отзыва)
YANDEX_REVIEWS: list[tuple[str, str, int, date]] = [
    (
        "Мария К.",
        "Заглушка. Здесь встанет настоящий отзыв о заказе с Яндекс.Карт, одна-две строки.",
        5,
        date(2026, 6, 14),
    ),
    (
        "Артём Б.",
        "Заглушка. Здесь встанет настоящий отзыв о заказе с Яндекс.Карт, одна-две строки.",
        5,
        date(2026, 5, 20),
    ),
    (
        "Ольга Д.",
        "Заглушка. Здесь встанет настоящий отзыв о заказе с Яндекс.Карт, одна-две строки.",
        5,
        date(2026, 4, 8),
    ),
]

# Стартовая структура контента страниц. Это и есть договорённость с фронтендом
# о форме JSON в PageContent.content (см. new/spec/03-pages-wireframes.md);
# тексты — черновые, финальные пишутся на этапе текстов.
PAGE_CONTENT: dict[PageKey, dict[str, Any]] = {
    # Тексты главной — по макету 1512.png. Строки заголовка и подзаголовка героя
    # хранятся списком: переносы на макете смысловые, их нельзя отдавать браузеру.
    PageKey.HOME: {
        "hero": {
            "title_lines": ["Торты и десерты", "по авторским рецептурам", "Елены Абрикосовой"],
            "subtitle_lines": [
                "Готовим для вас как для себя и своей семьи.",
                "Елена придумывает вкус, вы выбираете повод.",
            ],
            "cta": {"label": "Открыть витрину", "href": "/catalog"},
        },
        "ticker": [
            "Медовик",
            "Корпусные десерты",
            "Торты под событие",
            "Без глютена",
            "Наборы и подарки",
            "Кофе с собой",
        ],
        "ready_today": {
            "title": "Готово сегодня",
            "subtitle": (
                "Витрина обновляется каждое утро. Забрать на Гжатской или привезём по Москве"
            ),
            "cta": {"label": "Вся витрина", "href": "/catalog?availability=today"},
        },
        "made_to_order": {
            "title": "Сделано на заказ",
            "subtitle": (
                "Каждый торт Елена собирает под дату и повод. "
                "Под фото указано, на сколько гостей он был рассчитан."
            ),
            "cta": {"label": "Посмотреть все работы", "href": "/gallery"},
        },
        # Низ главной (задание 004b). Заглушки «Заглушка. Здесь встанет…» —
        # дословно с макета: так видно, какой текст ещё ждёт заказчика.
        "fillings_intro": [
            "Торт запоминают дважды: когда выносят и когда пробуют.",
            "Больше двадцати сочетаний: привычные, на которых сходятся все, "
            "и такие, о которых спрашивают за столом",
        ],
        "order_banner": {
            "title": "Опишите повод и дату",
            "text": (
                "Минимальный вес 2 кг, срок от пяти дней, аванс 50%.\n"
                "Посчитаем вес под число гостей и скажем, успеваем ли к дате"
            ),
        },
        # image_key портрета подставляется при сиде, когда фото загружено
        "author": {
            "name": "Елена Абрикосова",
            "role": "Кондитер, автор рецептур",
            "quote": (
                "Я готовлю так, как готовила бы для своей семьи. "
                "Поэтому в составе только то, что нужно вкусу"
            ),
            "paragraphs": [
                "Заглушка. Здесь встанет текст о том, как Елена пришла в профессию, "
                "сколько лет работает, где училась и у кого. Три или четыре строки.",
                "Заглушка. Здесь встанет текст о том, что Елена делает сама, а что доверяет "
                "команде. Три или четыре строки.",
            ],
            "stats": [
                {"value": "12 лет", "label": "в профессии"},
                {"value": "17 начинок", "label": "авторских"},
                {"value": "Всё вручную", "label": "от коржа до декора"},
            ],
        },
        # Ответы, кроме первого, на макете свёрнуты — заглушка того же вида
        "faq": [
            {
                "question": question,
                "answer": answer or "Заглушка. Здесь встанет ответ Елены. Две или три строки.",
            }
            for question, answer in [
                (
                    "За сколько дней заказывать торт",
                    "Заглушка. Минимальный срок и отдельный срок для многоярусных тортов. "
                    "Две или три строки.",
                ),
                ("Какой минимальный вес торта", None),
                ("Возите ли торты по Москве", None),
                ("Делаете ли торты без глютена", None),
                ("Как хранить торт до праздника", None),
                ("Как оплатить заказ", None),
                ("Можно ли изменить заказ после согласования", None),
                ("Что если торт не понравится", None),
            ]
        ],
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
        # Страница «О нас» по макету new/design/pages/about.png (010b). Тексты —
        # с макета, как у вопросов главной: «Заглушка» заменит редактор в админке.
        # Команда — пока одна Елена: остальных участников заказчик не прислал,
        # а пустые карточки на сайт не выводятся. Портрет подставляется при сиде.
        "biography": [
            "Заглушка. Как Елена пришла в профессию и почему кондитерская носит её имя. "
            "Три-четыре строки.",
            "Заглушка. Что для неё важно в работе: продукты, вкус, ручная сборка. "
            "Только факты, которые можно проверить.",
        ],
        "timeline": [
            {"year": "2014", "title": "Первые торты", "text": "Заглушка: с чего началось"},
            {"year": "2018", "title": "Обучение", "text": "Заглушка: где и у кого училась"},
            {
                "year": "2021",
                "title": "Кондитерская на Гжатской",
                "text": "Заглушка: открытие витрины и кофейни",
            },
            {"year": "2026", "title": "Больше двадцати начинок", "text": "Заглушка: что сейчас"},
        ],
        "workflow": [
            {
                "title": "Витрина каждое утро",
                "text": "Пирожные собираем с утра, отмеченное «Можно забрать сегодня» уже готово",
            },
            {
                "title": "Торт под дату",
                "text": "Заказной торт собирается к вашему дню, а не стоит в холодильнике",
            },
            {
                "title": "Заглушка: продукты",
                "text": "Заглушка: на чём готовит Елена, только проверяемые факты",
            },
        ],
        # Фото кухни ещё нет — ключ-заглушка: на сайте бежевая плашка, как у товаров
        "workshop_image_key": "placeholder/pages/workshop.webp",
        "team": [{"name": "Елена Абрикосова", "role": "Кондитер, автор рецептур"}],
    },
    PageKey.CUSTOM_CAKES: {
        "title": "Торты на заказ",
        "subtitle": (
            # Перевод строки — по кадру: каждое предложение с новой строки
            "Выберите дизайн из каталога или пришлите свой.\nВ день обращения назовём вес, "
            "срок и стоимость, затем согласуем эскиз и начинку."
        ),
        # Четыре этапа и точки связи — ответ на тревогу «про меня не забыли?»
        # (PDF «Этап 1», путь Ани, решение 03). Тексты и сроки — с блока
        # «Торт под событие» на макете главной, который читает их отсюда.
        "stages": [
            {
                "title": "Заявка",
                "duration": "5 минут",
                "text": "Повод, дата, число гостей и пожелания по виду торта",
            },
            {
                "title": "Расчёт",
                "duration": "в тот же день",
                "text": "Елена называет вес, срок и цену под ваш повод",
            },
            {
                "title": "Эскиз",
                "duration": "1–2 дня",
                "text": "Согласуем вид и начинку, затем вносится аванс",
            },
            {
                "title": "Изготовление",
                "duration": "от 3 дней",
                "text": "Торт собирается к дате. Заберёте сами или привезём",
            },
        ],
        # Бордовая ячейка «Торт по вашей идее» в сетке дизайнов (008b)
        "consultation_text": (
            "Пришлите фото-образец или опишите повод. Соберём эскиз, вес и начинку под ваш праздник"
        ),
        # Калькулятор: «Считаем около 150 г на гостя.» сайт добавляет сам из настроек
        "calculator_text": "Точный вес и число ярусов Елена подберёт под дизайн и начинку.",
        "calculator_note": "Ориентир по ценам за килограмм ниже. Итог зависит от оформления.",
        # Страница «Торты на заказ» (008a): тексты с макета custom-cakes.png. Цифры
        # (2 кг, 5 дней, цены за кг) — из настроек, здесь только слова
        "prices_intro": (
            "Цена считается за килограмм и зависит от оформления. "
            "Точную сумму назовём после заявки."
        ),
        "prices_note": (
            "На итог влияют вес, число ярусов, сложность рисунка, живые цветы "
            "и сезонные ягоды, топперы и фигурки."
        ),
        "fillings_intro": (
            "Больше двадцати сочетаний. Начинку выбирают в заявке или вместе с Еленой "
            "при расчёте, в многоярусном торте у каждого яруса может быть своя."
        ),
        "lead_days_note": "ярусные от 10",
        "order_facts": [
            {"label": "Аванс", "value": "50% после эскиза"},
            {"label": "Изменения", "value": "до 3 дней до даты"},
        ],
        # Ответ на первый вопрос — с макета, остальные в кадре свёрнуты: черновики,
        # согласовать с заказчиком (отчёт 008a)
        "faq": [
            {
                "question": "Можно ли привезти многоярусный торт?",
                "answer": (
                    "Да. Многоярусные торты везём сами и собираем на месте, если ярусов "
                    "больше двух. Стоимость сборки назовём при расчёте."
                ),
            },
            {
                "question": "Можно ли изменить заказ после эскиза?",
                "answer": (
                    "Да, до 3 дней до даты: поменяем начинку, надпись или детали декора. "
                    "Если меняется вес или число ярусов, пересчитаем стоимость."
                ),
            },
            {
                "question": "Что будет с авансом при отмене?",
                "answer": (
                    "Если отменить заказ раньше чем за 3 дня до даты, вернём аванс полностью. "
                    "Позже — удержим стоимость уже купленных продуктов и декора."
                ),
            },
            {
                "question": "Делаете ли надписи и топперы?",
                "answer": (
                    "Да. Надпись кремом или на шоколадной табличке входит в оформление, "
                    "топпер с надписью — от 600 ₽."
                ),
            },
            {
                "question": "Как хранить торт до праздника?",
                "answer": (
                    "В холодильнике при +2…+6 °C, в коробке. Достаньте торт за 30–40 минут "
                    "до подачи — так крем раскроет вкус."
                ),
            },
            {
                "question": "Есть ли дегустация?",
                "answer": (
                    "Да, дегустационный сет: шесть начинок по кусочку за 1 200 ₽. "
                    "Его можно заказать заранее и выбрать начинку дома."
                ),
            },
        ],
        "design_filling_note": "любая из списка, у ярусов может быть разная",
        "tasting_set_slug": "degustacionnyy-set",
        # Мега-меню «Торты на заказ» в шапке (макет home.png, 014). Фото — те же
        # снимки с макета, что у работ галереи (вырезаны в 004); подставляются при
        # сиде. У «Юбилея и корпоратива» фото в макете нет — плашка
        "header_menu": {
            "facts": "от 2 кг · от 5 дней · от 3 200 ₽ за кг",
            "cards": [
                {"occasion": "wedding", "label": "Свадьба"},
                {"occasion": "birthday", "label": "День рождения"},
                {"occasion": "kids", "label": "Детский"},
                {"occasion": "anniversary_corporate", "label": "Юбилей и корпоратив"},
            ],
        },
    },
    PageKey.CONTACTS: {
        "title": "Контакты",
        # Блок 05 карточки товара «Доставка и оплата» читает эти поля отсюда,
        # чтобы условия не дублировались в каждом товаре
        "delivery": "Доставка по Москве",
        "pickup": "Самовывоз с Гжатской, 5к8",
        "payment": "Оплата при получении",
        # Справа от заголовка «Каталог» — две строки, перенос сохраняется (005b)
        "catalog_note": "Самовывоз на Гжатской\nс 9:00 до 21:00, доставка по Москве",
        # Страница товара, строки «Самовывоз» и «Доставка» — с макета 01-medovik-whole.png (006)
        "product_pickup": "Гжатская, 5к8, с 9:00 до 21:00",
        "pickup_place": "на Гжатской, 5к8",
        "product_delivery": "По Москве, окна по 3 часа",
        # Блок «Кондитерская на Гжатской» на главной и подвал — как на макете.
        # interior_image_key подставляется при сиде, когда фото загружено.
        "how_to_get": "440 м от остановки,\n1,4 км от Давыдково",
        "features": ["Кофе с собой", "Вай-фай", "Можно с собакой"],
        "route_url": YANDEX_ORG_URL,
        "reviews_count_text": "85 отзывов",
        "award": "Хорошее место 2026",
        "socials": [
            {"label": "Телеграм", "href": "https://t.me/abricosova_elena"},
            # Адреса страницы ВКонтакте пока нет — заглушка до ответа заказчика
            {"label": "ВКонтакте", "href": "https://vk.com/"},
        ],
        # Страница «Контакты» (макет new/design/pages/contacts.png, 010a/010b).
        # Почты нет — строки «Почта» на сайте не будет, пока её не впишут в админке
        "intro": "Витрина и кофейня на Гжатской. Заказы принимаем на сайте, по телефону "
        "и в Telegram",
        "pickup_description": "Заказ ждёт на витрине в выбранное окно. Кондитерская открыта "
        "каждый день с 9:00 до 21:00.",
        "delivery_description": "По Москве в пределах МКАД, окна по три часа: 9:00–12:00, "
        "12:00–15:00, 15:00–18:00. Стоимость от 500 ₽, при заказе от 5 000 ₽ бесплатно. "
        "За МКАД рассчитаем при подтверждении.",
        # Реквизиты — нулевые, как ОГРНИП: настоящие пришлёт заказчик. Имя отсюда же
        # берут подвал и правовые документы (оператор ПДн) — одно место для правки
        "legal": {
            "name": "ИП Абрикосова Е. О.",
            "ogrnip": "000000000000000",
            "inn": "000000000000",
            "production_address": "Москва, Гжатская улица, 5к8",
        },
    },
    # Страница «Работы» (009) — тексты с макета works.png
    PageKey.GALLERY: {
        "intro": "Свадьбы, дни рождения и юбилеи. Понравился торт, закажите похожий: "
        "Елена подстроит его под ваш повод и число гостей",
        "cta": {
            "title": "Не нашли похожий?",
            "text": "Пришлите фото-образец или опишите идею. В день обращения назовём вес, "
            "срок и стоимость",
        },
    },
    # «Редакция от …» политики, соглашения и согласия (010b)
    PageKey.LEGAL: {
        "privacy_revised_at": "2026-10-01",
        "terms_revised_at": "2026-10-01",
        "consent_revised_at": "2026-10-01",
    },
}

# Фото карточек мега-меню «Торты на заказ» по порядку карточек (файлы seed_assets/gallery)
MENU_PHOTOS = ("belyy-s-pionami", "shokolad-i-vishnya", "lisenok")

CONTACTS_FIELDS: dict[str, Any] = {
    "address": "Гжатская улица, 5к8",
    "phone": "8-962-352-22-77",
    # Одной строкой, выходные не отличаются; с закрытием — как на макетах 09.10
    "work_hours_weekdays": "Каждый день с 9:00 до 21:00",
    "work_hours_weekend": None,
    "delivery_hours": "доставка 09:00–21:00",
    "yandex_rating": Decimal("5.0"),
    # «169 оценок» — число оценок; число отзывов («85 отзывов») — в content
    "yandex_reviews_count": 169,
    "yandex_maps_url": YANDEX_REVIEWS_URL,
    "telegram_url": "https://t.me/abricosova_elena",
}


def default_name(email: str) -> str:
    """Имя по умолчанию — как его ставит миграция 3f6a1c2b9d01: часть e-mail до «@»
    с заглавной буквы."""
    local = email.split("@", 1)[0]
    return (local[:1].upper() + local[1:])[:100]


async def _seed_admin(session, email: str, password_hash: str, name: str) -> None:
    exists = await session.scalar(select(func.count()).select_from(AdminUser))
    if exists:
        # Миграция имён (011c) дала сид-владельцу имя из e-mail («Owner»). Если его
        # никто не правил — ставим настоящее; имя, исправленное руками, не трогаем
        owner = await session.scalar(select(AdminUser).where(AdminUser.email == email))
        if owner is not None and owner.name == default_name(email) and name != owner.name:
            owner.name = name
            logger.info("Имя сид-владельца обновлено: %s", name)
        logger.info("Учётные записи администраторов уже есть — пропускаю")
        return

    session.add(
        AdminUser(
            email=email,
            name=name,
            password_hash=password_hash,
            role=AdminRole.OWNER,
            is_active=True,
        )
    )
    logger.info("Создан администратор owner: %s", email)


async def _upload_asset(folder: str, name: str | None, placeholder: str) -> str:
    """Загружает фото из seed_assets в хранилище; без хранилища — плейсхолдер."""
    if name is None:
        return placeholder
    path = ASSETS_DIR / folder / f"{name}.png"
    try:
        return await storage.store_image(path.read_bytes(), prefix=folder)
    except (storage.StorageNotConfiguredError, OSError, HTTPException) as exc:
        logger.warning("Фото %s не загружено (%r) — оставлен плейсхолдер", path.name, exc)
        return placeholder


def _product(
    seed: SeedProduct,
    category: Category,
    order: int,
    image_key: str | None,
    role_keys: list[str] | None = None,
) -> Product:
    subcategory = next(s for s in category.subcategories if s.slug == seed.subcategory)
    kcal, proteins, fats, carbs = (
        (Decimal(v) for v in seed.nutrition) if seed.nutrition else (None,) * 4
    )
    product = Product(
        name=seed.name,
        slug=seed.slug,
        category_id=category.id,
        subcategory_id=subcategory.id,
        is_available=True,
        is_active=True,
        description=f"Демо-описание: {seed.name}. Заменяется реальным текстом через админку.",
        composition=seed.composition or seed.card_ingredients,
        subtitle=seed.subtitle,
        card_ingredients=seed.card_ingredients,
        allergens=seed.allergens,
        packaging=seed.packaging,
        allows_inscription=seed.allows_inscription,
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
        recipients=seed.recipients,
        dietary=seed.dietary,
        card_label=seed.card_label,
        is_featured=seed.featured,
        is_upsell=seed.upsell,
        order=order,
    )
    product.variants = [
        ProductVariant(
            label=variant.label,
            price=Decimal(variant.price),
            weight_grams=variant.weight_grams,
            portions_min=variant.portions[0] if variant.portions else None,
            portions_max=variant.portions[1] if variant.portions else None,
            size_note=variant.size_note,
            order=index,
            is_active=True,
        )
        for index, variant in enumerate(seed.variants)
    ]
    if image_key is not None:
        product.images = [ProductImage(storage_key=image_key, is_main=True, order=0)]
    elif seed.image_roles:
        product.images = [
            ProductImage(
                storage_key=(
                    role_keys[i]
                    if role_keys and i < len(role_keys)
                    else f"placeholder/products/{seed.slug}-{role.value}.webp"
                ),
                is_main=(i == 0),
                order=i,
                role=role,
            )
            for i, role in enumerate(seed.image_roles)
        ]
    else:
        product.images = [
            ProductImage(
                storage_key=f"placeholder/products/{seed.slug}-{i}.webp",
                is_main=(i == 0),
                order=i,
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
    for order, seed_category in enumerate(CATEGORIES):
        category = Category(
            name=seed_category.name,
            slug=seed_category.slug,
            order=order,
            is_active=seed_category.is_active,
            intro=seed_category.intro,
            all_label=seed_category.all_label,
        )
        category.subcategories = [
            SubCategory(
                name=sub.name,
                slug=sub.slug,
                order=sub_order,
                is_active=True,
                applies_fillings=sub.applies_fillings,
                intro=sub.intro,
            )
            for sub_order, sub in enumerate(seed_category.subcategories)
        ]
        categories[seed_category.slug] = category
        session.add(category)

    await session.flush()

    # Локальный MinIO стартует пустым, а сид идёт до запуска приложения,
    # которое обычно заводит бакет, — создаём его здесь
    await storage.ensure_storage()

    products: dict[str, Product] = {}
    for order, seed in enumerate(PRODUCTS):
        image_key = (
            await _upload_asset("products", seed.image, f"placeholder/products/{seed.slug}.webp")
            if seed.image
            else None
        )
        role_keys = [
            await _upload_asset(
                "products", name, f"placeholder/products/{seed.slug}-{role.value}.webp"
            )
            for name, role in zip(seed.role_images, seed.image_roles, strict=False)
        ]
        product = _product(seed, categories[seed.category], order, image_key, role_keys)
        products[seed.slug] = product
        session.add(product)

    await session.flush()

    for order, filling in enumerate(FILLINGS):
        session.add(
            Filling(
                name=filling.name,
                description=filling.description,
                short_description=filling.short,
                dietary=list(filling.dietary),
                image_key=await _upload_asset(
                    "fillings", filling.image, f"placeholder/fillings/{order}.webp"
                ),
                price_per_kg=Decimal(filling.price),
                is_available=True,
                order=order,
            )
        )

    for order, design in enumerate(CUSTOM_CAKES):
        images = [
            CustomCakeImage(
                storage_key=await _upload_asset(
                    "custom-cakes", name, f"placeholder/custom-cakes/{order}-{index}.webp"
                ),
                role=role,
                order=index,
            )
            for index, (name, role) in enumerate(design.images)
        ] or [
            CustomCakeImage(
                storage_key=f"placeholder/custom-cakes/{order}.webp",
                role=CakeImageRole.WHOLE,
                order=0,
            )
        ]
        session.add(
            CustomCake(
                slug=design.slug,
                title=design.title,
                subtitle=design.subtitle,
                description="",
                occasion=design.occasion,
                tiers=design.tiers,
                min_guests=design.min_guests,
                decoration=design.decoration,
                images=images,
                is_active=True,
                order=order,
            )
        )

    for order, work in enumerate(GALLERY):
        session.add(
            GalleryItem(
                image_key=await _upload_asset(
                    "gallery", work.image, f"placeholder/gallery/{order}.webp"
                ),
                detail_image_key=(
                    await _upload_asset(
                        "gallery", work.detail_image, f"placeholder/gallery/{order}-detail.webp"
                    )
                    if work.detail_image
                    else None
                ),
                caption=work.caption,
                occasion=work.occasion,
                tiers=work.tiers,
                weight_grams=work.weight_grams,
                guests=work.guests,
                made_in=work.made_in,
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

    for author, text, rating, written_on in YANDEX_REVIEWS:
        session.add(
            Review(
                author_name=author,
                text=text,
                rating=rating,
                is_published=True,
                source=ReviewSource.YANDEX,
                external_url=YANDEX_REVIEWS_URL,
                # Дата под отзывом — месяц отзыва на Яндексе, а не день сида
                created_at=datetime.combine(written_on, time(12), tzinfo=UTC),
            )
        )

    # Портрет и интерьер лежат в контенте страниц ключами, как и остальные фото.
    # Без хранилища ключа нет — блок на сайте покажет заглушку.
    content = copy.deepcopy(PAGE_CONTENT)
    portrait = await _upload_asset("pages", "elena", "placeholder/pages/elena.webp")
    content[PageKey.HOME]["author"]["image_key"] = portrait
    content[PageKey.ABOUT]["team"][0]["image_key"] = portrait
    menu_cards = content[PageKey.CUSTOM_CAKES]["header_menu"]["cards"]
    for card, photo in zip(menu_cards, MENU_PHOTOS, strict=False):
        card["image_key"] = await _upload_asset(
            "gallery", photo, f"placeholder/pages/menu-{card['occasion']}.webp"
        )
    interior = await _upload_asset("pages", "interior", "placeholder/pages/interior.webp")
    content[PageKey.CONTACTS]["interior_image_key"] = interior

    for page_key in PageKey:
        extra = CONTACTS_FIELDS if page_key is PageKey.CONTACTS else {}
        session.add(PageContent(page_key=page_key, content=content[page_key], **extra))

    logger.info(
        "Созданы демо-данные: %d групп каталога, %d товаров, %d начинок, "
        "%d работ в галерее, %d отзывов",
        len(CATEGORIES),
        len(PRODUCTS),
        len(FILLINGS),
        len(GALLERY),
        len(REVIEWS) + len(YANDEX_REVIEWS),
    )


async def seed(admin_only: bool = False) -> None:
    settings = get_settings()

    async with SessionLocal() as session:
        if settings.admin_seed_email and settings.admin_seed_password:
            await _seed_admin(
                session,
                settings.admin_seed_email,
                hash_password(settings.admin_seed_password),
                settings.admin_seed_name,
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
