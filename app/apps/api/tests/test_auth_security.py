"""Защита входа в админку (задание 011a): блокировка по аккаунту, серверные
сессии, политика паролей, Origin, cookie, журнал и фото для страницы входа."""

import io
import itertools
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import timedelta

import httpx
import pytest
from httpx import ASGITransport
from PIL import Image, ImageDraw
from sqlalchemy import delete, select

from app.core import clock
from app.core.db import SessionLocal
from app.core.password_policy import PasswordPolicyError, validate_password
from app.core.redis import get_redis
from app.core.security import hash_password
from app.main import app
from app.models import (
    AdminRole,
    AdminSession,
    AdminUser,
    AuditLogEntry,
    GalleryItem,
    Product,
    ProductImage,
)
from app.services import login_guard, storage, telegram

ORIGIN = "http://localhost:3000"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
PASSWORD = "Крем-брюле с малиной 2026"
_ips = itertools.count(1)


def _headers(**extra: str) -> dict[str, str]:
    """Браузерные заголовки: наш Origin и каждый раз новый IP — как подбор с ботнета,
    чтобы проверять блокировку по аккаунту, а не лимит по IP."""
    return {
        "Origin": ORIGIN,
        "X-Forwarded-For": f"10.0.{next(_ips) % 250}.{next(_ips) % 250}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
        **extra,
    }


@dataclass
class Staff:
    id: int
    email: str
    password: str


