"""Настройки кондитерской из админки (011c): пороги «крупного» заказа и события.

Хранятся в таблице `settings` по ключу на настройку. Чего в таблице нет — берётся
значение по умолчанию из схемы `BakerySettings`, поэтому пустая таблица — рабочее
состояние, а новая настройка не требует миграции с данными.

Главная читает пороги на каждый запрос, поэтому они кэшируются в Redis на 60 с.
Сохранение кэш сбрасывает — владелец видит новый порог сразу; другие процессы
API (на проде их несколько) подхватят его не позже чем через минуту.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models import SiteSetting
from app.schemas.settings import BakerySettings

CACHE_KEY = "bakery_settings"
CACHE_SECONDS = 60


async def load(session: AsyncSession) -> BakerySettings:
    redis = get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached:
        return BakerySettings.model_validate_json(cached)
    rows = await session.execute(
        select(SiteSetting.key, SiteSetting.value).where(
            SiteSetting.key.in_(BakerySettings.model_fields.keys())
        )
    )
    stored: dict[str, Any] = dict(rows.all())
    result = BakerySettings.model_validate(stored)
    await redis.set(CACHE_KEY, result.model_dump_json(), ex=CACHE_SECONDS)
    return result


async def save(session: AsyncSession, data: BakerySettings) -> dict[str, list[Any]]:
    """Сохраняет настройки и возвращает изменения «было → стало» для журнала.
    Коммит — на вызывающем, кэш сбрасывается после записи."""
    # В JSON-виде с обеих сторон: Decimal веса и списки ярусов/дополнений иначе
    # не сравнивались бы со словарями и не ложились бы в JSON-колонку
    before = (await load(session)).model_dump(mode="json")
    after = data.model_dump(mode="json")
    changes = {key: [before[key], value] for key, value in after.items() if before[key] != value}
    for key, value in after.items():
        statement = insert(SiteSetting).values(key=key, value=value)
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[SiteSetting.key], set_={"value": statement.excluded.value}
            )
        )
    await get_redis().delete(CACHE_KEY)
    return changes


async def drop_cache() -> None:
    await get_redis().delete(CACHE_KEY)
