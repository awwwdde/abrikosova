"""SQLAlchemy-модели по new/spec/01-data-model.md.

Импорт всех моделей здесь обязателен: Alembic autogenerate видит только те таблицы,
что зарегистрированы в Base.metadata на момент импорта.
"""

from app.models.admin import AdminSession, AdminUser, BackupRecord
from app.models.audit import AuditLogEntry
from app.models.cart import Cart, CartItem
from app.models.catalog import Category, Product, ProductImage, ProductVariant, SubCategory
from app.models.content import GalleryItem, PageContent, Review
from app.models.custom_cakes import CustomCake, CustomCakeImage, Filling
from app.models.enums import (
    AdminRole,
    Availability,
    BackupStatus,
    BackupType,
    CakeDecoration,
    CakeImageRole,
    ConsultationSource,
    ConsultationStatus,
    ContactMethod,
    DeliveryInterval,
    DeliveryMethod,
    DietaryTag,
    ImageRole,
    Occasion,
    OrderStatus,
    PageKey,
    PortionsRange,
    ProductTag,
    Recipient,
    RequestOccasion,
    ReviewSource,
)
from app.models.legacy import LegacyKind, LegacyRedirect
from app.models.media import BackupChunk, BackupObject, MediaChunk, MediaObject
from app.models.orders import Order, OrderItem
from app.models.requests import ConsultationImage, ConsultationRequest
from app.models.settings import SiteSetting

__all__ = [
    "MediaObject",
    "MediaChunk",
    "BackupObject",
    "BackupChunk",
    "AdminRole",
    "AdminSession",
    "AdminUser",
    "AuditLogEntry",
    "Availability",
    "BackupRecord",
    "BackupStatus",
    "BackupType",
    "CakeDecoration",
    "CakeImageRole",
    "Cart",
    "CartItem",
    "Category",
    "ConsultationImage",
    "ConsultationRequest",
    "CustomCakeImage",
    "ConsultationSource",
    "ConsultationStatus",
    "ContactMethod",
    "CustomCake",
    "DeliveryInterval",
    "DeliveryMethod",
    "DietaryTag",
    "Filling",
    "GalleryItem",
    "ImageRole",
    "LegacyKind",
    "LegacyRedirect",
    "Occasion",
    "Order",
    "OrderItem",
    "OrderStatus",
    "PageContent",
    "PageKey",
    "PortionsRange",
    "Product",
    "ProductImage",
    "ProductTag",
    "ProductVariant",
    "Recipient",
    "RequestOccasion",
    "Review",
    "ReviewSource",
    "SiteSetting",
    "SubCategory",
]
