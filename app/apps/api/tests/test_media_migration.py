"""Перенос не меняет ключи, не удаляет источник и не затирает конфликты."""

import io

import boto3
import pytest

from app.core.config import get_settings
from app.services import media_migration, storage


@pytest.fixture
def legacy(monkeypatch):
    items = {"pages/a.webp": b"photo", "references/b.webp": b"private", "backups/c.dump": b"backup"}

    class Source:
        def head_bucket(self, **kwargs):
            pass

        def get_paginator(self, operation):
            return self

        def paginate(self, **kwargs):
            yield {"Contents": [{"Key": key, "Size": len(data)} for key, data in items.items()]}

        def get_object(self, *, Bucket, Key):
            return {"Body": io.BytesIO(items[Key])}

    monkeypatch.setattr(boto3, "client", lambda *a, **kw: Source())
    monkeypatch.setattr(get_settings(), "s3_endpoint_url", "http://legacy.invalid")
    return items


async def test_copy_verify_and_repeat(legacy):
    result = await media_migration.migrate()
    assert result["copied"] == result["verified"] == 3
    for key, data in legacy.items():
        assert await storage.read_object(key) == data
    repeated = await media_migration.migrate(verify_only=True)
    assert repeated["copied"] == 0
    assert repeated["verified"] == 3
    assert len(legacy) == 3


async def test_conflict_is_not_overwritten(legacy):
    await storage.write_object("pages/a.webp", b"different local version")
    with pytest.raises(ValueError, match="Контрольная сумма"):
        await media_migration.migrate()
    assert await storage.read_object("pages/a.webp") == b"different local version"
    assert legacy["pages/a.webp"] == b"photo"


async def test_database_destination_and_verification_without_original_files(
    legacy, monkeypatch, clean_settings
):
    monkeypatch.setattr(get_settings(), "media_storage", "database")
    try:
        result = await media_migration.migrate()
        assert result["copied"] == result["verified"] == 3
        for key, data in legacy.items():
            assert not storage.object_path(key).exists()
            assert await storage.read_object(key) == data
        repeated = await media_migration.migrate(verify_only=True)
        assert repeated["copied"] == 0 and repeated["verified"] == 3
    finally:
        for key in legacy:
            await storage.delete_image(key)
