"""SQLAlchemy-модели по new/spec/01-data-model.md.

Импорт всех моделей здесь обязателен: Alembic autogenerate видит только те таблицы,
что зарегистрированы в Base.metadata на момент импорта.
"""

from app.models.admin import AdminUser, BackupRecord
from app.models.cart import Cart, CartItem
from app.models.catalog import Category, Product, ProductImage, SubCategory
from app.models.content import GalleryItem, PageContent, Review
from app.models.custom_cakes import CustomCake, Filling
from app.models.enums import (
    AdminRole,
    BackupStatus,
    BackupType,
    ConsultationSource,
    ConsultationStatus,
    DeliveryMethod,
    OrderStatus,
    PageKey,
    ProductTag,
    ReviewSource,
)
from app.models.orders import Order, OrderItem
from app.models.requests import ConsultationRequest

__all__ = [
    "AdminRole",
    "AdminUser",
    "BackupRecord",
    "BackupStatus",
    "BackupType",
    "Cart",
    "CartItem",
    "Category",
    "ConsultationRequest",
    "ConsultationSource",
    "ConsultationStatus",
    "CustomCake",
    "DeliveryMethod",
    "Filling",
    "GalleryItem",
    "Order",
    "OrderItem",
    "OrderStatus",
    "PageContent",
    "PageKey",
    "Product",
    "ProductImage",
    "ProductTag",
    "Review",
    "ReviewSource",
    "SubCategory",
]
