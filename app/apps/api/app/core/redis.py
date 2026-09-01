"""Подключение к Redis.

Redis используется только как кэш и для rate limiting — очередью фоновых задач
он в этом проекте не служит (решение зафиксировано в 00-overview.md).
"""

from redis.asyncio import Redis

from app.core.config import get_settings

_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
