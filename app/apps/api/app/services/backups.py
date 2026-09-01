"""Резервное копирование базы данных.

Требование раздела 5.7 договора — функция бэкапа, управляемая **из админки**.
Автоматические снапшоты Managed PostgreSQL у Timeweb Cloud это не заменяет:
они не видны заказчице и не дают ей самой сделать копию перед рискованным
изменением. Оба уровня существуют параллельно.

Дамп снимается `pg_dump` в формате custom (`-Fc`) — он уже сжат и позволяет
восстанавливаться выборочно, в отличие от простого SQL-текста. Файл сразу
уходит в объектное хранилище: локальный диск приложения на App Platform не
переживает передеплой.
"""

import asyncio
import logging
import os
import tempfile
from datetime import UTC, datetime
from urllib.parse import urlparse

from botocore.exceptions import ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.db import engine
from app.models import BackupRecord, BackupStatus, BackupType
from app.services.storage import StorageNotConfiguredError, _client

logger = logging.getLogger(__name__)

# Дамп базы может идти долго, но не бесконечно: зависший процесс займёт
# соединение и место на диске контейнера
DUMP_TIMEOUT_SECONDS = 600
RESTORE_TIMEOUT_SECONDS = 900


class BackupError(Exception):
    """Не удалось снять или восстановить копию."""


def _connection_params() -> dict[str, str]:
    """Разбирает DSN приложения в параметры для pg_dump.

    Пароль передаётся через переменную окружения PGPASSWORD, а не аргументом
    командной строки: аргументы видны в списке процессов любому, кто имеет
    доступ к контейнеру.
    """
    url = urlparse(get_settings().database_url.replace("postgresql+asyncpg://", "postgresql://"))

    if not (url.hostname and url.path):
        raise BackupError("Некорректная строка подключения к базе")

    return {
        "host": url.hostname,
        "port": str(url.port or 5432),
        "user": url.username or "",
        "password": url.password or "",
        "dbname": url.path.lstrip("/"),
    }


