"""Размер и цвет фона фотографии — для страницы входа в админку (011a, дополнение 2).

Фото тортов сняты на однотонном фоне, и страница входа показывает их целиком, без
увеличения, а панель вокруг красит в цвет фона снимка — чтобы края фотографии не
читались как прямоугольник. Для этого фронтенду нужны натуральные размеры (чтобы не
растягивать) и цвет фона.

Цвет — медиана по каналам пикселей рамки шириной 2 px по краю: медиана, а не
среднее, чтобы край торта или тень, заходящие в рамку, не сдвигали цвет.

Считается один раз на изображение и кэшируется в Redis без срока: ключ хранилища
уникален (uuid), файл под ним не перезаписывается — значит, и результат не устаревает.
"""

import io
import json
import logging
from dataclasses import dataclass
from statistics import median

from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.redis import get_redis
from app.services import storage

logger = logging.getLogger(__name__)

CACHE_PREFIX = "photo_meta:"
BORDER = 2


@dataclass(frozen=True, slots=True)
class PhotoMeta:
    width: int
    height: int
    bg: str  # #RRGGBB


def _compute(raw: bytes) -> PhotoMeta:
    with Image.open(io.BytesIO(raw)) as source:
        # Прозрачный фон считаем белым — так его и покажет страница поверх панели
        image = source.convert("RGBA")
        flattened = Image.new("RGB", image.size, (255, 255, 255))
        flattened.paste(image, mask=image.getchannel("A"))
    width, height = flattened.size
    band = min(BORDER, width, height)
    pixels = flattened.load()
    border: list[tuple[int, int, int]] = []
    for y in range(height):
        if y < band or y >= height - band:
            border.extend(pixels[x, y] for x in range(width))
        else:
            border.extend(pixels[x, y] for x in range(band))
            border.extend(pixels[x, y] for x in range(width - band, width))
    r, g, b = (round(median(p[i] for p in border)) for i in range(3))
    return PhotoMeta(width=width, height=height, bg=f"#{r:02X}{g:02X}{b:02X}")


async def photo_meta(key: str) -> PhotoMeta | None:
    """Размер и фон изображения по ключу хранилища. None — файл не прочитан или не
    картинка: страница входа такое фото просто пропускает."""
    redis = get_redis()
    cache_key = f"{CACHE_PREFIX}{key}"
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        return PhotoMeta(width=data["width"], height=data["height"], bg=data["bg"])

    raw = await storage.read_object(key)
    if raw is None:
        return None
    try:
        meta = await run_in_threadpool(_compute, raw)
    except (UnidentifiedImageError, OSError, ValueError):
        logger.warning("Не удалось разобрать изображение %s для страницы входа", key)
        return None
    # Ошибки не кэшируем: файл могут дозагрузить, а хранилище — подняться
    await redis.set(
        cache_key, json.dumps({"width": meta.width, "height": meta.height, "bg": meta.bg})
    )
    return meta
