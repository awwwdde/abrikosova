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
    # Юбилей (009): подписи работ «ЮБИЛЕЙ · АПРЕЛЬ 2026». В каталоге повода нет
    # (CATALOG_OCCASIONS), в галерее он объединён с корпоративом в один фильтр
    ANNIVERSARY = "anniversary"


class GalleryOccasion(enum.StrEnum):
    """Фильтр «Работ» (009) и карточки мега-меню «Торты на заказ» (014).

    Отдельно от `Occasion`: фильтр показывает «Юбилей и корпоратив» одной
    «таблеткой», а у работы повод один — юбилей или корпоратив. Значение-группа
    `anniversary_corporate` разворачивается в оба повода в запросе (GALLERY_GROUPS).
    Одно значение, а не список `?occasion=a&occasion=b`: адрес короче, его легко
    поставить в меню и в админке, а canonical/noindex считаются как у каталога.
    """

    WEDDING = "wedding"
    BIRTHDAY = "birthday"
    KIDS = "kids"
    ANNIVERSARY_CORPORATE = "anniversary_corporate"


class RequestOccasion(enum.StrEnum):
    """Повод в заявке на торт (окно заявки, 008a): «таблетки» фильтра «Работ»
    плюс «Другое». Отдельно от `Occasion` каталога: в окне «Юбилей и корпоратив»
    — один выбор, а чаепитию торт на заказ не нужен."""

    WEDDING = "wedding"
    BIRTHDAY = "birthday"
    KIDS = "kids"
    ANNIVERSARY_CORPORATE = "anniversary_corporate"
    OTHER = "other"


class Recipient(enum.StrEnum):
    """Фильтр «Кому» в каталоге (макет `new/design/catalog/02-filters-open.png`).

    Отдельная ось, а не повод: «для детей» — про того, кто будет есть, и он
    сочетается с любым поводом («детский день рождения»). Раньше это был
    повод `kids`; в каталоге его заменил получатель, а в галерее работ
    `Occasion.KIDS` остаётся — там это тип события (задание 009).
    """

    HER = "her"
    HIM = "him"
    KIDS = "kids"


class ImageRole(enum.StrEnum):
    """Что показывает фото товара: подпись миниатюры на странице товара."""

    WHOLE = "whole"
    CUT = "cut"
    DETAIL = "detail"
    PACKAGE = "package"


class CakeImageRole(enum.StrEnum):
    """Подпись фото дизайна торта на заказ (008a). Свой набор, а не `ImageRole`:
    у торта на заказ нет упаковки, зато есть вид сбоку — ярусы видно только так."""

    WHOLE = "whole"
    CUT = "cut"
    DETAIL = "detail"
    SIDE = "side"


class CakeDecoration(enum.StrEnum):
    """Оформление торта на заказ — от него зависит цена за кг (блок «Цены», 008a)."""

    CLASSIC = "classic"
    CREAM_DRAWING = "cream_drawing"
    MULTI_TIER = "multi_tier"


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
    """Фильтр «Срок» — радио: любой срок, забрать сегодня, под заказ.

    `any` — явное «без условия»: у радио в панели фильтров это отдельный пункт
    со своим счётчиком, и фронтенду удобнее передать его как значение.
    """

    ANY = "any"
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


class ContactMethod(enum.StrEnum):
    """«Как связаться для подтверждения» в оформлении (007a, макет cart-checkout)."""

    CALL = "call"
    TELEGRAM = "telegram"


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
    """Откуда отзыв.

    `yandex` — отзыв, перенесённый с Яндекс.Карт (блок «Что говорят гости»
    на главной). Его текст внесён вручную, а ссылка `external_url` ведёт на
    оригинал: гость должен иметь возможность проверить, что отзыв настоящий.
    """

    SITE_FORM = "site_form"
    MANUAL = "manual"
    YANDEX = "yandex"


class AdminRole(enum.StrEnum):
    OWNER = "owner"
    MANAGER = "manager"


class PageKey(enum.StrEnum):
    HOME = "home"
    ABOUT = "about"
    CUSTOM_CAKES = "custom_cakes"
    CONTACTS = "contacts"
    # Страница «Работы» (009): текст справа от заголовка и бордовая плашка внизу
    GALLERY = "gallery"
    # Политика, соглашение, согласие на обработку ПДн: даты редакции (010b)
    LEGAL = "legal"


class BackupType(enum.StrEnum):
    AUTO = "auto"
    MANUAL = "manual"


class BackupStatus(enum.StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
