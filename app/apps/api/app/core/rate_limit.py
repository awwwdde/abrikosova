"""Rate limiting на Redis.

Требование раздела 7 договора — «защита форм от спама и автоматических отправок».
Применяется к публичным мутирующим эндпоинтам: заказы, заявки, форма обратной
связи, добавление в корзину, а также к входу в админку (защита от подбора пароля).

Алгоритм — фиксированное окно на INCR+EXPIRE: для этой задачи его достаточно,
он дёшев и не требует Lua-скриптов. Ключ строится по IP и имени лимита.
"""

import logging

from fastapi import HTTPException, Request, status

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_PREFIX = "ratelimit:"


def client_ip(request: Request) -> str:
    """IP клиента с учётом реверс-прокси хостинга.

    Доверяем только первому значению X-Forwarded-For и только потому, что перед
    приложением на Timeweb Cloud App Platform всегда стоит их балансировщик.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """Зависимость FastAPI: ограничивает число запросов с одного IP в окне."""

    def __init__(self, name: str, limit: int, window_seconds: int) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        key = f"{_PREFIX}{self.name}:{client_ip(request)}"
        redis = get_redis()

        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, self.window_seconds)

        if current > self.limit:
            logger.warning(
                "Превышен лимит запросов: %s, ip=%s, count=%s",
                self.name,
                client_ip(request),
                current,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов, попробуйте позже",
                headers={"Retry-After": str(self.window_seconds)},
            )


# Лимиты подобраны так, чтобы не мешать живому человеку, но гасить автоматику.
limit_orders = RateLimiter("orders", limit=5, window_seconds=600)
limit_forms = RateLimiter("forms", limit=5, window_seconds=600)
limit_cart = RateLimiter("cart", limit=60, window_seconds=60)
limit_login = RateLimiter("login", limit=10, window_seconds=300)
