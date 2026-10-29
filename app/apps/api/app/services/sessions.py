"""Серверные сессии админки (задание 011a).

Вход создаёт строку admin_sessions. Refresh-токен несёт `sid` и `jti`; при
обновлении `jti` должен совпасть с `current_jti`, после чего он ротируется.
Предъявление старого refresh-токена — признак кражи: вся сессия отзывается.
Access-токен тоже несёт `sid`, и каждый запрос проверяет, что сессия жива.

Проверка идёт в БД на каждом запросе: положительный кэш мог заполниться между
отзывом и коммитом и снова разрешить уже закрытую сессию.

Denylist отозванных `jti` в Redis (core/token_store.py) убран: его работу
теперь делает `current_jti` — старый refresh-токен не совпадает с ним и так.
"""

import re
import uuid
from datetime import datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.redis import get_redis
from app.core.security import create_access_token, create_refresh_token
from app.models import AdminSession, AdminUser

# Две вкладки обновляют токен почти одновременно: старый jti в этом окне — не кража
ROTATION_GRACE = timedelta(seconds=30)
_ALIVE_PREFIX = "admin_session_alive:"
# Сколько хранить закончившиеся сессии: для «нового устройства» и разбора инцидентов
HISTORY_DAYS = 30


def idle_limit() -> timedelta:
    return timedelta(days=get_settings().admin_session_idle_days)


def absolute_limit() -> timedelta:
    return timedelta(days=get_settings().admin_session_absolute_days)


def is_alive(session: AdminSession, now: datetime | None = None) -> bool:
    now = now or clock.utc_now()
    return (
        session.revoked_at is None
        and now < session.expires_at
        and now < session.last_used_at + idle_limit()
    )


async def create(db: AsyncSession, admin: AdminUser, ip: str, user_agent: str) -> AdminSession:
    now = clock.utc_now()
    session = AdminSession(
        id=uuid.uuid4(),
        admin_id=admin.id,
        created_at=now,
        last_used_at=now,
        expires_at=now + absolute_limit(),
        ip=ip,
        user_agent=user_agent[:300] or None,
        current_jti=str(uuid.uuid4()),
    )
    db.add(session)
    await db.flush()
    return session


def issue_tokens(admin: AdminUser, session: AdminSession) -> tuple[str, str]:
    """Access и refresh для сессии; refresh — на её текущий jti."""
    sid = str(session.id)
    access, _ = create_access_token(str(admin.id), admin.role.value, sid=sid)
    refresh, _ = create_refresh_token(
        str(admin.id), admin.role.value, sid=sid, jti=session.current_jti
    )
    return access, refresh


def rotate(session: AdminSession) -> None:
    now = clock.utc_now()
    session.previous_jti = session.current_jti
    session.current_jti = str(uuid.uuid4())
    session.rotated_at = now
    session.last_used_at = now


def is_benign_race(session: AdminSession, jti: str) -> bool:
    """Старый jti сразу после ротации — вторая вкладка, а не украденный токен."""
    return (
        session.previous_jti == jti
        and session.rotated_at is not None
        and clock.utc_now() - session.rotated_at < ROTATION_GRACE
    )


def is_same_device_replay(session: AdminSession, jti: str, ip: str, user_agent: str) -> bool:
    """Повтор именно предыдущего токена позже окна, с тех же IP и User-Agent, что
    записаны у сессии (007a, решение 12.10). Так бывает, когда вкладку закрыли,
    пока шёл refresh: сервер токен повернул, а новый cookie до браузера не дошёл.
    Сессию всё равно закрываем — но это не «кража», и тревога не нужна."""
    return (
        session.previous_jti == jti
        and session.ip == ip
        and (session.user_agent or "") == user_agent[:300]
    )


async def _forget(*session_ids: uuid.UUID) -> None:
    if session_ids:
        await get_redis().delete(*(f"{_ALIVE_PREFIX}{sid}" for sid in session_ids))


async def lock_admin_user(db: AsyncSession, admin_id: int) -> AdminUser | None:
    """Serialize credential changes and successful login session creation per user."""
    return await db.scalar(
        select(AdminUser)
        .where(AdminUser.id == admin_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


async def revoke(db: AsyncSession, session: AdminSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = clock.utc_now()
    await _forget(session.id)


async def revoke_all(db: AsyncSession, admin_id: int, *, except_id: uuid.UUID | None = None) -> int:
    """Отзывает все живые сессии сотрудника (кроме `except_id`). Возвращает их число."""
    query = select(AdminSession.id).where(
        AdminSession.admin_id == admin_id, AdminSession.revoked_at.is_(None)
    )
    if except_id is not None:
        query = query.where(AdminSession.id != except_id)
    ids = list((await db.scalars(query)).all())
    if ids:
        await db.execute(
            update(AdminSession).where(AdminSession.id.in_(ids)).values(revoked_at=clock.utc_now())
        )
        await _forget(*ids)
    return len(ids)


async def check_alive(db: AsyncSession, sid: str, admin_id: int) -> bool:
    """После коммита отзыва следующий запрос обязан увидеть закрытую сессию."""
    try:
        session_id = uuid.UUID(sid)
    except ValueError:
        return False
    session = await db.get(AdminSession, session_id, populate_existing=True)
    if session is None or session.admin_id != admin_id or not is_alive(session):
        return False
    return True


async def is_new_device(db: AsyncSession, admin_id: int, ip: str, user_agent: str) -> bool:
    """Пары «IP + браузер» ещё не было среди сессий сотрудника (за хранимую историю)."""
    exists = await db.scalar(
        select(AdminSession.id)
        .where(
            AdminSession.admin_id == admin_id,
            AdminSession.ip == ip,
            AdminSession.user_agent == (user_agent[:300] or None),
        )
        .limit(1)
    )
    return exists is None


async def purge_ended(db: AsyncSession) -> int:
    """Ночная очистка: удаляет сессии, закончившиеся больше HISTORY_DAYS назад."""
    border = clock.utc_now() - timedelta(days=HISTORY_DAYS)
    rows = (
        await db.scalars(
            select(AdminSession).where(
                or_(
                    AdminSession.revoked_at < border,
                    AdminSession.expires_at < border,
                    AdminSession.last_used_at < border - idle_limit(),
                )
            )
        )
    ).all()
    for row in rows:
        await db.delete(row)
    await db.commit()
    return len(rows)


_BROWSERS = (
    ("Edg/", "Edge"),
    ("YaBrowser/", "Яндекс Браузер"),
    ("OPR/", "Opera"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
)
_SYSTEMS = (
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Android", "Android"),
    ("Windows", "Windows"),
    ("Mac OS X", "macOS"),
    ("Linux", "Linux"),
)


def describe_device(user_agent: str | None) -> str:
    """«Chrome на Windows» — для списка входов и уведомлений; не для безопасности."""
    if not user_agent:
        return "Неизвестное устройство"
    browser = next((name for mark, name in _BROWSERS if mark in user_agent), None)
    system = next((name for mark, name in _SYSTEMS if mark in user_agent), None)
    if browser and system:
        return f"{browser} на {system}"
    return browser or system or re.sub(r"\s+", " ", user_agent)[:40]
