"""Перечисления модели данных.

Строгие enum вместо свободных строк — прямой ответ на ANALYSIS.md, п. 2.1.7,
где delivery_method был объявлен без choices и отображение дублировалось руками.
"""

import enum


class ProductTag(enum.StrEnum):
    NEW = "new"
    HIT = "hit"
    SEASON = "season"


class Occasion(enum.StrEnum):
    """Повод — сквозной фильтр каталога и галереи (PDF «Этап 1», раздел 12).

    Каталог по-прежнему строится по типу продукта (5 групп), а повод работает
    поверх дерева фильтром: у Абрикосовой ассортимент шире тортов, и ось «повод»
    его целиком не покрывает. Один товар может подходить под несколько поводов.
    """

    BIRTHDAY = "birthday"
    KIDS = "kids"
    WEDDING = "wedding"
    CORPORATE = "corporate"
    TEA = "tea"


class DietaryTag(enum.StrEnum):
    """Ограничения в питании — сквозной сегмент (PDF «Этап 1», раздел 6).

    Отдельно от ProductTag: «новинка/хит/сезон» — маркетинговые метки,
    а это обещание о составе, и фильтруется оно по-другому (через И, а не ИЛИ).
    """

    GLUTEN_FREE = "gluten_free"
    LACTOSE_FREE = "lactose_free"
    LOW_SUGAR = "low_sugar"


class PortionsRange(enum.StrEnum):
    """Корзины фильтра «Порции» (PDF «Этап 1», раздел 12): до 4, 4–8, 8–15, больше 15."""

    UP_TO_4 = "up_to_4"
    FROM_4_TO_8 = "4_8"
    FROM_8_TO_15 = "8_15"
    OVER_15 = "over_15"


class Availability(enum.StrEnum):
    """Фильтр «Срок»: забрать сегодня или готовится под заказ."""

    TODAY = "today"
    PREORDER = "preorder"


class DeliveryInterval(enum.StrEnum):
    """Интервал доставки/выдачи в оформлении заказа (PDF «Этап 1», путь Марины).

    Набор фиксирован в коде, а не редактируется в админке: часы доставки
    09:00–21:00 не меняются от заказа к заказу, а свободный текст в этом поле
    ломал бы планирование. Если сетка интервалов изменится — это правка enum
    и миграция, а не контента.
    """

    I_09_12 = "09-12"
    I_12_15 = "12-15"
    I_15_18 = "15-18"
    I_18_21 = "18-21"


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
