"""Авторизация админ-панели (02-api-contract.md, раздел Auth; усилено в задании 011a).

Слои защиты входа:
- Argon2id, одинаковый ответ для «нет e-mail» и «неверный пароль», проверка
  фиктивного хеша для несуществующего e-mail (время ответа ничего не выдаёт);
- лимит по IP (`limit_login`) и блокировка по аккаунту (services/login_guard.py);
- серверные сессии (services/sessions.py): список входов, «выйти везде»,
  отзыв при повторном использовании refresh-токена;
- refresh в httpOnly-cookie с SameSite=Strict и путём `/api/v1/auth`;
- мутирующие запросы — только с наших страниц (core/origin.py);
- журнал (audit_log) и Telegram о новом устройстве, блокировке и краже.
"""

import logging
import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.deps import CurrentAdmin
from app.core.origin import require_trusted_origin
from app.core.password_policy import (
    PasswordPolicyError,
    as_validation_error,
    validate_password,
)
from app.core.rate_limit import client_ip, limit_login
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    TokenError,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models import AdminSession, AdminUser
from app.schemas.auth import (
    AdminOut,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    SessionOut,
    TokenResponse,
)
from app.services import audit, login_guard, sessions, telegram

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    # Все изменения в /auth — только со страниц сайта (CSRF)
    dependencies=[Depends(require_trusted_origin)],
)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
RefreshCookie = Annotated[str | None, Cookie(alias="refresh_token")]

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    # Одинаковый текст для «нет такого e-mail» и «неверный пароль»:
    # иначе форма входа превращается в перечислитель существующих аккаунтов
    detail="Неверный e-mail или пароль",
)
SESSION_ENDED_TEXT = "Сессия завершена, войдите заново"
LOGIN_REQUIRED = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")[:300]


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        domain=settings.cookie_domain,
        # Cookie уходит только на эндпоинты /auth, а не на каждый запрос
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        domain=settings.cookie_domain,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.refresh_cookie_samesite,
    )


def _session_ended() -> JSONResponse:
    """401 со стиранием refresh-cookie: мёртвый токен не должен ездить дальше.
    Ответ, а не исключение, — у брошенного HTTPException cookie не удалить."""
    response = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": SESSION_ENDED_TEXT}
    )
    _clear_refresh_cookie(response)
    return response


def _locked_response(lock: login_guard.Lock) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": lock.message, "retry_after": lock.retry_after},
        headers={"Retry-After": str(lock.retry_after)},
    )


