"""Блокировка входа по аккаунту (задание 011a).

Лимит по IP (`limit_login` в core/rate_limit.py) не спасает от подбора с многих
адресов, поэтому неудачи считаются ещё и по e-mail:

- 5 неудач подряд → блокировка на 15 минут, следующая серия → 30, дальше → 60;
- ступени сбрасываются после успешного входа или суток без неудач (у ключей
  счётчика и ступени TTL 24 часа, продлевается каждой неудачей);
- во время блокировки пароль не проверяется вовсе — даже верный не пускает.

Счётчик ведётся для любого e-mail, существует аккаунт или нет: иначе
блокировка выдавала бы, какие адреса зарегистрированы. В ключе Redis — хеш
нормализованного e-mail, а не сам адрес: в кэше не должно быть списка
адресов, по которым подбирали пароль.
"""

import hashlib
from dataclasses import dataclass

from app.core.redis import get_redis

MAX_FAILURES = 5
# Длительность блокировки по номеру серии; дальше последней — она же
LOCK_MINUTES = (15, 30, 60)
# Сколько «помнить» неудачи и ступень блокировки
MEMORY_SECONDS = 24 * 3600

_FAIL = "login:fail:"
_STAGE = "login:stage:"
_LOCK = "login:lock:"


def email_key(email: str) -> str:
    """Хеш нормализованного e-mail — идентификатор счётчика и запись в журнале."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


@dataclass(frozen=True)
class Lock:
    """Блокировка: сколько секунд осталось и это только что начавшаяся серия."""

    retry_after: int
    started: bool = False

    @property
    def message(self) -> str:
        minutes = max(1, -(-self.retry_after // 60))
        return f"Слишком много попыток. Попробуйте через {minutes} {_minutes_word(minutes)}"


def _minutes_word(n: int) -> str:
    if 11 <= n % 100 <= 14:
        return "минут"
    return {1: "минуту", 2: "минуты", 3: "минуты", 4: "минуты"}.get(n % 10, "минут")


async def current_lock(key: str) -> Lock | None:
    ttl = await get_redis().ttl(f"{_LOCK}{key}")
    return Lock(retry_after=ttl) if ttl and ttl > 0 else None


async def register_failure(key: str) -> Lock | None:
    """Учитывает неудачу. Возвращает блокировку, если эта неудача её включила."""
    redis = get_redis()
    failures = await redis.incr(f"{_FAIL}{key}")
    await redis.expire(f"{_FAIL}{key}", MEMORY_SECONDS)
    if failures < MAX_FAILURES:
        return None

    stage = await redis.incr(f"{_STAGE}{key}")
    await redis.expire(f"{_STAGE}{key}", MEMORY_SECONDS)
    seconds = LOCK_MINUTES[min(stage, len(LOCK_MINUTES)) - 1] * 60
    await redis.set(f"{_LOCK}{key}", stage, ex=seconds)
    # Новая серия начинается с нуля после окончания блокировки
    await redis.delete(f"{_FAIL}{key}")
    return Lock(retry_after=seconds, started=True)


async def reset(key: str) -> None:
    """Успешный вход: счётчик и ступени сбрасываются."""
    await get_redis().delete(f"{_FAIL}{key}", f"{_STAGE}{key}", f"{_LOCK}{key}")
