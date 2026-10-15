"""Регрессии аудита: подмена IP, ресурсные лимиты и конкурентные транзакции."""

import asyncio
import csv
import io
import uuid
from datetime import timedelta

import httpx
import pytest
from fastapi import HTTPException, Request, UploadFile
from httpx import ASGITransport
from PIL import Image
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.rate_limit import RateLimiter, client_ip
from app.core.redis import get_redis
from app.core.security import decode_token
from app.main import app
from app.models import AdminSession, AdminUser, Cart, Order
from app.routers import shop
from app.services import (
    backups,
    cart,
    dashboard,
    notifications,
    order_email,
    sessions,
    storage,
    telegram,
)


def request(peer, forwarded):
    return Request(
        {
            "type": "http",
            "client": (peer, 1234),
            "headers": [(b"x-forwarded-for", forwarded.encode())],
        }
    )


@pytest.mark.parametrize(
    ("peer", "forwarded", "expected"),
    [
        ("192.0.2.1", "198.51.100.1", "192.0.2.1"),
        ("127.0.0.1", "1.2.3.4, 198.51.100.1", "198.51.100.1"),
        ("127.0.0.1", "1.2.3.4, 198.51.100.1, 10.0.0.1", "198.51.100.1"),
        ("127.0.0.1", "invalid", "127.0.0.1"),
        ("::1", "2001:db8::1", "2001:db8::1"),
    ],
)
def test_only_explicit_proxies_can_supply_client_ip(monkeypatch, peer, forwarded, expected):
    monkeypatch.setattr(
        get_settings(), "trusted_proxy_networks", ["127.0.0.1/32", "10.0.0.0/24", "::1/128"]
    )
    assert client_ip(request(peer, forwarded)) == expected


