"""Каталог: Category → SubCategory → Product → ProductVariant / ProductImage.

Структура унаследована от старой Django-модели (ANALYSIS.md, раздел 3) и расширена
полями, обязательными по договору (01-data-model.md, разделы 1-4), и полями карточки
из PDF «Этап 1 · Аналитика и проектирование» (раздел 14): вес и порции числами,
КБЖУ, ограничения в питании, поводы, срок изготовления и перевозка.

С задания 005a цена, вес и порции живут в вариантах товара (`ProductVariant`):
«Медовик целый» продаётся по 1 кг и 2 кг, у каждого веса своя цена и порции.
У самого товара этих полей больше нет — две правды о цене разъехались бы
при первой же правке.
"""

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ColumnElement,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    case,
    func,
    literal,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import clock
from app.core.db import Base
from app.models.enums import DietaryTag, ImageRole, Occasion, ProductTag, Recipient
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.content import Review


def _enum_array(enum_cls: type, name: str) -> ARRAY:
    """Массив PostgreSQL-enum: в БД хранятся значения (`"kids"`), а не имена (`"KIDS"`)."""
    return ARRAY(SAEnum(enum_cls, name=name, values_callable=lambda e: [i.value for i in e]))


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Абзац под сеткой раздела («Готовые торты фиксированного веса…»): и текст
    # для покупателя, и описание раздела для поисковиков
    intro: Mapped[str | None] = mapped_column(Text)
    # Подпись первой «таблетки» подразделов: «Все торты», «Все десерты».
    # Пусто — фронтенд пишет «Все»
    all_label: Mapped[str | None] = mapped_column(String(50))

    subcategories: Mapped[list["SubCategory"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", order_by="SubCategory.order"
    )
    products: Mapped[list["Product"]] = relationship(back_populates="category")


class SubCategory(Base):
    __tablename__ = "subcategories"
    __table_args__ = (UniqueConstraint("category_id", "slug", name="uq_subcategory_category_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Явный флаг вместо проверки по ключевым словам в названии, как было в старом коде
    applies_fillings: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Абзац под сеткой подраздела — как у категории
    intro: Mapped[str | None] = mapped_column(Text)

    category: Mapped["Category"] = relationship(back_populates="subcategories")
    products: Mapped[list["Product"]] = relationship(back_populates="subcategory")


class Product(Base, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("lead_time_days >= 0", name="ck_product_lead_time_non_negative"),
        Index("ix_product_active_available", "is_active", "is_available"),
        Index("ix_product_category_subcategory", "category_id", "subcategory_id"),
        # GIN-индексы под фильтры по массивам: `occasions && [...]`, `dietary @> [...]`
        Index("ix_product_occasions", "occasions", postgresql_using="gin"),
        Index("ix_product_dietary", "dietary", postgresql_using="gin"),
        Index("ix_product_recipients", "recipients", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    subcategory_id: Mapped[int] = mapped_column(ForeignKey("subcategories.id"), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    composition: Mapped[str] = mapped_column(Text, nullable=False)
    # Подзаголовок на странице товара: «Тонкие медовые коржи и сметанный крем»
    subtitle: Mapped[str | None] = mapped_column(String(120))
    # Короткий состав для карточки в сетке. Отдельное поле, а не обрезка
    # `composition`: автоматически получилось бы «мука пшеничная, сметана, мёд,
    # сгущённое…». Пусто — карточка строку не показывает.
    card_ingredients: Mapped[str | None] = mapped_column(String(120))
    allergens: Mapped[str | None] = mapped_column(String(200))
    packaging: Mapped[str | None] = mapped_column(String(200))
    # КБЖУ на 100 г. Необязательно: у части позиций расчёта может не быть,
    # и лучше не показать блок, чем показать выдуманные цифры.
    kcal: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    proteins: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    fats: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    carbs: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    shelf_life: Mapped[str | None] = mapped_column(String(100))
    storage_conditions: Mapped[str | None] = mapped_column(Text)
    # «Перевозка: до 3 часов» — сколько позиция переживёт в дороге
    transport_time: Mapped[str | None] = mapped_column(String(100))
    # Подпись типа позиции в карточке: «фирменная позиция · 1200 г». Пусто —
    # фронтенд пишет название подкатегории. Отдельное поле, потому что
    # «фирменная позиция» — не подкатегория, а решение, как подать товар.
    card_label: Mapped[str | None] = mapped_column(String(50))
    # Срок изготовления в днях. 0 — «в наличии сегодня», больше 0 — «на заказ».
    # По нему работает фильтр «Срок» и проверка желаемой даты в заказе.
    lead_time_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # «Закончилось сегодня» (006b): день кондитерской, в который позиция кончилась.
    # Дата, а не флаг с ночным сбросом: в полночь по Москве товар сам перестаёт
    # быть «закончившимся» — даже если планировщик пропустил ночь или API
    # перезапускался. Не путать с is_available = False — «не продаётся вовсе».
    sold_out_on: Mapped[date | None] = mapped_column(Date)
    tags: Mapped[list[ProductTag]] = mapped_column(
        _enum_array(ProductTag, "product_tag"), default=list, nullable=False
    )
    occasions: Mapped[list[Occasion]] = mapped_column(
        _enum_array(Occasion, "occasion"), default=list, server_default="{}", nullable=False
    )
    dietary: Mapped[list[DietaryTag]] = mapped_column(
        _enum_array(DietaryTag, "dietary_tag"), default=list, server_default="{}", nullable=False
    )
    # «Кому»: для неё, для него, для детей. Фильтр внутри группы — через ИЛИ
    recipients: Mapped[list[Recipient]] = mapped_column(
        _enum_array(Recipient, "recipient"), default=list, server_default="{}", nullable=False
    )
    # Можно ли заказать надпись на шоколадной табличке. Цена надписи одна на весь
    # сайт — в настройках (`inscription_price`), а не у каждого товара
    allows_inscription: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # «Предлагать в корзине» (007a): блок «К торту часто берут» — свечи, открытка,
    # маленькие пирожные. Товар может лежать в скрытом разделе «К торту»
    is_upsell: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped["Category"] = relationship(back_populates="products")
    subcategory: Mapped["SubCategory"] = relationship(back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.order"
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="(ProductVariant.order, ProductVariant.id)",
    )
    reviews: Mapped[list["Review"]] = relationship(back_populates="product")

    @property
    def price_from(self) -> Decimal | None:
        """Минимальная цена включённых вариантов — «от 2 400 ₽». Нужны
        загруженные `variants`; в запросах то же считает `price_from_column()`."""
        return min((v.price for v in self.variants if v.is_active), default=None)

    @hybrid_property
    def sold_out_today(self) -> bool:
        return self.sold_out_on is not None and self.sold_out_on == clock.local_today()

    @sold_out_today.inplace.setter
    def _sold_out_today_setter(self, value: bool) -> None:
        # Переключатель админки: «закончилось» — на сегодняшний день кондитерской
        self.sold_out_on = clock.local_today() if value else None

    @sold_out_today.inplace.expression
    @classmethod
    def _sold_out_today_expression(cls) -> ColumnElement[bool]:
        # Сегодняшняя дата — параметром запроса: «сегодня» считает приложение
        # по BUSINESS_TIMEZONE, а не часовой пояс сервера БД
        return func.coalesce(cls.sold_out_on == literal(clock.local_today()), False)

    @hybrid_property
    def effective_lead_time_days(self) -> int:
        """Срок, по которому живёт витрина, фильтр «Срок», ближайшая дата и проверка
        даты заказа (006b). Закончилось сегодня — «под заказ на день»: одна правда
        о сроке во всех местах, а в админке остаётся настоящий `lead_time_days`."""
        return max(self.lead_time_days, 1) if self.sold_out_today else self.lead_time_days

    @effective_lead_time_days.inplace.expression
    @classmethod
    def _effective_lead_time_expression(cls) -> ColumnElement[int]:
        return case(
            (cls.sold_out_today, func.greatest(cls.lead_time_days, 1)),
            else_=cls.lead_time_days,
        )


class ProductVariant(Base):
    """Вариант товара: вес со своей ценой, порциями и размером («1 кг», «2 кг»).

    У каждого товара хотя бы один вариант — у пирожного он единственный («100 г»).
    Вариант по умолчанию — первый по `order`: его данные показывает карточка.
    Вариант из заказов удалить нельзя (RESTRICT из `order_items`), только
    выключить: история заказа должна ссылаться на то, что действительно купили.
    """

    __tablename__ = "product_variants"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_variant_price_positive"),
        # Вес необязателен: у сертификата его нет, а выдуманное «1 г» покупатель
        # увидел бы в карточке. Если вес есть — он положительный.
        CheckConstraint(
            "weight_grams IS NULL OR weight_grams > 0", name="ck_variant_weight_positive"
        ),
        # Порции — диапазон «от–до»: либо оба конца пусты (у набора конфет порций
        # нет), либо заданы оба, и нижний не больше верхнего.
        CheckConstraint(
            "(portions_min IS NULL AND portions_max IS NULL)"
            " OR (portions_min >= 1 AND portions_max >= portions_min)",
            name="ck_variant_portions_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Вес и порции — числа, а не текст: «хватит ли на 10 человек» — первый
    # вопрос покупателя, и по порциям работает фильтр каталога
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    portions_min: Mapped[int | None] = mapped_column(Integer)
    portions_max: Mapped[int | None] = mapped_column(Integer)
    # «диаметр 18 см, высота 8 см» — для строки «Вес и размер» на странице товара
    size_note: Mapped[str | None] = mapped_column(String(100))
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="variants")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Ключ объекта в S3 Object Storage (05-nonfunctional-and-acceptance.md, «Хранение файлов»)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    is_main: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Подпись миниатюры на странице товара: «Целиком», «Срез», «Деталь»,
    # «Упаковка». Пусто — фото без подписи
    role: Mapped[ImageRole | None] = mapped_column(
        SAEnum(ImageRole, name="image_role", values_callable=lambda e: [i.value for i in e])
    )

    product: Mapped["Product"] = relationship(back_populates="images")
