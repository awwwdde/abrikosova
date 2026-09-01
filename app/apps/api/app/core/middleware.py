"""Middleware безопасности и трассировки запросов."""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings

logger = logging.getLogger(__name__)

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
