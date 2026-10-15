"""Разовый перенос прежнего S3 в выбранное хранилище; исходники не удаляются."""

import hashlib
from collections import Counter

from app.core.config import get_settings
from app.services import storage


class _HashingReader:
    def __init__(self, source):
        self.source = source
        self.digest = hashlib.sha256()

    def read(self, size=-1):
        chunk = self.source.read(size)
        self.digest.update(chunk)
        return chunk


async def migrate(*, verify_only: bool = False) -> dict:
    # SDK нужен только этой команде, в рабочем приложении его нет.
    import boto3

    settings = get_settings()
    if not settings.s3_endpoint_url:
        raise ValueError("Задайте S3_ENDPOINT_URL для разового переноса")
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )
    client.head_bucket(Bucket=settings.s3_bucket)
    await storage.ensure_storage()
    copied = verified = total_bytes = 0
    prefixes = Counter()
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=settings.s3_bucket):
        for item in page.get("Contents", []):
            key = item["Key"]
            if key.endswith("/"):
                continue
            missing = await storage.object_size(key) is None
            if missing and verify_only:
                raise ValueError("В хранилище отсутствует файл")
            response = client.get_object(Bucket=settings.s3_bucket, Key=key)
            source = response["Body"]
            # Хешируем именно полученные байты; ETag ненадёжен для multipart.
            reader = _HashingReader(source)
            try:
                if missing:
                    await storage.write_stream(key, reader)
                    copied += 1
                else:
                    while reader.read(1024 * 1024):
                        pass
            finally:
                source.close()
            path = await storage.materialize(key)
            if path is None:
                raise ValueError("В хранилище отсутствует файл")
            with path.open("rb") as destination:
                actual = hashlib.file_digest(destination, "sha256").digest()
            if actual != reader.digest.digest() or path.stat().st_size != item["Size"]:
                raise ValueError("Контрольная сумма файла не совпала; исходник сохранён")
            verified += 1
            total_bytes += item["Size"]
            prefixes[key.split("/", 1)[0]] += 1
    return {
        "copied": copied,
        "verified": verified,
        "bytes": total_bytes,
        "prefixes": dict(prefixes),
    }
