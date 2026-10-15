"""«Сейчас» и «сегодня» с точки зрения кондитерской, а не сервера.

Сервер на хостинге живёт в UTC. Между 00:00 и 03:00 по Москве `date.today()`
на нём возвращает ещё вчерашнюю дату — и заказ «на завтра», оформленный
в половине первого ночи, проверялся бы не от той даты. Все даты, которые
видит покупатель (желаемая дата, срок изготовления, дата события, дата
в номере заказа), считаются от дня кондитерской (`BUSINESS_TIMEZONE`).

Всё время идёт через `local_now()`: это единственная точка, которую тесты
подменяют, чтобы проверить «ночные» сценарии без ожидания реальной ночи.
"""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def local_now() -> datetime:
    return datetime.now(ZoneInfo(get_settings().business_timezone))


def local_today() -> date:
    return local_now().date()


def utc_now() -> datetime:
    """Текущий момент в UTC — для сроков сессий админки. Тесты подменяют его,
    чтобы проверить «7 дней без активности» и «30 дней» без ожидания."""
    return datetime.now(UTC)
