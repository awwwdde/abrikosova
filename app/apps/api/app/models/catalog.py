"""Каталог: Category → SubCategory → Product → ProductImage.

Структура унаследована от старой Django-модели (ANALYSIS.md, раздел 3) и расширена
полями, обязательными по договору (01-data-model.md, разделы 1-4).
"""

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import ProductTag
from app.models.mixins import TimestampMixin


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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

    category: Mapped["Category"] = relationship(back_populates="subcategories")
    products: Mapped[list["Product"]] = relationship(back_populates="subcategory")


class Product(Base, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_product_price_positive"),
        Index("ix_product_active_available", "is_active", "is_available"),
        Index("ix_product_category_subcategory", "category_id", "subcategory_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    subcategory_id: Mapped[int] = mapped_column(ForeignKey("subcategories.id"), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    composition: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[str] = mapped_column(String(50), nullable=False)
    portions: Mapped[str | None] = mapped_column(String(50))
    shelf_life: Mapped[str | None] = mapped_column(String(100))
    storage_conditions: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list[ProductTag]] = mapped_column(
        ARRAY(
            SAEnum(
                ProductTag,
                name="product_tag",
                values_callable=lambda e: [i.value for i in e],
            )
        ),
        default=list,
        nullable=False,
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped["Category"] = relationship(back_populates="products")
    subcategory: Mapped["SubCategory"] = relationship(back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.order"
    )


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

    product: Mapped["Product"] = relationship(back_populates="images")
