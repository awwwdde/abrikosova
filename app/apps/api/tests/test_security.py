"""Тесты защит из скилла implementing-jwt-signing-and-verification.

Проверяем не «работает ли вход», а что именно не работает: подделанные,
чужие и не тем ключом подписанные токены обязаны отвергаться.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def _payload(**overrides) -> dict:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": "1",
        "role": "owner",
        "typ": "access",
        "jti": "test-jti",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=5),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    payload.update(overrides)
    return payload


def test_valid_access_token_decodes() -> None:
    token, jti = create_access_token("42", "manager")
    payload = decode_token(token, "access")

    assert payload["sub"] == "42"
    assert payload["role"] == "manager"
    assert payload["jti"] == jti


def test_none_algorithm_is_rejected() -> None:
    """alg=none: подпись убрана, токен собран вручную — должен быть отвергнут."""
    token = jwt.encode(_payload(), key="", algorithm="none")

    with pytest.raises(TokenError):
        decode_token(token, "access")


def test_token_signed_with_other_key_is_rejected() -> None:
    token = jwt.encode(_payload(), "совсем-другой-секрет", algorithm="HS256")

    with pytest.raises(TokenError):
        decode_token(token, "access")


def test_expired_token_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        _payload(
            iat=now - timedelta(hours=2), nbf=now - timedelta(hours=2), exp=now - timedelta(hours=1)
        ),
        get_settings().jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(TokenError):
        decode_token(token, "access")


def test_refresh_token_cannot_be_used_as_access() -> None:
    """Разделение typ: refresh-токен живёт 30 дней и не должен открывать API."""
    refresh, _ = create_refresh_token("1", "owner")

    with pytest.raises(TokenError):
        decode_token(refresh, "access")


def test_token_for_other_audience_is_rejected() -> None:
    token = jwt.encode(
        _payload(aud="другое-приложение"), get_settings().jwt_secret, algorithm="HS256"
    )

    with pytest.raises(TokenError):
        decode_token(token, "access")


def test_tampered_payload_is_rejected() -> None:
    """Подмена роли в теле токена без пересчёта подписи не проходит."""
    token, _ = create_access_token("1", "manager")
    header, payload, signature = token.split(".")
    forged = jwt.encode(_payload(role="owner"), "no-key", algorithm="HS256").split(".")[1]

    with pytest.raises(TokenError):
        decode_token(f"{header}.{forged}.{signature}", "access")


def test_password_hash_is_argon2_and_verifies() -> None:
    hashed = hash_password("правильный-пароль-12345")

    assert hashed.startswith("$argon2id$")
    assert "правильный-пароль-12345" not in hashed
    assert verify_password("правильный-пароль-12345", hashed)
    assert not verify_password("другой-пароль", hashed)


def test_same_password_produces_different_hashes() -> None:
    """Соль у каждого хеша своя — одинаковые пароли не видны по совпадению хешей."""
    assert hash_password("одинаковый-пароль") != hash_password("одинаковый-пароль")
