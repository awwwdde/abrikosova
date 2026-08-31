"""Перечисления модели данных.

Строгие enum вместо свободных строк — прямой ответ на ANALYSIS.md, п. 2.1.7,
где delivery_method был объявлен без choices и отображение дублировалось руками.
"""

import enum


class ProductTag(enum.StrEnum):
    NEW = "new"
    HIT = "hit"
    SEASON = "season"


class DeliveryMethod(enum.StrEnum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


class OrderStatus(enum.StrEnum):
    NEW = "new"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ConsultationStatus(enum.StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    COMPLETED = "completed"


class ConsultationSource(enum.StrEnum):
    """С какой формы пришла заявка (01-data-model.md, ConsultationRequest.source)."""

    CUSTOM_CAKE = "custom_cake"
    CONTACT_PAGE = "contact_page"


class ReviewSource(enum.StrEnum):
    SITE_FORM = "site_form"
    MANUAL = "manual"


class AdminRole(enum.StrEnum):
    OWNER = "owner"
    MANAGER = "manager"


class PageKey(enum.StrEnum):
    HOME = "home"
    ABOUT = "about"
    CUSTOM_CAKES = "custom_cakes"
    CONTACTS = "contacts"


class BackupType(enum.StrEnum):
    AUTO = "auto"
    MANUAL = "manual"


class BackupStatus(enum.StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
