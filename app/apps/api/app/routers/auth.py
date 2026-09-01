"""Авторизация админ-панели (02-api-contract.md, раздел Auth)."""

import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import token_store
from app.core.config import get_settings
from app.core.db import get_session
from app.core.deps import CurrentAdmin
from app.core.rate_limit import client_ip, limit_login
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models import AdminUser
from app.schemas.auth import AdminOut, LoginRequest, TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    # Одинаковый текст для «нет такого e-mail» и «неверный пароль»:
    # иначе форма входа превращается в перечислитель существующих аккаунтов
    detail="Неверный e-mail или пароль",
)


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        # Cookie уходит только на эндпоинты обновления/выхода, а не на каждый запрос
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        domain=settings.cookie_domain,
        path="/api/v1/auth",
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(limit_login)])
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
) -> TokenResponse:
    admin = await session.scalar(select(AdminUser).where(AdminUser.email == data.email.lower()))

    # Пароль проверяем даже при отсутствии пользователя — с фиктивным хешем,
    # чтобы время ответа не выдавало, существует ли такой аккаунт
    password_hash = admin.password_hash if admin else hash_password("dummy-password")
    password_ok = verify_password(data.password, password_hash)

    if admin is None or not password_ok or not admin.is_active:
        logger.warning("Неудачная попытка входа: ip=%s", client_ip(request))
        raise INVALID_CREDENTIALS

    if needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(data.password)

    access, _ = create_access_token(str(admin.id), admin.role.value)
    refresh, _ = create_refresh_token(str(admin.id), admin.role.value)
    await session.commit()

    _set_refresh_cookie(response, refresh)
    logger.info("Вход в админку: admin_id=%s ip=%s", admin.id, client_ip(request))
    return TokenResponse(
        access_token=access, expires_in=get_settings().access_token_ttl_minutes * 60
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    response: Response,
    session: SessionDep,
    refresh_token: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    if not refresh_token:
        raise INVALID_CREDENTIALS

    try:
        payload = decode_token(refresh_token, "refresh")
    except TokenError:
        raise INVALID_CREDENTIALS from None

    jti = payload["jti"]
    # Повторное использование уже обменянного токена — признак его кражи
    if await token_store.is_revoked(jti):
        logger.warning("Попытка повторно использовать отозванный refresh-токен jti=%s", jti)
        raise INVALID_CREDENTIALS

    admin = await session.get(AdminUser, int(payload["sub"]))
    if admin is None or not admin.is_active:
        raise INVALID_CREDENTIALS

    # Ротация: старый токен отзываем, выдаём новую пару
    await token_store.revoke(jti, datetime.fromtimestamp(payload["exp"], tz=UTC))

    access, _ = create_access_token(str(admin.id), admin.role.value)
    new_refresh, _ = create_refresh_token(str(admin.id), admin.role.value)
    _set_refresh_cookie(response, new_refresh)

    return TokenResponse(
        access_token=access, expires_in=get_settings().access_token_ttl_minutes * 60
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> None:
    """Выход: refresh-токен отзывается на сервере, а не только удаляется у клиента."""
    if refresh_token:
        try:
            payload = decode_token(refresh_token, "refresh")
        except TokenError:
            payload = None
        if payload:
            await token_store.revoke(payload["jti"], datetime.fromtimestamp(payload["exp"], tz=UTC))

    _clear_refresh_cookie(response)


@router.get("/me", response_model=AdminOut)
async def me(admin: CurrentAdmin) -> AdminUser:
    return admin
