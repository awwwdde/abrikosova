"""Медиа в PostgreSQL либо на постоянном диске при явном выборе filesystem.

Публичные фото и видео выдаёт отдельный маршрут с разрешёнными префиксами.
Референсы заявок и дампы БД остаются закрытыми. Оригинальные имена файлов не
используются; фото пересобираются в WEBP без EXIF.
"""

import io
import logging
import os
import re
import shutil
import tempfile
import threading
import uuid
from pathlib import Path
from typing import BinaryIO, Final

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.services import database_media

logger = logging.getLogger(__name__)
register_heif_opener()
MAX_UPLOAD_BYTES: Final = 10 * 1024 * 1024
MAX_DIMENSION: Final = 2000
MAX_INPUT_PIXELS: Final = 25_000_000
MAX_INPUT_EDGE: Final = 16_384
# Декодирование ограничено независимо от числа HTTP-запросов.
_IMAGE_WORKERS = threading.BoundedSemaphore(2)
WEBP_QUALITY: Final = 82
ALLOWED_FORMATS: Final = {"JPEG", "PNG", "WEBP", "HEIF"}
PUBLIC_PREFIXES: Final = (
    "products",
    "gallery",
    "fillings",
    "custom-cakes",
    "reviews",
    "pages",
    "hero",
)
PRIVATE_REFERENCES_PREFIX: Final = "references"


class StorageNotConfiguredError(Exception):
    """Постоянный каталог не настроен."""


def object_path(key: str) -> Path:
    """Не допускает обхода каталогов, в том числе через символические ссылки."""
    if not key or len(key) > 500 or not re.fullmatch(r"[A-Za-z0-9_./-]+", key):
        raise ValueError("Недопустимый ключ файла")
    parts = key.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("Недопустимый ключ файла")
    setting = get_settings().media_root
    if not setting:
        raise StorageNotConfiguredError
    root = Path(setting).resolve()
    if any(root.joinpath(*parts[:index]).is_symlink() for index in range(1, len(parts) + 1)):
        raise ValueError("Символические ссылки не поддерживаются")
    target = root.joinpath(*parts).resolve()
    if not target.is_relative_to(root) or target == root:
        raise ValueError("Недопустимый ключ файла")
    return target


def _write(key: str, source: BinaryIO) -> None:
    target = object_path(key)
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
    # Незавершённая загрузка не видна читателю и не портит прежний файл.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".upload-", delete=False) as out:
            temporary = Path(out.name)
            shutil.copyfileobj(source, out, length=1024 * 1024)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


async def write_object(key: str, data: bytes) -> None:
    if get_settings().media_storage == "database":
        object_path(key)
        await database_media.write(key, io.BytesIO(data))
        return
    await run_in_threadpool(_write, key, io.BytesIO(data))


async def write_stream(key: str, source: BinaryIO) -> None:
    if get_settings().media_storage == "database":
        object_path(key)
        await database_media.write(key, source)
        return
    await run_in_threadpool(_write, key, source)


async def write_file(key: str, filename: str) -> None:
    if get_settings().media_storage == "database":
        object_path(key)
        with open(filename, "rb") as source:
            await database_media.write(key, source)
        return

    def copy() -> None:
        with open(filename, "rb") as source:
            _write(key, source)

    await run_in_threadpool(copy)


async def copy_to_file(key: str, filename: str) -> None:
    if get_settings().media_storage == "database":
        object_path(key)
        await database_media.copy_to_file(key, filename)
        return
    await run_in_threadpool(shutil.copyfile, object_path(key), filename)


async def object_size(key: str) -> int | None:
    if get_settings().media_storage == "database":
        object_path(key)
        return await database_media.size(key)
    try:
        return (await run_in_threadpool(object_path(key).stat)).st_size
    except FileNotFoundError:
        return None


async def ensure_storage() -> None:
    root = get_settings().media_root
    if not root:
        raise StorageNotConfiguredError
    await run_in_threadpool(Path(root).mkdir, parents=True, exist_ok=True, mode=0o750)
    if get_settings().media_storage == "database":
        await import_legacy_files()