@pytest.fixture
async def staff() -> AsyncIterator[Staff]:
    """Сотрудник с известным паролем; после теста удаляется вместе с сессиями."""
    email = f"staff-{uuid.uuid4().hex[:8]}@example.com"
    async with SessionLocal() as session:
        admin = AdminUser(
            email=email,
            name="Сотрудник Тестовый",
            password_hash=hash_password(PASSWORD),
            role=AdminRole.MANAGER,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        admin_id = admin.id
    yield Staff(admin_id, email, PASSWORD)
    async with SessionLocal() as session:
        await session.execute(delete(AuditLogEntry).where(AuditLogEntry.actor_id == admin_id))
        await session.execute(delete(AdminUser).where(AdminUser.id == admin_id))
        await session.commit()


@pytest.fixture
async def browser() -> AsyncIterator[httpx.AsyncClient]:
    """Клиент с cookie-jar, как вкладка браузера."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@pytest.fixture(autouse=True)
def _trusted_test_proxy(monkeypatch):
    # Здесь моделируется известный прокси, а не доверие произвольному клиенту.
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "trusted_proxy_networks", ["127.0.0.1/32"])


@pytest.fixture(autouse=True)
def _no_telegram(monkeypatch) -> list[tuple[str, list[str]]]:
    """Telegram в тестах не отправляется — уведомления собираются в список."""
    sent: list[tuple[str, list[str]]] = []
    monkeypatch.setattr(
        telegram, "notify_admin_security", lambda event, lines: sent.append((event, lines))
    )
    return sent


async def _login(client: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await client.post(LOGIN, json={"email": email, "password": password}, headers=_headers())


async def _fail(client: httpx.AsyncClient, email: str, times: int) -> httpx.Response:
    response = None
    for _ in range(times):
        response = await _login(client, email, "неверный-пароль-123")
    assert response is not None
    return response


async def _expire_lock(email: str) -> None:
    """Имитирует окончание блокировки: ключ блокировки исчезает, ступень остаётся."""
    await get_redis().delete(f"login:lock:{login_guard.email_key(email)}")


# --- 1.1. Блокировка по аккаунту ---


async def test_five_failures_lock_the_account_with_growing_steps(browser, staff) -> None:
    for expected_minutes in (15, 30, 60, 60):
        for _ in range(4):
            assert (await _login(browser, staff.email, "неверный-пароль-123")).status_code == 401
        locked = await _login(browser, staff.email, "неверный-пароль-123")
        assert locked.status_code == 429
        body = locked.json()
        assert body["retry_after"] == expected_minutes * 60
        assert locked.headers["Retry-After"] == str(expected_minutes * 60)
        assert body["detail"].startswith("Слишком много попыток. Попробуйте через")
        await _expire_lock(staff.email)


async def test_unknown_email_is_locked_exactly_the_same_way(browser, staff) -> None:
    """Блокировка не выдаёт, какие адреса зарегистрированы."""
    ghost = f"ghost-{uuid.uuid4().hex[:8]}@example.com"
    known = await _fail(browser, staff.email, 5)
    unknown = await _fail(browser, ghost, 5)
    assert known.status_code == unknown.status_code == 429
    assert known.json() == unknown.json()
    # Во время блокировки ответы тоже одинаковы; секунды — с допуском: TTL тикает
    again_unknown = (await _login(browser, ghost, "что-угодно")).json()
    again_known = (await _login(browser, staff.email, "что-угодно")).json()
    assert again_unknown["detail"] == again_known["detail"]
    assert abs(again_unknown["retry_after"] - again_known["retry_after"]) <= 2


async def test_correct_password_does_not_open_a_locked_account(browser, staff) -> None:
    await _fail(browser, staff.email, 5)
    response = await _login(browser, staff.email, staff.password)
    assert response.status_code == 429
    assert "access_token" not in response.text


async def test_success_resets_the_failure_counter(browser, staff) -> None:
    await _fail(browser, staff.email, 4)
    assert (await _login(browser, staff.email, staff.password)).status_code == 200
    # Счётчик с нуля: ещё 4 неудачи не блокируют
    assert (await _fail(browser, staff.email, 4)).status_code == 401


async def test_email_is_normalized_for_the_counter(browser, staff) -> None:
    await _fail(browser, staff.email.upper(), 5)
    assert (await _login(browser, f"  {staff.email}  ".strip(), staff.password)).status_code == 429


# --- 1.2. Сессии ---


async def test_login_creates_session_and_refresh_rotates_it(browser, staff) -> None:
    response = await _login(browser, staff.email, staff.password)
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api/v1/auth" in cookie

    async with SessionLocal() as session:
        row = await session.scalar(select(AdminSession).where(AdminSession.admin_id == staff.id))
        assert row is not None and row.revoked_at is None
        first_jti = row.current_jti

    refreshed = await browser.post(REFRESH, headers=_headers())
    assert refreshed.status_code == 200
    async with SessionLocal() as session:
        row = await session.get(AdminSession, row.id)
        assert row.current_jti != first_jti and row.previous_jti == first_jti


async def test_reusing_an_old_refresh_token_revokes_the_session(
    browser, staff, _no_telegram, monkeypatch
) -> None:
    await _login(browser, staff.email, staff.password)
    stolen = browser.cookies.get("refresh_token")
    assert (await browser.post(REFRESH, headers=_headers())).status_code == 200
    # Окно гонки вкладок прошло
    now = clock.utc_now()
    monkeypatch.setattr(clock, "utc_now", lambda: now + timedelta(minutes=1))

    reused = await browser.post(REFRESH, headers=_headers(), cookies={"refresh_token": stolen})
    assert reused.status_code == 401

    async with SessionLocal() as session:
        row = await session.scalar(select(AdminSession).where(AdminSession.admin_id == staff.id))
        assert row.revoked_at is not None
        logged = await session.scalar(
            select(AuditLogEntry).where(
                AuditLogEntry.actor_id == staff.id, AuditLogEntry.action == "refresh_reuse"
            )
        )
        assert logged is not None
    assert any(event == "подозрение на кражу сессии" for event, _ in _no_telegram)
    # И законный владелец новой пары тоже выкинут: сессия отозвана целиком
    browser.cookies.clear()
    assert (await browser.post(REFRESH, headers=_headers())).status_code == 401


# 007a: повтор предыдущего токена с того же устройства — вход заново, но не «кража»
DEVICE = {"X-Forwarded-For": "10.9.9.9"}


async def _replay(browser, staff, monkeypatch, *, rotations: int, replay_headers: dict):
    """Вход и `rotations` обновлений с одного устройства; потом через 35 с — старый
    токен (до первого обновления) с заголовками `replay_headers`."""
    login = await browser.post(
        LOGIN, json={"email": staff.email, "password": staff.password}, headers=_headers(**DEVICE)
    )
    assert login.status_code == 200
    old = browser.cookies.get("refresh_token")
    for _ in range(rotations):
        assert (await browser.post(REFRESH, headers=_headers(**DEVICE))).status_code == 200
    now = clock.utc_now()
    monkeypatch.setattr(clock, "utc_now", lambda: now + timedelta(seconds=35))
    response = await browser.post(
        REFRESH, headers=_headers(**replay_headers), cookies={"refresh_token": old}
    )
    async with SessionLocal() as session:
        row = await session.scalar(select(AdminSession).where(AdminSession.admin_id == staff.id))
        actions = set(
            (
                await session.scalars(
                    select(AuditLogEntry.action).where(AuditLogEntry.actor_id == staff.id)
                )
            ).all()
        )
    return response, row, actions


async def test_previous_token_from_same_device_closes_session_without_alarm(
    browser, staff, _no_telegram, monkeypatch
) -> None:
    response, row, actions = await _replay(
        browser, staff, monkeypatch, rotations=1, replay_headers=DEVICE
    )
    assert response.status_code == 401
    assert row.revoked_at is not None  # вход заново
    assert "refresh_replay_same_device" in actions
    assert "refresh_reuse" not in actions
    # Без тревоги о краже (уведомление «вход с нового устройства» — от самого входа)
    assert not any(event == "подозрение на кражу сессии" for event, _ in _no_telegram)


async def test_previous_token_with_other_user_agent_is_theft(
    browser, staff, _no_telegram, monkeypatch
) -> None:
    other = DEVICE | {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1"}
    response, row, actions = await _replay(
        browser, staff, monkeypatch, rotations=1, replay_headers=other
    )
    assert response.status_code == 401
    assert row.revoked_at is not None
    assert "refresh_reuse" in actions
    assert any(event == "подозрение на кражу сессии" for event, _ in _no_telegram)


async def test_token_older_than_previous_is_theft_even_from_same_device(
    browser, staff, _no_telegram, monkeypatch
) -> None:
    response, row, actions = await _replay(
        browser, staff, monkeypatch, rotations=2, replay_headers=DEVICE
    )
    assert response.status_code == 401
    assert row.revoked_at is not None
    assert "refresh_reuse" in actions
    assert any(event == "подозрение на кражу сессии" for event, _ in _no_telegram)


async def test_two_tabs_refreshing_at_once_is_not_theft(browser, staff) -> None:
    await _login(browser, staff.email, staff.password)
    old = browser.cookies.get("refresh_token")
    assert (await browser.post(REFRESH, headers=_headers())).status_code == 200
    # Вторая вкладка сразу после ротации — со старым токеном
    second = await browser.post(REFRESH, headers=_headers(), cookies={"refresh_token": old})
    assert second.status_code == 200
    async with SessionLocal() as session:
        row = await session.scalar(select(AdminSession).where(AdminSession.admin_id == staff.id))
        assert row.revoked_at is None


@pytest.mark.parametrize(("shift", "alive"), [(6, True), (8, False)], ids=["6d", "8d"])
async def test_session_expires_after_7_idle_days(browser, staff, monkeypatch, shift, alive) -> None:
    await _login(browser, staff.email, staff.password)
    now = clock.utc_now()
    monkeypatch.setattr(clock, "utc_now", lambda: now + timedelta(days=shift))
    response = await browser.post(REFRESH, headers=_headers())
    assert (response.status_code == 200) is alive


async def test_session_has_an_absolute_limit_of_30_days(browser, staff, monkeypatch) -> None:
    """Даже при ежедневной работе через 30 дней нужно войти заново."""
    await _login(browser, staff.email, staff.password)
    start = clock.utc_now()
    for day in range(1, 30):
        monkeypatch.setattr(clock, "utc_now", lambda d=day: start + timedelta(days=d))
        assert (await browser.post(REFRESH, headers=_headers())).status_code == 200
    monkeypatch.setattr(clock, "utc_now", lambda: start + timedelta(days=30, minutes=1))
    assert (await browser.post(REFRESH, headers=_headers())).status_code == 401


async def _access(client: httpx.AsyncClient, email: str, password: str) -> dict[str, str]:
    token = (await _login(client, email, password)).json()["access_token"]
    return {**_headers(), "Authorization": f"Bearer {token}"}


async def test_logout_revokes_the_session_immediately(browser, staff) -> None:
    auth = await _access(browser, staff.email, staff.password)
    assert (await browser.get("/api/v1/auth/me", headers=auth)).status_code == 200
    assert (await browser.post("/api/v1/auth/logout", headers=_headers())).status_code == 204
    # Access-токен ещё не истёк, но сессия отозвана — не пускает сразу
    assert (await browser.get("/api/v1/auth/me", headers=auth)).status_code == 401


async def test_sessions_list_and_revoke_others(staff) -> None:
    transport = ASGITransport(app=app)
    async with (
        httpx.AsyncClient(transport=transport, base_url="http://test") as laptop,
        httpx.AsyncClient(transport=transport, base_url="http://test") as phone,
    ):
        laptop_auth = await _access(laptop, staff.email, staff.password)
        phone_auth = await _access(phone, staff.email, staff.password)

        listed = (await laptop.get("/api/v1/auth/sessions", headers=laptop_auth)).json()
        assert len(listed) == 2
        assert sum(item["current"] for item in listed) == 1
        assert listed[0]["device"] == "Chrome на Windows"

        revoke = await laptop.post("/api/v1/auth/sessions/revoke-others", headers=laptop_auth)
        assert revoke.status_code == 204
        assert (await phone.get("/api/v1/auth/me", headers=phone_auth)).status_code == 401
        assert (await laptop.get("/api/v1/auth/me", headers=laptop_auth)).status_code == 200


async def test_cannot_revoke_someone_elses_session(browser, staff, admin_headers) -> None:
    await _login(browser, staff.email, staff.password)
    async with SessionLocal() as session:
        row = await session.scalar(select(AdminSession).where(AdminSession.admin_id == staff.id))
    response = await browser.delete(
        f"/api/v1/auth/sessions/{row.id}", headers={**admin_headers, "Origin": ORIGIN}
    )
    assert response.status_code == 404


async def test_deactivation_revokes_all_sessions(browser, staff, admin_headers) -> None:
    auth = await _access(browser, staff.email, staff.password)
    response = await browser.patch(
        f"/api/v1/admin/users/{staff.id}", json={"is_active": False}, headers=admin_headers
    )
    assert response.status_code == 200
    assert (await browser.get("/api/v1/auth/me", headers=auth)).status_code == 401
    assert (await browser.post(REFRESH, headers=_headers())).status_code == 401


async def test_owner_password_reset_uses_policy_and_revokes_sessions(
    browser, staff, admin_headers
) -> None:
    auth = await _access(browser, staff.email, staff.password)
    weak = await browser.patch(
        f"/api/v1/admin/users/{staff.id}", json={"password": "qwerty123456"}, headers=admin_headers
    )
    assert weak.status_code == 422
    ok = await browser.patch(
        f"/api/v1/admin/users/{staff.id}",
        json={"password": "Новый торт к чаю 2026"},
        headers=admin_headers,
    )
    assert ok.status_code == 200
    assert (await browser.get("/api/v1/auth/me", headers=auth)).status_code == 401
    assert (await _login(browser, staff.email, "Новый торт к чаю 2026")).status_code == 200


async def test_change_password_keeps_current_and_revokes_other_sessions(staff) -> None:
    transport = ASGITransport(app=app)
    async with (
        httpx.AsyncClient(transport=transport, base_url="http://test") as laptop,
        httpx.AsyncClient(transport=transport, base_url="http://test") as phone,
    ):
        laptop_auth = await _access(laptop, staff.email, staff.password)
        phone_auth = await _access(phone, staff.email, staff.password)

        wrong = await laptop.post(
            "/api/v1/auth/change-password",
            json={"current_password": "не тот", "new_password": "Совсем новый пароль 77"},
            headers=laptop_auth,
        )
        assert wrong.status_code == 422

        changed = await laptop.post(
            "/api/v1/auth/change-password",
            json={"current_password": staff.password, "new_password": "Совсем новый пароль 77"},
            headers=laptop_auth,
        )
        assert changed.status_code == 204
        assert (await laptop.get("/api/v1/auth/me", headers=laptop_auth)).status_code == 200
        assert (await phone.get("/api/v1/auth/me", headers=phone_auth)).status_code == 401


# --- 1.3. Политика паролей ---


@pytest.mark.parametrize(
    ("password", "reason"),
    [
        ("Короткий1!", "короче"),
        ("qwerty123456", "простой"),
        ("password12345", "простой"),
        ("dragonfly2024!", "простой"),
        ("aaaaaaaaaaaaaaa", "простой"),
        ("manager-2026-торт", "e-mail"),
        ("Abrikosova-1234567", "кондитерской"),
        ("x" * 129, "длиннее"),
    ],
)
def test_password_policy_rejects(password, reason) -> None:
    with pytest.raises(PasswordPolicyError, match=reason):
        validate_password(password, email="manager@abrikosova-elena.ru")


def test_password_policy_accepts_a_long_passphrase() -> None:
    validate_password("Малина на рассвете у Гжатской", email="manager@abrikosova-elena.ru")


async def test_user_creation_uses_the_policy(client, admin_headers) -> None:
    response = await client.post(
        "/api/v1/admin/users",
        json={
            "email": f"new-{uuid.uuid4().hex[:6]}@example.com",
            "name": "Новый Сотрудник",
            "password": "password12345",
        },
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert "простой" in response.json()["detail"][0]["msg"]


# --- 1.4. Журнал и уведомления ---


async def test_audit_log_records_login_events_without_passwords(
    browser, staff, _no_telegram
) -> None:
    ghost = f"ghost-{uuid.uuid4().hex[:8]}@example.com"
    await _login(browser, ghost, "неверный-пароль-123")
    await _fail(browser, staff.email, 5)
    await _expire_lock(staff.email)
    await _login(browser, staff.email, staff.password)

    async with SessionLocal() as session:
        mine = (
            await session.scalars(
                select(AuditLogEntry)
                .where(AuditLogEntry.actor_id == staff.id, AuditLogEntry.entity == "auth")
                .order_by(AuditLogEntry.id)
            )
        ).all()
        ghost_entry = await session.scalar(
            select(AuditLogEntry)
            .where(AuditLogEntry.details["email_hash"].astext == login_guard.email_key(ghost))
            .order_by(AuditLogEntry.id.desc())
        )
        await session.execute(delete(AuditLogEntry).where(AuditLogEntry.id == ghost_entry.id))
        await session.commit()

    actions = [entry.action for entry in mine]
    assert actions.count("login_failed") == 4
    assert actions[-2:] == ["login_locked", "login_success"]
    assert all(entry.actor_email == staff.email for entry in mine)
    assert all(PASSWORD not in str(entry.details) for entry in mine)
    # Несуществующий адрес — только хеш, без самого e-mail
    assert ghost_entry.actor_email is None and ghost not in str(ghost_entry.details)

    events = [event for event, _ in _no_telegram]
    assert "блокировка входа после 5 неудач" in events
    assert "вход с нового устройства" in events


async def test_second_login_from_the_same_device_is_not_new(browser, staff, _no_telegram) -> None:
    fixed = {"X-Forwarded-For": "10.9.9.9"}
    for _ in range(2):
        await browser.post(
            LOGIN,
            json={"email": staff.email, "password": staff.password},
            headers=_headers(**fixed),
        )
    assert [event for event, _ in _no_telegram].count("вход с нового устройства") == 1


# --- 1.5. Origin, cookie, кэш ---


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://evil.example"},
        {"Referer": "https://evil.example/page"},
        {},
    ],
    ids=["чужой Origin", "чужой Referer", "без Origin и Referer"],
)
async def test_untrusted_origin_is_rejected(browser, staff, headers) -> None:
    response = await browser.post(
        LOGIN, json={"email": staff.email, "password": staff.password}, headers=headers
    )
    assert response.status_code == 403
    assert (await browser.post(REFRESH, headers=headers)).status_code == 403
    assert (await browser.post("/api/v1/auth/logout", headers=headers)).status_code == 403


async def test_referer_from_our_site_is_accepted(browser, staff) -> None:
    response = await browser.post(
        LOGIN,
        json={"email": staff.email, "password": staff.password},
        headers={"Referer": f"{ORIGIN}/admin/login"},
    )
    assert response.status_code == 200


async def test_auth_responses_are_not_cached(browser, staff) -> None:
    ok = await _login(browser, staff.email, staff.password)
    bad = await _login(browser, staff.email, "неверный-пароль-123")
    forbidden = await browser.post(REFRESH, headers={"Origin": "https://evil.example"})
    assert {r.headers.get("cache-control") for r in (ok, bad, forbidden)} == {"no-store"}


# --- 2.3. Фото для страницы входа ---


def _photo_png(size: tuple[int, int], background: tuple[int, int, int]) -> bytes:
    """Однотонная картинка с тёмным кругом в центре — как торт на фоне."""
    image = Image.new("RGB", size, background)
    width, height = size
    ImageDraw.Draw(image).ellipse(
        (width // 4, height // 4, width * 3 // 4, height * 3 // 4), fill=(90, 30, 40)
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


async def test_login_photos_skip_hidden_products_and_unpublished_works(
    client, catalog, monkeypatch
) -> None:
    suffix = uuid.uuid4().hex
    shown_key, hidden_key = f"gallery/shown-{suffix}.png", f"gallery/hidden-{suffix}.png"
    hidden_product_key, broken_key = f"products/hidden-{suffix}.png", f"gallery/broken-{suffix}.png"
    files = {
        shown_key: _photo_png((336, 420), (241, 232, 220)),
        hidden_key: _photo_png((336, 420), (0, 0, 0)),
        hidden_product_key: _photo_png((336, 420), (0, 0, 0)),
        broken_key: b"not an image",
    }
    reads: list[str] = []

    async def fake_read(key: str) -> bytes | None:
        reads.append(key)
        return files.get(key)

    monkeypatch.setattr(storage, "read_object", fake_read)

    async with SessionLocal() as session:
        hidden_work = GalleryItem(image_key=hidden_key, caption="Скрытая работа", is_active=False)
        shown_work = GalleryItem(
            image_key=shown_key, caption="Показанная работа", is_active=True, order=-100
        )
        broken_work = GalleryItem(
            image_key=broken_key, caption="Битый файл", is_active=True, order=-99
        )
        session.add_all([hidden_work, shown_work, broken_work])
        hidden = await session.get(Product, catalog.products["kids-cake"])
        hidden.is_active = False
        session.add(
            ProductImage(product_id=hidden.id, storage_key=hidden_product_key, is_main=True)
        )
        await session.commit()
        work_ids = [hidden_work.id, shown_work.id, broken_work.id]

    try:
        response = await client.get("/api/v1/content/login-photos")
        assert response.status_code == 200
        assert response.headers["cache-control"] == "public, max-age=600"
        items = response.json()
        by_key = {item["image_key"]: item for item in items}
        assert hidden_key not in by_key
        assert hidden_product_key not in by_key
        # Файл, который не разобрался как картинка, пропускается, а не ломает ответ
        assert broken_key not in by_key
        assert not any(key.startswith("placeholder/") for key in by_key)
        assert len(items) <= 30
        # Размер — натуральный, фон — цвет рамки, а не круга в центре
        assert by_key[shown_key] == {
            "image_key": shown_key,
            "caption": "Показанная работа",
            "kind": "work",
            "width": 336,
            "height": 420,
            "bg": "#F1E8DC",
        }

        # Второй запрос берёт размер и фон из кэша и хранилище не читает
        reads.clear()
        again = await client.get("/api/v1/content/login-photos")
        assert again.json() == items
        assert shown_key not in reads
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(GalleryItem).where(GalleryItem.id.in_(work_ids)))
            await session.commit()
        redis = get_redis()
        await redis.delete(*(f"photo_meta:{key}" for key in files))
