"""Журнал действий человеческим текстом (011c): лента на главной и раздел «Журнал».

Одна функция `describe` на все записи — и лента, и журнал, и тесты идут через неё.

Пол сотрудника неизвестен, поэтому фразы без глагола в прошедшем времени:
«цена товара «Прага»: 5 000 → 5 200 ₽», «товар «Медовик» скрыт с сайта».
Причастие согласуется с родовым словом («товар», «начинка»), а не с названием:
название в кавычках склонять нельзя — «Прага» не превратится в «Праги» сама.

ПДн клиентов сюда не попадают: заказ — номером, заявка и отзыв — номером записи,
в событиях сайта только сумма, повод и дата (их пишет `audit.record_site`).
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    AdminUser,
    AuditLogEntry,
    Category,
    CustomCake,
    Filling,
    GalleryItem,
    Order,
    OrderStatus,
    Product,
    SubCategory,
)
from app.models.enums import AdminRole, ConsultationStatus, Occasion, PageKey, RequestOccasion
from app.schemas.catalog import OCCASION_LABELS
from app.schemas.custom_cakes import REQUEST_OCCASION_LABELS
from app.schemas.dashboard import ActivityItem
from app.services.sessions import describe_device


def business_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().business_timezone)


NBSP = " "

ORDER_STATUS = {
    OrderStatus.NEW: "Новый",
    OrderStatus.CONFIRMED: "Подтверждён",
    OrderStatus.IN_PROGRESS: "Готовится",
    OrderStatus.READY: "Готов к выдаче",
    OrderStatus.COMPLETED: "Выдан",
    OrderStatus.CANCELLED: "Отменён",
}
CONSULTATION_STATUS = {
    ConsultationStatus.NEW: "Новая",
    ConsultationStatus.CONTACTED: "В работе",
    ConsultationStatus.COMPLETED: "Завершена",
}
PAGE_LABELS = {
    PageKey.HOME: "Главная",
    PageKey.ABOUT: "О нас",
    PageKey.CUSTOM_CAKES: "Торты на заказ",
    PageKey.CONTACTS: "Контакты",
    PageKey.GALLERY: "Работы",
    PageKey.LEGAL: "Документы",
}
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()

# Блоки страниц человеческими словами — для «изменена страница «Главная»: вопросы»
PAGE_BLOCKS = {
    "hero": "первый экран",
    "ticker": "бегущая строка",
    "ready_today": "«Готово сегодня»",
    "made_to_order": "«Сделано на заказ»",
    "fillings_intro": "начинки",
    "order_banner": "баннер заказа",
    "author": "блок Елены",
    "faq": "вопросы",
    "stages": "этапы",
    "socials": "соцсети",
    "route_url": "маршрут",
    "features": "метки кофейни",
    # Страница «Работы» (009)
    "intro": "текст справа от заголовка",
    "cta": "плашка внизу",
}

# Родовое слово сущности и его род: «товар» — м., «начинка», «работа» — ж.
NOUNS: dict[str, tuple[str, str]] = {
    "product": ("товар", "m"),
    "category": ("раздел", "m"),
    "subcategory": ("подраздел", "m"),
    "custom_cake": ("торт на заказ", "m"),
    "filling": ("начинка", "f"),
    "gallery_item": ("работа", "f"),
}
GENITIVE = {
    "product": "товара",
    "category": "раздела",
    "subcategory": "подраздела",
    "custom_cake": "торта на заказ",
    "filling": "начинки",
    "gallery_item": "работы",
}
FIELD_LABELS = {
    "description": "описание",
    "composition": "состав",
    "caption": "подпись",
    "title": "название",
    "slug": "адрес",
    "image_key": "фото",
    "detail_image_key": "фото",
    "tags": "метки",
    "occasions": "поводы",
    "dietary": "ограничения",
    "portions_min": "порции",
    "portions_max": "порции",
    "category_id": "раздел",
    "subcategory_id": "подраздел",
    "card_label": "подпись на карточке",
    "subtitle": "подзаголовок",
    "card_ingredients": "состав для карточки",
    "allergens": "аллергены",
    "packaging": "упаковка",
    "recipients": "кому",
    "allows_inscription": "надпись на табличке",
    "intro": "текст под списком",
    "all_label": "подпись «Все»",
    "text": "текст",
    "author_name": "автор",
    "rating": "оценка",
    "product_id": "товар",
}
SECURITY = {
    "login_success": "вход в админку",
    "login_failed": "неудачная попытка входа",
    "login_locked": "вход заблокирован после 5 неудачных попыток",
    "logout": "выход из админки",
    "session_revoked": "завершён сеанс на другом устройстве",
    "sessions_revoked_others": "выход на остальных устройствах",
    "password_changed": "изменён пароль",
    "password_reset_cli": "пароль сброшен из консоли сервера",
    "refresh_reuse": "подозрение на кражу сессии: сеанс отозван",
    "refresh_replay_same_device": "сессия закрыта: повторное обновление с того же устройства",
}


def form(gender: str, masculine: str) -> str:
    """«скрыт» → «скрыта» для женского рода (начинка, работа)."""
    if gender == "f":
        return masculine[:-2] + "ена" if masculine.endswith("ён") else masculine + "а"
    return masculine


def money(value: Any, unit: str = "₽") -> str:
    """«5200.00» → «5 200 ₽» (неразрывные пробелы, копейки — только если есть)."""
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return str(value)
    if number == number.to_integral():
        text = f"{int(number):,}".replace(",", NBSP)
    else:
        text = f"{number:,.2f}".replace(",", NBSP).replace(".", ",")
    return f"{text}{NBSP}{unit}"


def plural(n: int, forms: tuple[str, str, str]) -> str:
    n = abs(n)
    if 11 <= n % 100 <= 14:
        return forms[2]
    if n % 10 == 1:
        return forms[0]
    if 2 <= n % 10 <= 4:
        return forms[1]
    return forms[2]


def day_month(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        day = date.fromisoformat(iso)
    except ValueError:
        return None
    return f"{day.day}{NBSP}{MONTHS[day.month - 1]}"


def short_name(name: str | None) -> str:
    """«Ольга Тихонова» → «Ольга Т.»; одно слово — как есть."""
    if not name:
        return "Сотрудник"
    words = name.split()
    if len(words) >= 2:
        return f"{words[0]} {words[1][0].upper()}."
    return words[0]


def _grams(value: Any) -> str:
    return f"{value}{NBSP}г" if value else "без веса"


def _intervals(items: list[str]) -> str:
    """«09-12», «12-15» → «09–12, 12–15»."""
    return ", ".join(str(item).replace("-", "–") for item in items)


def _q(name: str | None, entity_id: str | None) -> str:
    if name:
        return f"«{name}»"
    return f"№{NBSP}{entity_id}" if entity_id else ""


def _catalog_update(entity: str, name: str | None, entity_id: str | None, details: dict) -> str:
    noun, gender = NOUNS[entity]
    genitive = GENITIVE[entity]
    changes: dict[str, list[Any]] = details.get("changes") or {}
    # Переименование: в остальных фразах — уже новое название
    if "name" in changes:
        name = changes["name"][1]
    title = _q(name, entity_id)
    parts: list[str] = []
    for field, (old, new) in changes.items():
        if field == "price":
            parts.append(f"цена {genitive} {title}: {money(old)} → {money(new)}")
        elif field == "price_per_kg":
            parts.append(f"цена {genitive} {title}: {money(old, '₽/кг')} → {money(new, '₽/кг')}")
        elif field == "is_active":
            parts.append(
                f"{noun} {title} {form(gender, 'скрыт')} с сайта"
                if not new
                else f"{noun} {title} снова на сайте"
            )
        elif field == "is_available":
            parts.append(
                f"{noun} {title} {form(gender, 'снят')} с наличия"
                if not new
                else f"{noun} {title} снова в наличии"
            )
        elif field == "sold_out_today":
            # «Наполеон: закончился сегодня» (006b)
            parts.append(
                f"{title}: {form(gender, 'закончил')}ся сегодня"
                if new
                else f"{title}: снова в наличии сегодня"
            )
        elif field == "lead_time_days":
            days = plural(int(new or 0), ("день", "дня", "дней"))
            parts.append(f"срок изготовления {genitive} {title}: {old} → {new}{NBSP}{days}")
        elif field == "weight_grams":
            parts.append(f"вес {genitive} {title}: {_grams(old)} → {_grams(new)}")
        elif field == "name":
            parts.append(f"{noun} «{old}» {form(gender, 'переименован')} в «{new}»")
        elif field == "order":
            parts.append(f"изменён порядок: {noun} {title}")
    fields = details.get("fields") or []
    if fields:
        labels = list(dict.fromkeys(FIELD_LABELS.get(field, field) for field in fields))
        parts.append(f"{form(gender, 'изменён')} {noun} {title}: {', '.join(labels)}")
    parts.extend(_variant_changes(title, details.get("variants") or []))
    return "; ".join(parts) if parts else f"{form(gender, 'изменён')} {noun} {title}"


def _variant_changes(title: str, variants: list[dict]) -> list[str]:
    """Варианты товара (005a): «цена товара «Медовик целый» (2 кг): 4 800 ₽ → 5 000 ₽»."""
    parts: list[str] = []
    for variant in variants:
        label = variant.get("label", "")
        where = f"{title} ({label})"
        if variant.get("action") == "added":
            parts.append(f"у товара {title} новый вариант «{label}»")
            continue
        if variant.get("action") == "removed":
            parts.append(f"у товара {title} удалён вариант «{label}»")
            continue
        for field, (old, new) in (variant.get("changes") or {}).items():
            if field == "price":
                parts.append(f"цена товара {where}: {money(old)} → {money(new)}")
            elif field == "weight_grams":
                parts.append(f"вес товара {where}: {_grams(old)} → {_grams(new)}")
            elif field == "is_active":
                state = "снова продаётся" if new else "выключен"
                parts.append(f"вариант «{label}» товара {title} {state}")
            elif field == "label":
                parts.append(f"вариант «{old}» товара {title} переименован в «{new}»")
        if variant.get("fields"):
            parts.append(f"изменён вариант «{label}» товара {title}")
    return parts


def describe(entry: AuditLogEntry, names: dict[str, dict[str, str]]) -> str:
    """Запись журнала человеческим текстом."""
    entity, action = entry.entity, entry.action
    entity_id = entry.entity_id
    details: dict[str, Any] = entry.details or {}
    name = names.get(entity, {}).get(entity_id or "")

    if entity == "auth":
        return SECURITY.get(action, action)

    if action == "site_order":
        number = details.get("number", entity_id)
        return f"новый заказ №{NBSP}{number} на {money(details.get('total', 0))}"
    if action == "site_consultation":
        if details.get("source") == "contact_page":
            return "новый вопрос со страницы «Контакты»"
        occasion = details.get("occasion")
        # Новые записи — повод окна заявки (008a), старые — повод каталога
        if occasion in RequestOccasion:
            what = REQUEST_OCCASION_LABELS[RequestOccasion(occasion)].lower()
        elif occasion in Occasion:
            what = OCCASION_LABELS[Occasion(occasion)].lower()
        else:
            what = None
        parts = [part for part in (what, day_month(details.get("event_date"))) if part]
        title = f"новая заявка {details['number']}" if details.get("number") else "новая заявка"
        return f"{title}: {', '.join(parts)}" if parts else f"{title} на торт"

    if action == "reorder":
        return {
            "category": "изменён порядок разделов",
            "subcategory": "изменён порядок подразделов",
            "gallery_item": "изменён порядок работ в «Примерах работ»",
            "filling": "изменён порядок начинок",
            "custom_cake": "изменён порядок тортов на заказ",
        }.get(entity, "изменён порядок")
    if entity in NOUNS:
        noun, gender = NOUNS[entity]
        title = _q(name, entity_id)
        if action == "update":
            return _catalog_update(entity, name, entity_id, details)
        if action == "create":
            return f"{form(gender, 'добавлен')} {noun} {title}"
        if action == "delete":
            return f"{form(gender, 'удалён')} {noun} {title}"
        images = {
            "upload_image": "загружено фото товара",
            "set_main_image": "выбрано главное фото товара",
            "delete_image": "удалено фото товара",
            "reorder_images": "изменён порядок фото товара",
            "image_role": "изменена подпись фото товара",
        }
        if action in images:
            return f"{images[action]} {title}"

    if entity == "order" and action == "view":
        number = f"№{NBSP}{name}" if name else f"№{NBSP}{entity_id}"
        return f"просмотрен заказ {number}"
    if entity == "order" and action == "update_status":
        status = details.get("status")
        label = ORDER_STATUS.get(OrderStatus(status)) if status in OrderStatus else None
        number = f"№{NBSP}{name}" if name else f"№{NBSP}{entity_id}"
        return f"заказ {number}: статус «{label}»" if label else f"изменён заказ {number}"
    if entity == "consultation":
        if action == "view":
            return f"просмотрена заявка №{NBSP}{entity_id}"
        if action == "view_reference":
            return f"открыто фото-образец заявки №{NBSP}{entity_id}"
        status = details.get("status")
        if status in ConsultationStatus:
            label = CONSULTATION_STATUS[ConsultationStatus(status)]
            return f"заявка №{NBSP}{entity_id}: статус «{label}»"
        return f"изменена заявка №{NBSP}{entity_id}"
    if entity == "review":
        number = f"№{NBSP}{entity_id}"
        published = (details.get("changes") or {}).get("is_published")
        if (
            action == "update"
            and (details.get("changes") or {}).get("created_at")
            and not published
        ):
            return f"изменена дата отзыва {number}"
        if action == "update" and published:
            return f"опубликован отзыв {number}" if published[1] else f"отзыв {number} снят с сайта"
        verb = {"create": "добавлен", "delete": "удалён"}.get(action, "изменён")
        return f"{verb} отзыв {number}"
    if entity == "page":
        page = PAGE_LABELS.get(PageKey(entity_id)) if entity_id in PageKey else entity_id
        changes = details.get("changes") or {}
        if "yandex_rating" in changes:
            old, new = changes["yandex_rating"]
            return f"рейтинг Яндекса на странице «{page}»: {old or 'нет'} → {new or 'нет'}"
        blocks = details.get("blocks") or []
        if blocks:
            names = ", ".join(PAGE_BLOCKS.get(block, block) for block in blocks)
            return f"изменена страница «{page}»: {names}"
        return f"изменена страница «{page}»"
    if entity == "admin_user":
        staff = f"«{name}»" if name else ""
        renamed = (details.get("changes") or {}).get("name")
        if action == "update_profile" and renamed:
            return f"имя в профиле: «{renamed[0]}» → «{renamed[1]}»"
        if action == "create":
            return f"добавлен сотрудник {staff}".strip()
        if action == "deactivate":
            return f"отключён сотрудник {staff}".strip()
        if renamed:
            return f"сотрудник переименован: «{renamed[0]}» → «{renamed[1]}»"
        if "password" in (details.get("fields") or []):
            return f"сотруднику {staff} задан новый пароль".replace("  ", " ")
        return f"изменены данные сотрудника {staff}".strip()
    if entity == "settings":
        changes = details.get("changes") or {}
        parts = []
        if "large_order_total" in changes:
            old, new = changes["large_order_total"]
            parts.append(f"порог крупного заказа: {money(old)} → {money(new)}")
        if "large_event_guests" in changes:
            old, new = changes["large_event_guests"]
            guests = plural(new, ("гость", "гостя", "гостей"))
            parts.append(f"порог крупного события: {old} → {new}{NBSP}{guests}")
        if "inscription_price" in changes:
            old, new = changes["inscription_price"]
            parts.append(f"цена надписи на табличке: {money(old)} → {money(new)}")
        if "slot_cutoff_minutes" in changes:
            old, new = changes["slot_cutoff_minutes"]
            parts.append(f"окно выдачи закрывается за {old} → {new}{NBSP}мин до начала")
        # Доставка (007a)
        if "delivery_price" in changes:
            old, new = changes["delivery_price"]
            parts.append(f"цена доставки: {money(old)} → {money(new)}")
        if "free_delivery_from" in changes:
            old, new = changes["free_delivery_from"]
            parts.append(f"бесплатная доставка от {money(old)} → {money(new)}")
        if "delivery_note" in changes:
            parts.append("текст о доставке")
        if "delivery_intervals" in changes:
            old, new = changes["delivery_intervals"]
            parts.append(f"окна доставки: {_intervals(old)} → {_intervals(new)}")
        if "work_hours_start" in changes or "work_hours_end" in changes:
            parts.append("часы ответа на заказы")
        return "; ".join(parts) if parts else "изменены настройки"
    if entity == "backup":
        return {
            "create": "создана резервная копия",
            "restore": "восстановлена резервная копия",
            "delete": "удалена резервная копия",
        }.get(action, "резервная копия")
    if entity == "personal_data":
        return "очищены устаревшие персональные данные"
    return f"{action}: {entity}"


# --- Выборка ---

NAME_SOURCES: dict[str, tuple[Any, Any]] = {
    "product": (Product, Product.name),
    "category": (Category, Category.name),
    "subcategory": (SubCategory, SubCategory.name),
    "custom_cake": (CustomCake, CustomCake.title),
    "filling": (Filling, Filling.name),
    "gallery_item": (GalleryItem, GalleryItem.caption),
    "order": (Order, Order.order_number),
    "admin_user": (AdminUser, AdminUser.name),
}

KINDS: dict[str, tuple[str, ...]] = {
    "catalog": ("product", "category", "subcategory", "custom_cake", "filling", "gallery_item"),
    "orders": ("order",),
    "requests": ("consultation",),
    "reviews": ("review",),
    "pages": ("page",),
    "staff": ("admin_user",),
    "system": ("settings", "backup", "personal_data"),
}


@dataclass(frozen=True)
class JournalFilter:
    security: bool = False
    actor: str | None = None  # id сотрудника или «site»
    kind: str | None = None
    # Просмотры карточек (011d) — для «Журнала»; лента главной их не показывает,
    # иначе каждый клик по заказу вытеснял бы из неё настоящие действия
    hide_views: bool = False


def query(filters: JournalFilter) -> Select:
    statement = select(AuditLogEntry, AdminUser.name, AdminUser.role).outerjoin(
        AdminUser, AdminUser.id == AuditLogEntry.actor_id
    )
    if filters.security:
        statement = statement.where(AuditLogEntry.entity == "auth")
    else:
        statement = statement.where(AuditLogEntry.entity != "auth")
    if filters.actor == "site":
        statement = statement.where(
            and_(AuditLogEntry.actor_id.is_(None), AuditLogEntry.action.like("site\\_%"))
        )
    elif filters.actor and filters.actor.isdigit():
        statement = statement.where(AuditLogEntry.actor_id == int(filters.actor))
    if filters.kind in KINDS:
        statement = statement.where(AuditLogEntry.entity.in_(KINDS[filters.kind]))
    if filters.hide_views:
        statement = statement.where(AuditLogEntry.action != "view")
    return statement


async def _names(session: AsyncSession, entries: list[AuditLogEntry]) -> dict[str, dict[str, str]]:
    ids: dict[str, set[int]] = {}
    for entry in entries:
        if entry.entity in NAME_SOURCES and entry.entity_id and entry.entity_id.isdigit():
            ids.setdefault(entry.entity, set()).add(int(entry.entity_id))
    names: dict[str, dict[str, str]] = {}
    for entity, wanted in ids.items():
        model, column = NAME_SOURCES[entity]
        rows = await session.execute(select(model.id, column).where(model.id.in_(wanted)))
        names[entity] = {str(item_id): value for item_id, value in rows.all()}
    return names


async def items(
    session: AsyncSession,
    viewer: AdminUser,
    filters: JournalFilter,
    *,
    limit: int,
    offset: int = 0,
) -> list[ActivityItem]:
    rows = (
        await session.execute(
            query(filters)
            .order_by(AuditLogEntry.created_at.desc(), AuditLogEntry.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    names = await _names(session, [entry for entry, _, _ in rows])
    result = []
    for entry, actor_name, role in rows:
        site = entry.actor_id is None and entry.action.startswith("site_")
        if site:
            actor = "Сайт"
        elif entry.actor_id is None:
            # Неудачный вход по несуществующему адресу или удалённый сотрудник
            actor = "Неизвестный адрес" if entry.entity == "auth" else "Сотрудник"
        else:
            actor = short_name(actor_name)
        meta = None
        if entry.entity == "auth":
            device = describe_device((entry.details or {}).get("user_agent"))
            meta = f"{device}, IP {entry.ip}" if entry.ip else device
        result.append(
            ActivityItem(
                id=entry.id,
                actor=actor,
                actor_role="менеджер" if role == AdminRole.MANAGER else None,
                is_you=entry.actor_id == viewer.id,
                is_site=site,
                # Время по часам кондитерской: «17:53» одинаково у всех, где бы ни
                # открыли журнал (011d)
                at=entry.created_at.astimezone(business_tz()),
                text=describe(entry, names),
                meta=meta,
            )
        )
    return result


async def count(session: AsyncSession, filters: JournalFilter) -> int:
    subquery = query(filters).subquery()
    return await session.scalar(select(func.count()).select_from(subquery)) or 0
