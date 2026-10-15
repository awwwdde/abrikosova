"""Пароли и JWT для админ-панели.

Пароли — Argon2id: пароль в открытом виде не хранится и не логируется нигде,
включая seed-скрипт.

JWT — HS256 со строгим allowlist алгоритмов. Ключевые защиты (по чек-листу
скилла implementing-jwt-signing-and-verification):

* алгоритм проверяется по allowlist, `alg=none` отвергается — иначе токен можно
  подделать, просто убрав подпись;
* обязательные клеймы `exp`, `iat`, `nbf`, `iss`, `aud`, `sub`, `jti`, `typ`;
* `typ` разделяет access и refresh: refresh-токен нельзя предъявить вместо
  access и наоборот;
* access живёт 15 минут, refresh — 30 дней с ротацией `jti`;
* оба токена несут `sid` — идентификатор серверной сессии (таблица
  admin_sessions, app/services/sessions.py): по ней проверяется, что вход
  не отозван, и ловится повторное использование старого refresh-токена.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jwt.exceptions import InvalidTokenError

from app.core.config import get_settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]

# Единственный разрешённый алгоритм. Список закрытый: и при подписи, и при проверке
# передаётся именно он, поэтому подмена alg (в том числе на none) не проходит.
ALLOWED_ALGORITHMS = ["HS256"]


class TokenError(Exception):
    """Токен не прошёл проверку. Причина намеренно не детализируется наружу."""


def hash_password(password: str) -> str:
    return _hasher.hash(password)


# Фиктивный хеш для входа с несуществующим e-mail: пароль проверяется и тогда,
# чтобы время ответа не выдавало, есть ли аккаунт. Считается один раз при
# импорте модуля — хешировать на каждый запрос дорого и незачем.
DUMMY_PASSWORD_HASH = _hasher.hash("dummy-password-for-timing")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def needs_rehash(password_hash: str) -> bool:
    """True, если хеш сделан старыми параметрами и его стоит пересчитать при входе."""
    return _hasher.check_needs_rehash(password_hash)


def _create_token(
    subject: str,
    role: str,
    token_type: TokenType,
    ttl: timedelta,
    sid: str | None = None,
    jti: str | None = None,
) -> tuple[str, str]:
    settings = get_settings()
    now = datetime.now(UTC)
    jti = jti or str(uuid.uuid4())

    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "typ": token_type,
        "jti": jti,
        "iat": now,
        "nbf": now,
        "exp": now + ttl,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    if sid is not None:
        payload["sid"] = sid
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALLOWED_ALGORITHMS[0])
    return token, jti


def create_access_token(subject: str, role: str, sid: str | None = None) -> tuple[str, str]:
    settings = get_settings()
    return _create_token(
        subject, role, "access", timedelta(minutes=settings.access_token_ttl_minutes), sid=sid
    )


def create_refresh_token(
    subject: str, role: str, sid: str | None = None, jti: str | None = None
) -> tuple[str, str]:
    """Refresh с заданным `jti`: он должен совпасть с `current_jti` сессии."""
    settings = get_settings()
    return _create_token(
        subject,
        role,
        "refresh",
        timedelta(days=settings.refresh_token_ttl_days),
        sid=sid,
        jti=jti,
    )


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Проверяет подпись, срок, издателя, аудиторию и тип токена.

    Любая неудача — одинаковый TokenError без подробностей: детали разбора
    подсказывают атакующему, какая именно проверка не прошла.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=ALLOWED_ALGORITHMS,
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={
                "require": ["exp", "iat", "nbf", "sub", "iss", "aud", "jti"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iss": True,
                "verify_aud": True,
            },
        )
    except InvalidTokenError as exc:
        raise TokenError("Токен недействителен") from exc

    if payload.get("typ") != expected_type:
        raise TokenError("Токен недействителен")

    return payload
