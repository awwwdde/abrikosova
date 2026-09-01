"""Схемы каталога."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import ProductTag


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    storage_key: str
    is_main: bool
    order: int


class SubCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    applies_fillings: bool


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order: int
    subcategories: list[SubCategoryOut] = []


class ProductListItem(BaseModel):
    """Карточка товара в сетке каталога — без тяжёлых текстовых полей."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    price: Decimal
    is_available: bool
    tags: list[ProductTag]
    weight: str
    main_image: str | None = None


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


class ProductDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    price: Decimal
    is_available: bool
    description: str
    composition: str
    weight: str
    portions: str | None
    shelf_life: str | None
    storage_conditions: str | None
    tags: list[ProductTag]
    main_image: str | None = None
    category: CategoryBreadcrumb
    subcategory: SubCategoryBreadcrumb
    images: list[ProductImageOut]
    related_products: list[ProductListItem] = []
    fillings: list[FillingOut] = []
