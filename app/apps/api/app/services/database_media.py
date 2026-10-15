"""PostgreSQL — источник файлов; диск нужен только для временного кэша выдачи."""

import hashlib
import os
import tempfile
from pathlib import Path
from typing import BinaryIO

from sqlalchemy import delete, func, insert, select
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.media import BackupChunk, BackupObject, MediaChunk, MediaObject

CHUNK_SIZE = 1024 * 1024


def models(key):
    return (BackupObject, BackupChunk) if key.startswith("backups/") else (MediaObject, MediaChunk)


async def write(key: str, source: BinaryIO) -> None:
    obj, chunk = models(key)
    async with SessionLocal() as db:
        # Повторная запись того же ключа атомарна и не смешивает части двух файлов.
        await db.execute(select(func.pg_advisory_xact_lock(func.hashtext("media:" + key))))
        await db.execute(delete(obj).where(obj.key == key))
        row = obj(key=key, size=0, sha256="")
        db.add(row)
        await db.flush()
        digest = hashlib.sha256()
        size = 0
        number = 0
        while data := await run_in_threadpool(source.read, CHUNK_SIZE):
            digest.update(data)
            size += len(data)
            await db.execute(insert(chunk).values(key=key, number=number, data=data))
            number += 1
        row.size, row.sha256 = size, digest.hexdigest()
        await db.commit()


async def size(key: str) -> int | None:
    obj, _ = models(key)
    async with SessionLocal() as db:
        return await db.scalar(select(obj.size).where(obj.key == key))


async def _copy(db, key, target: str) -> None:
    _, chunk = models(key)
    rows = await db.stream_scalars(
        select(chunk.data)
        .where(chunk.key == key)
        .order_by(chunk.number)
        .execution_options(yield_per=1)
    )
    with open(target, "wb") as out:
        async for data in rows:
            await run_in_threadpool(out.write, data)


async def copy_to_file(key: str, target: str) -> None:
    obj, _ = models(key)
    async with SessionLocal() as db:
        await db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
        if await db.get(obj, key) is None:
            raise FileNotFoundError(key)
        await _copy(db, key, target)


async def materialize(key: str) -> Path | None:
    obj, _ = models(key)
    async with SessionLocal() as db:
        await db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
        row = await db.get(obj, key)
        if row is None:
            return None
        directory = Path(get_settings().media_root) / ".cache"
        await run_in_threadpool(directory.mkdir, parents=True, exist_ok=True, mode=0o750)
        path = directory / (row.sha256 + Path(key).suffix)
        if path.is_file() and path.stat().st_size == row.size:
            return path
        with tempfile.NamedTemporaryFile(dir=directory, delete=False) as file:
            temporary = file.name
        try:
            await _copy(db, key, temporary)
            await run_in_threadpool(os.replace, temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)
        return path


async def remove(key: str) -> None:
    obj, _ = models(key)
    async with SessionLocal() as db:
        row = await db.get(obj, key)
        if row is None:
            return
        sha = row.sha256
        await db.delete(row)
        await db.commit()
    path = Path(get_settings().media_root) / ".cache" / (sha + Path(key).suffix)
    await run_in_threadpool(path.unlink, missing_ok=True)