def _token_response(response: Response, admin: AdminUser, session: AdminSession) -> TokenResponse:
    access, refresh = sessions.issue_tokens(admin, session)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(
        access_token=access, expires_in=get_settings().access_token_ttl_minutes * 60
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(limit_login)],
    responses={429: {"description": "Вход временно заблокирован: `detail`, `retry_after`"}},
)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    background: BackgroundTasks,
):
    email = data.email.strip().lower()
    key = login_guard.email_key(email)

    # Во время блокировки пароль не проверяется вовсе — даже верный не пускает
    lock = await login_guard.current_lock(key)
    if lock is not None:
        return _locked_response(lock)

    admin = await session.scalar(select(AdminUser).where(AdminUser.email == email))
    # Пароль проверяем даже при отсутствии пользователя — с фиктивным хешем,
    # чтобы время ответа не выдавало, существует ли такой аккаунт
    password_ok = verify_password(
        data.password, admin.password_hash if admin else DUMMY_PASSWORD_HASH
    )
    ip = client_ip(request)

    if admin is None or not password_ok or not admin.is_active:
        lock = await login_guard.register_failure(key)
        await audit.record_auth(
            session,
            request,
            action="login_locked" if lock else "login_failed",
            admin=admin,
            email_hash=key,
        )
        await session.commit()
        logger.warning("Неудачная попытка входа: ip=%s", ip)
        if lock is not None:
            lines = [f"Адрес: {admin.email}" if admin else "Адрес: не зарегистрирован"]
            lines += [f"IP: {ip}", f"Вход закрыт на {lock.retry_after // 60} мин."]
            background.add_task(
                telegram.notify_admin_security, "блокировка входа после 5 неудач", lines
            )
            return _locked_response(lock)
        raise INVALID_CREDENTIALS

    await login_guard.reset(key)
    if needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(data.password)

    user_agent = _user_agent(request)
    new_device = await sessions.is_new_device(session, admin.id, ip, user_agent)
    admin_session = await sessions.create(session, admin, ip, user_agent)
    await audit.record_auth(
        session, request, action="login_success", admin=admin, session_id=str(admin_session.id)
    )
    await session.commit()

    if new_device:
        background.add_task(
            telegram.notify_admin_security,
            "вход с нового устройства",
            [admin.email, sessions.describe_device(user_agent), f"IP: {ip}"],
        )
    logger.info("Вход в админку: admin_id=%s ip=%s", admin.id, ip)
    return _token_response(response, admin, admin_session)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    session: SessionDep,
    background: BackgroundTasks,
    refresh_token: RefreshCookie = None,
):
    if not refresh_token:
        # Нет cookie — это не неверный пароль, а просто «не вошли» (011c): текст
        # про e-mail и пароль здесь сбивал бы с толку клиента API
        raise LOGIN_REQUIRED
    try:
        payload = decode_token(refresh_token, "refresh")
        sid = uuid.UUID(payload["sid"])
    except (TokenError, KeyError, ValueError):
        raise INVALID_CREDENTIALS from None

    # Обновления из двух вкладок сериализуются до проверки jti. Иначе вторая
    # ротация из старого снимка делает только что выданный токен недействительным.
    admin_session = await session.get(AdminSession, sid, with_for_update=True)
    if admin_session is None or not sessions.is_alive(admin_session):
        return _session_ended()
    admin = await session.get(AdminUser, admin_session.admin_id)
    if admin is None or not admin.is_active:
        return _session_ended()

    jti = payload["jti"]
    if jti != admin_session.current_jti:
        if sessions.is_benign_race(admin_session, jti):
            # Вторая вкладка пришла со старым токеном сразу после ротации:
            # выдаём токены на текущий jti, без новой ротации
            return _token_response(response, admin, admin_session)
        # Старый refresh-токен предъявлен повторно — его украли, или украли новый.
        # Отличить нельзя, поэтому отзываем сессию целиком
        await sessions.revoke(session, admin_session)
        if sessions.is_same_device_replay(
            admin_session, jti, client_ip(request), _user_agent(request)
        ):
            # Предыдущий токен с того же устройства (007a): вкладку закрыли посреди
            # обновления. Вход заново — но без тревоги и без «подозрения на кражу»
            await audit.record_auth(
                session,
                request,
                action="refresh_replay_same_device",
                admin=admin,
                session_id=str(admin_session.id),
            )
            await session.commit()
            logger.info("Повтор предыдущего refresh с того же устройства: %s", admin_session.id)
            return _session_ended()
        await audit.record_auth(
            session,
            request,
            action="refresh_reuse",
            admin=admin,
            session_id=str(admin_session.id),
        )
        await session.commit()
        logger.warning("Повторное использование refresh-токена: session=%s", admin_session.id)
        background.add_task(
            telegram.notify_admin_security,
            "подозрение на кражу сессии",
            [
                admin.email,
                "Старый токен входа предъявлен повторно — вход на этом устройстве закрыт",
                f"IP запроса: {client_ip(request)}",
            ],
        )
        return _session_ended()

    sessions.rotate(admin_session)
    await session.commit()
    return _token_response(response, admin, admin_session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    session: SessionDep,
    refresh_token: RefreshCookie = None,
) -> None:
    """Выход: сессия отзывается на сервере, а не только удаляется cookie у клиента."""
    if refresh_token:
        try:
            payload = decode_token(refresh_token, "refresh")
            admin_session = await session.get(AdminSession, uuid.UUID(payload["sid"]))
        except (TokenError, KeyError, ValueError):
            admin_session = None
        if admin_session is not None and admin_session.revoked_at is None:
            await sessions.revoke(session, admin_session)
            admin = await session.get(AdminUser, admin_session.admin_id)
            await audit.record_auth(
                session, request, action="logout", admin=admin, session_id=str(admin_session.id)
            )
            await session.commit()
    _clear_refresh_cookie(response)


