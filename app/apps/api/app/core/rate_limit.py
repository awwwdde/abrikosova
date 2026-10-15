"""Rate limiting на Redis.

Требование раздела 7 договора — «защита форм от спама и автоматических отправок».
Применяется к публичным мутирующим эндпоинтам: заказы, заявки, форма обратной
связи, добавление в корзину, а также к входу в админку (защита от подбора пароля).

Алгоритм — фиксированное окно с атомарными INCR+EXPIRE.
Ключ строится по проверенному IP и имени лимита.
"""

import logging
from ipaddress import ip_address, ip_network

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_PREFIX = "ratelimit:"


def client_ip(request: Request) -> str:
    """Идём справа налево только через явно доверенные узлы цепочки прокси."""
    peer = request.client.host if request.client else "unknown"
    trusted = [ip_network(value, strict=False) for value in get_settings().trusted_proxy_networks]

    def is_trusted(value: str) -> bool:
        return any(ip_address(value) in network for network in trusted)

    forwarded = request.headers.get("x-forwarded-for")
    try:
        if not forwarded or not is_trusted(peer):
            return peer
        chain = forwarded.split(",")
        if len(chain) > 32:
            return peer
        current = peer
        for item in reversed(chain):
            if not is_trusted(current):
                break
            current = str(ip_address(item.strip()))
        return current
    except ValueError:
        return peer


class RateLimiter:
    """Зависимость FastAPI: ограничивает число запросов с одного IP в окне."""

    def __init__(self, name: str, limit: int, window_seconds: int) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        key = f"{_PREFIX}{self.name}:{client_ip(request)}"
        redis = get_redis()

        # Атомарно: остановка процесса между INCR и EXPIRE не оставит вечный бан.
        current = await redis.eval(
            "local n = redis.call('INCR', KEYS[1]); "
            "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
            1,
            key,
            self.window_seconds,
        )

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
