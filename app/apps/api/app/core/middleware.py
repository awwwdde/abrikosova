"""Middleware безопасности и трассировки запросов."""

import logging
import time
import uuid

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class RequestBodyLimitMiddleware:
    """Ограничивает и chunked-тело до multipart-парсера, включая прямой доступ к API."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        limit = 1024 * 1024
        if path == "/api/v1/admin/uploads/video":
            limit *= 101
        elif b"multipart/form-data" in dict(scope["headers"]).get(b"content-type", b"").lower():
            limit *= 60
        detail = "Превышен допустимый размер запроса"
        length = dict(scope["headers"]).get(b"content-length")
        if length is not None:
            try:
                too_large = int(length) > limit or int(length) < 0
            except ValueError:
                await JSONResponse({"detail": "Некорректный Content-Length"}, 400)(
                    scope, receive, send
                )
                return
            if too_large:
                await JSONResponse({"detail": detail}, 413)(scope, receive, send)
                return
        received = 0
        exceeded = False
        replied = False

        async def bounded_receive():
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    exceeded = True
                    raise HTTPException(status_code=413, detail=detail)
            return message

        async def bounded_send(message):
            nonlocal replied
            if exceeded:
                # Парсер может преобразовать ошибку чтения тела в 400. Лимит
                # остаётся 413 независимо от внутреннего обработчика ошибок.
                if not replied:
                    replied = True
                    await JSONResponse({"detail": detail}, 413)(scope, receive, send)
                return
            await send(message)

        try:
            await self.app(scope, bounded_receive, bounded_send)
        except Exception:
            if not exceeded:
                raise
            if not replied:
                await JSONResponse({"detail": detail}, 413)(scope, receive, send)


# Заголовки, которые в старом проекте не выставлялись вовсе.
# CSP для API намеренно максимально жёсткая: JSON-ответы ничего не подгружают,
# а вот отрендеренный в браузере ответ (например, /docs на проде выключен)
# не должен уметь исполнять сторонние скрипты.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)

        # Токены и данные сессий не должны оседать ни в кэше браузера, ни в прокси
        # (задание 011a). Для любого ответа /auth/*, включая ошибки и 429
        if request.url.path.startswith("/api/v1/auth"):
            response.headers["Cache-Control"] = "no-store"

        # HSTS имеет смысл только на HTTPS-проде; на localhost он сломал бы разработку
        if get_settings().environment == "production":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )

        return response


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Сквозной идентификатор запроса + структурный лог с длительностью.

    В старом проекте отладка велась через print() без какой-либо корреляции
    (ANALYSIS.md, п. 2.1.5). Здесь у каждого запроса есть id, который уходит
    и в лог, и в заголовок ответа.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id

        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started) * 1000

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s за %.1f мс (request_id=%s)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response