async def _run(command: list[str], password: str, timeout: int) -> None:
    env = {**os.environ, "PGPASSWORD": password}

    process = await asyncio.create_subprocess_exec(
        *command,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError:
        process.kill()
        raise BackupError(f"Операция не завершилась за {timeout} секунд") from None

    if process.returncode != 0:
        # Текст ошибки postgres в лог пускаем, но наружу не отдаём: он может
        # содержать имена схем и хост базы
        logger.error(
            "%s завершился с кодом %s: %s",
            command[0],
            process.returncode,
            stderr.decode(errors="replace")[:500],
        )
        raise BackupError("Не удалось выполнить операцию с базой данных")


async def create_backup(session: AsyncSession, backup_type: BackupType) -> BackupRecord:
    """Снимает дамп и кладёт его в объектное хранилище."""
    settings = get_settings()
    params = _connection_params()

    record = BackupRecord(
        storage_key="",
        type=backup_type,
        status=BackupStatus.PENDING,
    )
    session.add(record)
    # Фиксируем запись ДО снятия дампа. Иначе pg_dump снимает снимок, в котором
    # этой строки ещё нет, и после восстановления из такой копии история
    # резервных копий оказывается пустой — восстановиться повторно не из чего.
    # В самом дампе запись будет со статусом pending; её чинит _reconcile ниже.
    await session.commit()

    key = f"backups/{datetime.now(UTC):%Y/%m/%d}/backup-{record.id}-{datetime.now(UTC):%H%M%S}.dump"
    # Ключ тоже фиксируем заранее: по нему reconcile() найдёт файл в хранилище,
    # если запись вернётся из дампа со статусом pending
    record.storage_key = key
    await session.commit()

    # Дамп пишется во временный файл: держать всю базу в памяти нельзя
    with tempfile.NamedTemporaryFile(suffix=".dump", delete=False) as tmp:
        dump_path = tmp.name

    try:
        await _run(
            [
                "pg_dump",
                "--host",
                params["host"],
                "--port",
                params["port"],
                "--username",
                params["user"],
                "--dbname",
                params["dbname"],
                "--format",
                "custom",
                "--no-owner",
                "--no-privileges",
                "--file",
                dump_path,
            ],
            password=params["password"],
            timeout=DUMP_TIMEOUT_SECONDS,
        )

        size = os.path.getsize(dump_path)

        client = await run_in_threadpool(_client)
        with open(dump_path, "rb") as dump_file:
            await run_in_threadpool(
                client.put_object,
                Bucket=settings.s3_bucket,
                Key=key,
                Body=dump_file,
                ContentType="application/octet-stream",
            )

        record.storage_key = key
        record.size_bytes = size
        record.status = BackupStatus.SUCCESS
        logger.info("Создана резервная копия %s (%s байт)", key, size)

    except StorageNotConfiguredError:
        record.status = BackupStatus.FAILED
        logger.error("Резервная копия не сохранена: хранилище не настроено")
        raise BackupError("Хранилище не настроено") from None
    except Exception:
        record.status = BackupStatus.FAILED
        logger.exception("Не удалось создать резервную копию")
        raise
    finally:
        # Временный файл удаляем в любом случае: в нём вся база целиком
        os.unlink(dump_path)
        await session.commit()

    return record


async def restore_backup(session: AsyncSession, backup_id: int) -> None:
    """Восстанавливает базу из копии.

    Операция необратима и затирает текущие данные, поэтому вызывается только
    владельцем и только после явного подтверждения в интерфейсе.
    """
    record = await session.get(BackupRecord, backup_id)
    if record is None or record.status is not BackupStatus.SUCCESS:
        raise BackupError("Копия не найдена или снята с ошибкой")

    settings = get_settings()
    params = _connection_params()

    with tempfile.NamedTemporaryFile(suffix=".dump", delete=False) as tmp:
        dump_path = tmp.name

    try:
        client = await run_in_threadpool(_client)
        response = await run_in_threadpool(
            client.get_object, Bucket=settings.s3_bucket, Key=record.storage_key
        )
        with open(dump_path, "wb") as dump_file:
            dump_file.write(response["Body"].read())

        logger.warning(
            "ВОССТАНОВЛЕНИЕ базы из копии %s — текущие данные будут заменены", record.storage_key
        )

        # pg_restore --clean удаляет таблицы, а для этого нужна исключительная
        # блокировка. Пока приложение держит соединения в пуле, DROP просто
        # виснет в ожидании — проверено, запрос не завершался.
        #
        # Поэтому сначала отпускаем свои соединения, затем разрываем чужие.
        # Шаг осознанно разрушительный: запросы, выполняющиеся прямо сейчас,
        # оборвутся. Для операции, которая и так затирает всю базу, это
        # приемлемо — и именно поэтому она требует явного подтверждения.
        await session.close()
        await engine.dispose()
        await _terminate_other_connections(params)

        await _run(
            [
                "pg_restore",
                "--host",
                params["host"],
                "--port",
                params["port"],
                "--username",
                params["user"],
                "--dbname",
                params["dbname"],
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-privileges",
                dump_path,
            ],
            password=params["password"],
            timeout=RESTORE_TIMEOUT_SECONDS,
        )
        logger.warning("База восстановлена из копии %s", record.storage_key)

    except StorageNotConfiguredError:
        raise BackupError("Хранилище не настроено") from None
    finally:
        os.unlink(dump_path)


async def _terminate_other_connections(params: dict[str, str]) -> None:
    """Разрывает остальные соединения с базой перед восстановлением.

    Имя базы приходит из строки подключения приложения, а не от пользователя,
    поэтому подстановка в SQL здесь безопасна.
    """
    await _run(
        [
            "psql",
            "--host",
            params["host"],
            "--port",
            params["port"],
            "--username",
            params["user"],
            "--dbname",
            params["dbname"],
            "--quiet",
            "--command",
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname = '{params['dbname']}' AND pid <> pg_backend_pid();",
        ],
        password=params["password"],
        timeout=30,
    )
    logger.warning("Соединения с базой разорваны для восстановления")


async def reconcile(session: AsyncSession) -> None:
    """Сверяет записи о копиях с содержимым хранилища.

    Нужна после восстановления: в дампе копия, из которой восстанавливались,
    записана со статусом pending (на момент снимка она ещё снималась), а файл
    при этом существует. Без сверки такая копия навсегда осталась бы
    «выполняющейся» и недоступной для повторного восстановления.
    """
    query = select(BackupRecord).where(BackupRecord.status == BackupStatus.PENDING)
    pending = list((await session.scalars(query)).all())
    if not pending:
        return

    try:
        client = await run_in_threadpool(_client)
    except StorageNotConfiguredError:
        return

    settings = get_settings()
    changed = False

    for record in pending:
        if not record.storage_key:
            continue
        try:
            head = await run_in_threadpool(
                client.head_object, Bucket=settings.s3_bucket, Key=record.storage_key
            )
        except ClientError:
            continue

        record.status = BackupStatus.SUCCESS
        record.size_bytes = head.get("ContentLength")
        changed = True
        logger.info("Статус копии %s восстановлен по файлу в хранилище", record.storage_key)

    if changed:
        await session.commit()


async def list_backups(session: AsyncSession, limit: int = 50) -> list[BackupRecord]:
    await reconcile(session)
    query = select(BackupRecord).order_by(BackupRecord.created_at.desc()).limit(limit)
    return list((await session.scalars(query)).all())


async def delete_backup(session: AsyncSession, backup_id: int) -> None:
    record = await session.get(BackupRecord, backup_id)
    if record is None:
        return

    key = record.storage_key
    await session.delete(record)
    await session.commit()

    if key:
        from app.services.storage import delete_image

        await delete_image(key)
