"""Отзыв refresh-токенов.

Без отзыва logout не имеет силы: украденный refresh-токен продолжал бы работать
до истечения срока. Храним denylist по `jti` в Redis с TTL до конца жизни токена —
запись сама исчезает, когда токен и так протух.

Ротация: при каждом /auth/refresh старый jti попадает в denylist, а клиент
получает новую пару. Повторное предъявление уже использованного refresh-токена
не сработает — это же признак его компрометации.
"""

from datetime import UTC, datetime

from app.core.redis import get_redis

_PREFIX = "revoked_refresh:"


async def revoke(jti: str, expires_at: datetime) -> None:
    ttl = int((expires_at - datetime.now(UTC)).total_seconds())
    if ttl <= 0:
        return
    await get_redis().set(f"{_PREFIX}{jti}", "1", ex=ttl)


async def is_revoked(jti: str) -> bool:
    return await get_redis().exists(f"{_PREFIX}{jti}") == 1
