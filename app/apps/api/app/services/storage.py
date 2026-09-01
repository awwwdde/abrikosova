"""Загрузка изображений в объектное хранилище.

Хранилище — S3-совместимое: локально MinIO, на проде S3 Object Storage Timeweb
Cloud (данные физически в РФ, что закрывает требование 152-ФЗ о локализации).
Код один и тот же, различается только строка подключения.

Что здесь происходит с картинкой и почему:

* файл проверяется по содержимому, а не по заголовку `Content-Type` — заголовок
  задаёт клиент, и ему верить нельзя;
* изображение полностью пересобирается в WEBP через Pillow. Это не только
  требование договора по формату: пересжатие отбрасывает всё, что не является
  пикселями — EXIF с геометкой и моделью камеры, ICC-профили, а заодно любую
  полезную нагрузку, спрятанную в метаданных;
* SVG не принимается вовсе: это XML, внутри которого исполняется JavaScript;
* имя файла из запроса не используется — ключ генерируется случайным, поэтому
  ни обход каталогов, ни перезапись чужого объекта невозможны.
"""

import io
import json
import logging
import uuid
from typing import Final

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES: Final = 10 * 1024 * 1024
# Максимальная сторона: фото с телефона в 4000px по ширине никому не нужно
# на витрине, но заметно бьёт по скорости загрузки страницы
MAX_DIMENSION: Final = 2000
WEBP_QUALITY: Final = 82

# Форматы, которые Pillow распознаёт и которые мы согласны принимать.
# Список именно разрешительный: всё, чего в нём нет, отклоняется.
ALLOWED_FORMATS: Final = {"JPEG", "PNG", "WEBP"}


class StorageNotConfiguredError(Exception):
    """Хранилище не настроено — загрузка невозможна."""


def _client():
    settings = get_settings()
    if not (settings.s3_endpoint_url and settings.s3_bucket):
        raise StorageNotConfiguredError

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def _convert_to_webp(raw: bytes) -> bytes:
    """Проверяет, что это картинка, и пересобирает её в WEBP."""
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()  # структурная проверка до декодирования пикселей
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не является изображением",
        ) from exc

    # После verify() файл нужно открыть заново — объект становится непригоден
    image = Image.open(io.BytesIO(raw))
    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаются только JPEG, PNG и WEBP",
        )

    # Прозрачность сохраняем, остальное приводим к RGB
    image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    # Новый объект Image без метаданных исходника
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=4)
    return buffer.getvalue()


async def upload_image(file: UploadFile, prefix: str) -> str:
    """Принимает файл, кладёт в хранилище WEBP-версию и возвращает ключ объекта."""
    raw = await file.read()

    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ",
        )

    # Pillow работает синхронно и на больших файлах ощутимо занимает поток
    webp = await run_in_threadpool(_convert_to_webp, raw)

    # Имя из запроса не используется: только префикс раздела и случайный id
    key = f"{prefix}/{uuid.uuid4().hex}.webp"

    try:
        client = await run_in_threadpool(_client)
        await run_in_threadpool(
            client.put_object,
            Bucket=get_settings().s3_bucket,
            Key=key,
            Body=webp,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )
    except StorageNotConfiguredError:
        logger.error("Загрузка изображения невозможна: не настроены параметры S3")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Хранилище изображений не настроено",
        ) from None
    except (BotoCoreError, ClientError):
        logger.exception("Не удалось загрузить объект %s", key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось сохранить изображение",
        ) from None

    logger.info("Загружено изображение %s (%s → %s байт)", key, len(raw), len(webp))
    return key


async def delete_image(key: str) -> None:
    """Удаляет объект. Отсутствие объекта ошибкой не считается."""
    try:
        client = await run_in_threadpool(_client)
        await run_in_threadpool(client.delete_object, Bucket=get_settings().s3_bucket, Key=key)
    except StorageNotConfiguredError:
        return
    except (BotoCoreError, ClientError):
        # Запись в БД уже удалена; осиротевший объект в хранилище не повод
        # ронять запрос — он попадёт в лог и вычистится отдельно
        logger.exception("Не удалось удалить объект %s", key)


async def ensure_bucket() -> None:
    """Создаёт бакет, если его нет.

    Нужно только для локального MinIO, который стартует пустым. На проде бакет
    заводится в панели Timeweb Cloud заранее, и вызов просто ничего не меняет.
    """
    settings = get_settings()
    try:
        client = await run_in_threadpool(_client)
    except StorageNotConfiguredError:
        logger.warning("S3 не настроен — загрузка изображений будет недоступна")
        return

    try:
        await run_in_threadpool(client.head_bucket, Bucket=settings.s3_bucket)
        return
    except ClientError:
        pass

    try:
        await run_in_threadpool(client.create_bucket, Bucket=settings.s3_bucket)
        logger.info("Создан бакет %s", settings.s3_bucket)
    except (BotoCoreError, ClientError):
        logger.exception("Не удалось создать бакет %s", settings.s3_bucket)
        return

    # Фотографии товаров показываются анонимным посетителям, поэтому на чтение
    # объектов открыт публичный доступ. Права на запись и на список объектов
    # при этом не выдаются: загружать и перечислять содержимое может только
    # владелец ключей.
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{settings.s3_bucket}/*"],
            }
        ],
    }
    try:
        await run_in_threadpool(
            client.put_bucket_policy,
            Bucket=settings.s3_bucket,
            Policy=json.dumps(policy),
        )
        logger.info("Для бакета %s включено публичное чтение объектов", settings.s3_bucket)
    except (BotoCoreError, ClientError):
        # На проде политика задаётся в панели провайдера, и прав на её смену
        # у приложения может не быть — это не повод падать при старте
        logger.warning(
            "Не удалось установить политику доступа для %s — настройте её в панели хранилища",
            settings.s3_bucket,
        )
