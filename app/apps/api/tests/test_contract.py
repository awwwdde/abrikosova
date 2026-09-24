"""Тест фиксирует состав путей API по new/spec/02-api-contract.md.

Смысл теста — не проверить логику (её ещё нет), а поймать случайное расхождение
реализации с контрактом: удалённый или переименованный путь уронит тест.
"""

import httpx
import pytest
from httpx import ASGITransport

from app.main import app

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/catalog/categories",
    "/api/v1/catalog/filters",
    "/api/v1/catalog/products",
    "/api/v1/catalog/products/{slug}",
    "/api/v1/custom-cakes",
    "/api/v1/custom-cakes/consultation",
    "/api/v1/gallery",
    "/api/v1/reviews",
    "/api/v1/pages/{page_key}",
    "/api/v1/contacts/feedback",
    "/api/v1/cart",
    "/api/v1/cart/items",
    "/api/v1/cart/items/{product_id}",
    "/api/v1/orders",
    "/api/v1/orders/{order_number}",
}

AUTH_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/me",
}


def test_contract_paths_present() -> None:
    paths = set(app.openapi()["paths"])
    assert PUBLIC_PATHS <= paths
    assert AUTH_PATHS <= paths


def test_consultation_accepts_multipart() -> None:
    """Заявка на торт принимает фото-референс, поэтому тело — multipart/form-data."""
    body = app.openapi()["paths"]["/api/v1/custom-cakes/consultation"]["post"]["requestBody"]
    assert "multipart/form-data" in body["content"]


def test_cart_mutations_are_never_get() -> None:
    """ANALYSIS.md, п. 2.1.4: в старом коде добавление и удаление из корзины ходили
    обычным GET. Здесь GET допустим только для чтения корзины."""
    paths = app.openapi()["paths"]

    assert set(paths["/api/v1/cart"]) == {"get", "delete"}
    assert set(paths["/api/v1/cart/items"]) == {"post"}
    assert set(paths["/api/v1/cart/items/{product_id}"]) == {"patch", "delete"}


def test_admin_paths_are_separate_from_public() -> None:
    """Admin API живёт под своим префиксом, чтобы права и rate-limit настраивались отдельно."""
    admin_paths = [p for p in app.openapi()["paths"] if p.startswith("/api/v1/admin/")]

    assert len(admin_paths) >= 20


@pytest.mark.asyncio
async def test_admin_api_requires_authentication() -> None:
    """Admin API закрыт: без токена — 401, а не 200 и не редирект."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/api/v1/admin", "/api/v1/admin/products", "/api/v1/admin/users"):
            response = await client.get(path)
            assert response.status_code == 401, path


@pytest.mark.asyncio
async def test_admin_rejects_garbage_token() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/admin/products", headers={"Authorization": "Bearer not-a-token"}
        )

    assert response.status_code == 401
