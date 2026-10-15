"""Только публичные фото и видео; приватные каталоги не монтируются наружу."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.storage import PUBLIC_PREFIXES, materialize

router = APIRouter()
TYPES = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


@router.api_route("/media/{key:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def public_media(key: str) -> FileResponse:
    if key.split("/", 1)[0] not in PUBLIC_PREFIXES:
        raise HTTPException(status_code=404)
    try:
        path = await materialize(key)
    except ValueError:
        raise HTTPException(status_code=404) from None
    media_type = TYPES.get(Path(key).suffix.lower())
    if media_type is None or path is None:
        raise HTTPException(status_code=404)
    # FileResponse поддерживает Range / If-Range: видео можно перематывать,
    # и браузер не вынужден скачивать весь ролик для первого кадра.
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
