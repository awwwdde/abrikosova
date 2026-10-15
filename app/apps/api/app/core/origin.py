"""Проверка источника запроса для `/auth/*` (защита от CSRF, задание 011a).

Refresh-cookie уходит на `/api/v1/auth/*` автоматически, поэтому вход, выход,
обновление токена и остальные изменения там принимаются только со страниц
нашего сайта: заголовок `Origin` (а если его нет — `Referer`) должен совпасть
с одним из разрешённых адресов — тем же списком, что у CORS (`CORS_ORIGINS`).

Если нет ни `Origin`, ни `Referer`, запрос тоже отклоняется: браузер присылает
`Origin` на любой POST, а без браузера CSRF не бывает — такому клиенту
(скрипт, curl) нечего делать на этих эндпоинтах. SameSite=Strict у cookie —
второй, независимый слой той же защиты.
"""

from urllib.parse import urlsplit

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _origin_of(url: str) -> str | None:
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}".lower()


def is_trusted(request: Request) -> bool:
    allowed = {origin.rstrip("/").lower() for origin in get_settings().cors_origins}
    origin = request.headers.get("origin")
    if origin and origin != "null":
        return origin.rstrip("/").lower() in allowed
    referer = request.headers.get("referer")
    if referer:
        return _origin_of(referer) in allowed
    return False


async def require_trusted_origin(request: Request) -> None:
    """Зависимость роутера: мутирующие запросы — только с разрешённых источников."""
    if request.method in _SAFE_METHODS:
        return
    if not is_trusted(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Запрос с недопустимого источника"
        )