@router.get("/me", response_model=AdminOut)
async def me(admin: CurrentAdmin) -> AdminUser:
    return admin


@router.patch("/me", response_model=AdminOut)
async def update_me(
    data: ProfileUpdate, admin: CurrentAdmin, request: Request, session: SessionDep
) -> AdminUser:
    """Сотрудник меняет своё имя сам (011c). Роль и активность — только владелец
    через «Сотрудников», поэтому в схеме только имя."""
    user = await session.get(AdminUser, admin.id)
    if user is None:  # отключён между проверкой токена и запросом
        raise LOGIN_REQUIRED
    old = user.name
    user.name = data.name
    if old != data.name:
        await audit.record(
            session,
            request,
            user,
            action="update_profile",
            entity="admin_user",
            entity_id=user.id,
            details={"changes": {"name": [old, data.name]}},
        )
    await session.commit()
    return user


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    # Тот же лимит, что у входа: иначе здесь можно было бы подбирать текущий пароль
    dependencies=[Depends(limit_login)],
)
async def change_password(
    data: PasswordChange,
    admin: CurrentAdmin,
    request: Request,
    session: SessionDep,
) -> None:
    """Смена своего пароля. Остальные сессии отзываются, текущая остаётся."""
    if not verify_password(data.current_password, admin.password_hash):
        raise RequestValidationError(
            [
                {
                    "loc": ("body", "current_password"),
                    "msg": "Текущий пароль указан неверно",
                    "type": "value_error",
                }
            ]
        )
    try:
        validate_password(data.new_password, email=admin.email)
    except PasswordPolicyError as error:
        raise as_validation_error("new_password", error) from None

    admin.password_hash = hash_password(data.new_password)
    current = request.state.session_id
    revoked = await sessions.revoke_all(session, admin.id, except_id=current)
    await audit.record_auth(
        session,
        request,
        action="password_changed",
        admin=admin,
        session_id=str(current),
        details={"sessions_revoked": revoked},
    )
    await session.commit()


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(admin: CurrentAdmin, request: Request, session: SessionDep):
    """Живые входы текущего сотрудника: устройство, IP, время, «текущий»."""
    rows = (
        await session.scalars(
            select(AdminSession)
            .where(AdminSession.admin_id == admin.id, AdminSession.revoked_at.is_(None))
            .order_by(AdminSession.last_used_at.desc())
        )
    ).all()
    current = request.state.session_id
    return [
        SessionOut(
            id=str(row.id),
            device=sessions.describe_device(row.user_agent),
            ip=row.ip,
            created_at=row.created_at,
            last_used_at=row.last_used_at,
            current=row.id == current,
        )
        for row in rows
        if sessions.is_alive(row)
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID, admin: CurrentAdmin, request: Request, session: SessionDep
) -> None:
    row = await session.get(AdminSession, session_id)
    # Чужая сессия неотличима от несуществующей
    if row is None or row.admin_id != admin.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")
    await sessions.revoke(session, row)
    await audit.record_auth(
        session, request, action="session_revoked", admin=admin, session_id=str(row.id)
    )
    await session.commit()


@router.post("/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_other_sessions(admin: CurrentAdmin, request: Request, session: SessionDep) -> None:
    current = request.state.session_id
    revoked = await sessions.revoke_all(session, admin.id, except_id=current)
    await audit.record_auth(
        session,
        request,
        action="sessions_revoked_others",
        admin=admin,
        session_id=str(current),
        details={"sessions_revoked": revoked},
    )
    await session.commit()