async def test_changing_forwarded_header_cannot_bypass_rate_limit(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_networks", [])
    limiter = RateLimiter("spoof-regression", 1, 30)
    await limiter(request("192.0.2.50", "198.51.100.1"))
    with pytest.raises(HTTPException) as error:
        await limiter(request("192.0.2.50", "198.51.100.2"))
    assert error.value.status_code == 429
    assert 0 < await get_redis().ttl("ratelimit:spoof-regression:192.0.2.50") <= 30


@pytest.mark.parametrize(
    "value", ["=1+1", "+1", "-1+1", "@SUM(A1)", " \t=1", "\r=1", "\n=1", "\ufeff=1"]
)
def test_csv_neutralizes_formula_cells(value):
    data = dashboard.to_csv(["Клиент"], [[value], ["Анна"], [12]])
    rows = list(csv.reader(io.StringIO(data.decode("utf-8-sig")), delimiter=";"))
    assert rows == [["Клиент"], ["'" + value], ["Анна"], ["12"]]


def test_pixel_limit_rejects_before_decoding(monkeypatch):
    raw = io.BytesIO()
    Image.new("RGB", (6, 3)).save(raw, format="PNG")
    monkeypatch.setattr(storage, "MAX_INPUT_PIXELS", 10)
    with pytest.raises(HTTPException) as error:
        storage._convert_to_webp(raw.getvalue())
    assert error.value.status_code == 413


async def test_upload_reader_is_bounded(monkeypatch):
    monkeypatch.setattr(storage, "MAX_UPLOAD_BYTES", 10)
    source = io.BytesIO(b"x" * 1000)
    with pytest.raises(HTTPException) as error:
        await storage.read_upload(UploadFile(source))
    assert error.value.status_code == 413
    assert source.tell() == 11


async def test_direct_api_body_limit_with_and_without_content_length(client):
    oversized = await client.post("/api/v1/auth/login", content=b"x" * (1024 * 1024 + 1))
    assert oversized.status_code == 413
    assert oversized.headers["x-content-type-options"] == "nosniff"
    assert oversized.headers["cache-control"] == "no-store"

    async def chunks():
        for _ in range(17):
            yield b"x" * 65536

    response = await client.post(
        "/api/v1/auth/login", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"


async def test_empty_cart_reads_and_deletes_do_not_create_rows(client):
    async with SessionLocal() as db:
        before = await db.scalar(select(func.count()).select_from(Cart))
    for _ in range(3):
        client.cookies.clear()
        response = await client.get("/api/v1/cart")
        assert response.status_code == 200
        assert response.json()["items"] == []
        assert "set-cookie" not in response.headers
        assert (await client.delete("/api/v1/cart")).status_code == 200
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(Cart)) == before


async def test_expired_cart_is_unavailable_and_purged():
    async with SessionLocal() as db:
        old = Cart(
            items=[], updated_at=clock.utc_now() - timedelta(days=get_settings().cart_ttl_days + 1)
        )
        fresh = Cart(items=[])
        db.add_all([old, fresh])
        await db.commit()
        old_id, fresh_id = old.id, fresh.id
    try:
        async with SessionLocal() as db:
            assert await cart.find_cart(db, old_id) is None
            assert await cart.find_cart(db, fresh_id) is not None
            assert await cart.purge_expired(db) >= 1
        async with SessionLocal() as db:
            assert await db.get(Cart, old_id) is None
            assert await db.get(Cart, fresh_id) is not None
    finally:
        async with SessionLocal() as db:
            await db.execute(delete(Cart).where(Cart.id.in_([old_id, fresh_id])))
            await db.commit()


def identity(headers):
    return decode_token(headers["Authorization"].split()[1], "access")


async def test_committed_revocation_cannot_be_overridden_by_a_stale_reader(admin_headers):
    payload = identity(admin_headers)
    sid, admin_id = uuid.UUID(payload["sid"]), int(payload["sub"])
    async with SessionLocal() as writer, SessionLocal() as reader:
        row = await writer.get(AdminSession, sid)
        await sessions.revoke(writer, row)
        assert await sessions.check_alive(reader, str(sid), admin_id)
        await get_redis().set(f"admin_session_alive:{sid}", str(admin_id), ex=45)
        await writer.commit()
        assert not await sessions.check_alive(reader, str(sid), admin_id)


async def test_parallel_refreshes_issue_the_same_current_token(admin_headers, monkeypatch):
    payload = identity(admin_headers)
    sid = uuid.UUID(payload["sid"])
    async with SessionLocal() as db:
        row = await db.get(AdminSession, sid)
        admin = await db.get(AdminUser, row.admin_id)
        _, refresh = sessions.issue_tokens(admin, row)
    entered, release = asyncio.Event(), asyncio.Event()
    original_commit = AsyncSession.commit

    async def held_commit(db):
        if (
            any(isinstance(item, AdminSession) and item.id == sid for item in db.dirty)
            and not entered.is_set()
        ):
            entered.set()
            await release.wait()
        await original_commit(db)

    monkeypatch.setattr(AsyncSession, "commit", held_commit)
    async with (
        httpx.AsyncClient(transport=ASGITransport(app), base_url="http://test") as first,
        httpx.AsyncClient(transport=ASGITransport(app), base_url="http://test") as second,
    ):
        for http in (first, second):
            http.cookies.set("refresh_token", refresh)
            http.headers["Origin"] = "http://localhost:3000"
        a = asyncio.create_task(first.post("/api/v1/auth/refresh"))
        await asyncio.wait_for(entered.wait(), 5)
        b = asyncio.create_task(second.post("/api/v1/auth/refresh"))
        try:
            with pytest.raises(TimeoutError):
                await asyncio.wait_for(asyncio.shield(b), 0.15)
        finally:
            release.set()
        results = await asyncio.gather(a, b)
        assert [result.status_code for result in results] == [200, 200]
        tokens = [
            decode_token(result.cookies["refresh_token"], "refresh")["jti"] for result in results
        ]
        assert tokens[0] == tokens[1]
        assert (await first.post("/api/v1/auth/refresh")).status_code == 200


@pytest.mark.parametrize("with_keys", [False, True])
async def test_parallel_orders_consume_cart_once(
    client, catalog, clean_settings, monkeypatch, with_keys
):
    for module, name in [
        (notifications, "notify_new_order"),
        (telegram, "notify_new_order"),
        (order_email, "send_order_copy"),
    ]:
        if hasattr(module, name):
            monkeypatch.setattr(module, name, lambda *args, **kwargs: None)
    response = await client.post(
        "/api/v1/cart/items", json={"variant_id": catalog.variants["gf-cookie"]}
    )
    assert response.status_code == 201
    cart_id = uuid.UUID(client.cookies["cart_id"])
    data = {
        "customer_name": "Анна Тестовая",
        "customer_phone": "+79161234567",
        "customer_email": "regression@example.com",
        "consent_pd": True,
        "delivery_method": "pickup",
        "delivery_interval": "12-15",
        "desired_date": (clock.local_today() + timedelta(days=5)).isoformat(),
    }
    entered, release = asyncio.Event(), asyncio.Event()
    original_create = shop.order_service.create_order
    calls = 0

    async def held_create(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            entered.set()
            await release.wait()
        return await original_create(*args, **kwargs)

    monkeypatch.setattr(shop.order_service, "create_order", held_create)
    a = asyncio.create_task(
        client.post(
            "/api/v1/orders", json=data, headers={"Idempotency-Key": "first"} if with_keys else {}
        )
    )
    await asyncio.wait_for(entered.wait(), 5)
    b = asyncio.create_task(
        client.post(
            "/api/v1/orders", json=data, headers={"Idempotency-Key": "second"} if with_keys else {}
        )
    )
    try:
        with pytest.raises(TimeoutError):
            await asyncio.wait_for(asyncio.shield(b), 0.15)
        assert calls == 1
    finally:
        release.set()
    results = await asyncio.gather(a, b)
    try:
        assert sorted(result.status_code for result in results) == [201, 400]
        assert (await client.get("/api/v1/cart")).json()["items"] == []
    finally:
        numbers = [result.json()["order_number"] for result in results if result.status_code == 201]
        async with SessionLocal() as db:
            await db.execute(delete(Order).where(Order.order_number.in_(numbers)))
            await db.execute(delete(Cart).where(Cart.id == cart_id))
            await db.commit()


async def test_restored_sessions_are_invalidated_without_restoring_database(admin_headers):
    payload = identity(admin_headers)
    # Проверяем только завершающий защитный шаг на тестовой базе, без pg_restore.
    await backups.invalidate_restored_sessions()
    async with SessionLocal() as db:
        assert not await sessions.check_alive(db, payload["sid"], int(payload["sub"]))


def test_restore_list_excludes_session_data_but_preserves_schema_and_other_data():
    toc = (
        b"1; 1259 123 TABLE public admin_sessions owner\n"
        b"2; 0 123 TABLE DATA public admin_sessions owner\n"
        b"3; 0 124 TABLE DATA public admin_users owner\n"
    )
    result = backups.restore_table_list(toc)
    assert "TABLE public admin_sessions" in result
    assert "TABLE DATA public admin_sessions" not in result
    assert "TABLE DATA public admin_users" in result
