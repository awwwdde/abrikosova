"""Медиа переживают потерю диска, а незавершённая запись не портит данные."""

import hashlib
import uuid

import pytest
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.media import BackupObject, MediaChunk, MediaObject
from app.services import database_media, storage


@pytest.fixture
async def db_media(monkeypatch):
    monkeypatch.setattr(get_settings(), "media_storage", "database")
    prefix = uuid.uuid4().hex
    yield prefix
    async with SessionLocal() as db:
        for model in (MediaObject, BackupObject):
            await db.execute(delete(model).where(model.key.contains(prefix)))
        await db.commit()


async def test_chunks_cache_loss_range_and_private_files(client, db_media, tmp_path):
    key = f"hero/{db_media}.mp4"
    data = b"video" * (database_media.CHUNK_SIZE // 2)
    await storage.write_object(key, data)
    async with SessionLocal() as db:
        row = await db.get(MediaObject, key)
        assert row.size == len(data) and row.sha256 == hashlib.sha256(data).hexdigest()
        chunks = list((await db.scalars(select(MediaChunk).where(MediaChunk.key == key))).all())
        assert len(chunks) == 3
        assert all(len(chunk.data) <= database_media.CHUNK_SIZE for chunk in chunks)
    response = await client.get("/media/" + key, headers={"Range": "bytes=5-15"})
    assert response.status_code == 206 and response.content == data[5:16]
    for file in (tmp_path / "media" / ".cache").iterdir():
        file.unlink()
    assert (await client.get("/media/" + key)).content == data
    assert (await client.head("/media/" + key)).status_code == 200
    for prefix in ("references", "backups"):
        private = f"{prefix}/{db_media}.webp"
        await storage.write_object(private, b"private")
        assert await storage.read_object(private) == b"private"
        assert (await client.get("/media/" + private)).status_code == 404
    await storage.delete_image(key)
    assert await storage.object_size(key) is None
    assert (await client.get("/media/" + key)).status_code == 404


async def test_failed_stream_preserves_previous_file(db_media):
    key = f"gallery/{db_media}.webp"
    await storage.write_object(key, b"original")

    class Interrupted:
        count = 0

        def read(self, size):
            assert size == database_media.CHUNK_SIZE
            self.count += 1
            if self.count == 1:
                return b"partial"
            raise OSError("interrupted")

    with pytest.raises(OSError):
        await storage.write_stream(key, Interrupted())
    assert await storage.read_object(key) == b"original"


async def test_disk_import_is_idempotent_and_retains_originals(db_media, clean_settings):
    key = f"gallery/{db_media}.webp"
    path = storage.object_path(key)
    path.parent.mkdir(parents=True)
    path.write_bytes(b"legacy")
    assert await storage.import_legacy_files() == 1
    assert await storage.import_legacy_files() == 0
    assert path.read_bytes() == b"legacy"
    await storage.delete_image(key)
    assert not path.exists()
    assert await storage.import_legacy_files() == 0


async def test_stream_copy_for_backup_does_not_require_local_original(db_media, tmp_path):
    key = f"backups/{db_media}.dump"
    source, target = tmp_path / "source", tmp_path / "target"
    source.write_bytes(b"database" * 300000)
    await storage.write_file(key, str(source))
    source.unlink()
    await storage.copy_to_file(key, str(target))
    assert target.stat().st_size == 2400000
    assert target.read_bytes() == b"database" * 300000