async def import_legacy_files() -> int:
    """Первый запуск после перехода: переносит прежние файлы, не удаляя оригиналы."""
    from sqlalchemy import func, select

    from app.core.db import SessionLocal
    from app.models import SiteSetting

    marker = "media_disk_imported"
    async with SessionLocal() as db:
        await db.execute(select(func.pg_advisory_xact_lock(func.hashtext("media:disk-import"))))
        if await db.get(SiteSetting, marker) is not None:
            return 0
        root = Path(get_settings().media_root)
        files = await run_in_threadpool(lambda: list(root.rglob("*")))
        count = 0
        for path in files:
            if path.is_symlink() or not path.is_file():
                continue
            key = path.relative_to(root).as_posix()
            if any(part.startswith(".") for part in path.relative_to(root).parts):
                continue
            if key.split("/", 1)[0] not in (*PUBLIC_PREFIXES, "references", "backups"):
                continue
            object_path(key)
            if await database_media.size(key) is None:
                await write_file(key, str(path))
                count += 1
        db.add(SiteSetting(key=marker, value=True))
        await db.commit()
    logger.info("Файлы перенесены с диска в PostgreSQL: %s", count)
    return count


async def materialize(key: str) -> Path | None:
    path = object_path(key)
    if get_settings().media_storage == "database":
        return await database_media.materialize(key)
    return path if path.is_file() else None


def _check_image(image: Image.Image) -> None:
    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(status_code=400, detail="Поддерживаются только JPEG, PNG, WEBP и HEIC")
    width, height = image.size
    if width * height > MAX_INPUT_PIXELS or max(width, height) > MAX_INPUT_EDGE:
        raise HTTPException(status_code=413, detail="Изображение слишком большое: максимум 25 Мп")


def _convert_to_webp(raw: bytes) -> bytes:
    """Размеры проверяются по заголовку до выделения памяти под пиксели."""
    with _IMAGE_WORKERS:
        try:
            with Image.open(io.BytesIO(raw)) as image:
                _check_image(image)
                image.verify()
            with Image.open(io.BytesIO(raw)) as image:
                _check_image(image)
                # thumbnail до RGB-конвертации позволяет JPEG-декодеру уменьшить
                # снимок заранее; EXIF-поворот после уменьшения сохраняет ориентацию.
                image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
                oriented = ImageOps.exif_transpose(image)
                converted = oriented.convert(
                    "RGBA" if oriented.mode in ("RGBA", "LA", "P") else "RGB"
                )
                try:
                    buffer = io.BytesIO()
                    converted.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=4)
                    return buffer.getvalue()
                finally:
                    converted.close()
                    oriented.close()
        except Image.DecompressionBombError as exc:
            raise HTTPException(status_code=413, detail="Изображение слишком большое") from exc
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Файл не является изображением") from exc


async def read_upload(file: UploadFile) -> bytes:
    """Читает файл из запроса и проверяет размер — до конвертации."""
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ",
        )
    return raw


async def convert_upload(file: UploadFile) -> bytes:
    """Проверяет файл по содержимому и возвращает WEBP без метаданных.

    Для загрузки нескольких файлов разом (фото-образцы заявки, 008a): сначала
    проверяются все, и только потом что-то уходит в хранилище — плохой пятый
    файл не оставит в бакете четыре сиротских.
    """
    raw = await read_upload(file)
    return await run_in_threadpool(_convert_to_webp, raw)


async def store_image(raw: bytes, prefix: str) -> str:
    webp = await run_in_threadpool(_convert_to_webp, raw)
    return await put_webp(webp, prefix)


async def put_webp(webp: bytes, prefix: str) -> str:
    key = f"{prefix}/{uuid.uuid4().hex}.webp"
    try:
        await write_object(key, webp)
    except StorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="Хранилище изображений не настроено") from None
    except OSError:
        logger.exception("Не удалось сохранить изображение в раздел %s", prefix)
        raise HTTPException(status_code=502, detail="Не удалось сохранить изображение") from None
    return key


async def upload_image(file: UploadFile, prefix: str) -> str:
    return await store_image(await read_upload(file), prefix)


async def read_object(key: str) -> bytes | None:
    try:
        path = await materialize(key)
        return await run_in_threadpool(path.read_bytes) if path is not None else None
    except (FileNotFoundError, ValueError, StorageNotConfiguredError):
        return None
    except OSError:
        logger.exception("Не удалось прочитать файл")
        return None


async def delete_image(key: str) -> None:
    try:
        object_path(key)
        if get_settings().media_storage == "database":
            await database_media.remove(key)
        await run_in_threadpool(object_path(key).unlink, missing_ok=True)
    except (ValueError, StorageNotConfiguredError):
        return
    except OSError:
        logger.exception("Не удалось удалить файл %s", key)
