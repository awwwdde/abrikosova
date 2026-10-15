"""Зависимости авторизации админ-панели.

Проверка роли выполняется здесь, на бэкенде, на каждом защищённом эндпоинте —
скрытия пунктов меню в UI недостаточно (05-nonfunctional-and-acceptance.md,
«Разграничение прав в админке»).
"""

import logging
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import TokenError, decode_token
from app.models import AdminRole, AdminUser
from app.services import sessions

logger = logging.getLogger(__name__)

# auto_error=False: свой единообразный 401 вместо стандартного текста Starlette
_bearer = HTTPBearer(auto_error=False)

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Требуется авторизация",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_admin(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> AdminUser:
    if credentials is None or not credentials.credentials:
        raise UNAUTHORIZED

    try:
        payload = decode_token(credentials.credentials, "access")
    except TokenError:
        raise UNAUTHORIZED from None

    try:
        admin_id = int(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (KeyError, TypeError, ValueError):
        # Токен без sid выписан до серверных сессий (задание 011a) — не принимаем
        raise UNAUTHORIZED from None

    # Сессия не отозвана и не истекла: «выйти везде», смена пароля и деактивация
    # действуют сразу, а не через 15 минут жизни access-токена
    if not await sessions.check_alive(session, str(session_id), admin_id):
        raise UNAUTHORIZED

    admin = await session.get(AdminUser, admin_id)
    # Проверяем пользователя в БД на каждом запросе: иначе деактивированный
    # сотрудник продолжал бы работать до истечения своего access-токена
    if admin is None or not admin.is_active:
        raise UNAUTHORIZED

    request.state.admin = admin
    request.state.session_id = session_id
    return admin


CurrentAdmin = Annotated[AdminUser, Depends(get_current_admin)]


def require_role(*roles: AdminRole):
    """Ограничивает доступ к эндпоинту перечисленными ролями."""

    async def dependency(admin: CurrentAdmin) -> AdminUser:
        if admin.role not in roles:
            logger.warning(
                "Отказано в доступе: admin_id=%s role=%s, требуется %s",
                admin.id,
                admin.role.value,
                [r.value for r in roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для этого раздела",
            )
        return admin

    return dependency


# Разделы «Пользователи» и «Резервные копии» — только владелец (04-admin-panel.md)
OwnerOnly = Annotated[AdminUser, Depends(require_role(AdminRole.OWNER))]
