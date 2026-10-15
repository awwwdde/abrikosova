"""Резервное копирование базы данных.

Требование раздела 5.7 договора — функция бэкапа, управляемая **из админки**.
Автоматические снапшоты Managed PostgreSQL у Timeweb Cloud это не заменяет:
они не видны заказчице и не дают ей самой сделать копию перед рискованным
изменением. Оба уровня существуют параллельно.

Дамп снимается `pg_dump` в формате custom (`-Fc`) — он уже сжат и позволяет
восстанавливаться выборочно, в отличие от простого SQL-текста. Файл сразу
хранится в закрытой схеме PostgreSQL backup_storage, исключённой из дампа.
При явном выборе filesystem используется постоянный том приложения.
"""

import asyncio
import logging
import os
import tempfile
from datetime import UTC, datetime
from urllib.parse import urlparse

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.models import AdminSession, BackupRecord, BackupStatus, BackupType
from app.services import bakery_settings, storage
from app.services.storage import StorageNotConfiguredError

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


async def _run(command: list[str], password: str, timeout: int) -> bytes:
    env = {**os.environ, "PGPASSWORD": password}

    process = await asyncio.create_subprocess_exec(
        *command,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
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
    return stdout


def restore_table_list(toc: bytes) -> str:
    """Даже старые дампы не возвращают строки сессий; схему таблицы сохраняем."""
    return (
        "\n".join(
            line
            for line in toc.decode("utf-8").splitlines()
            if " TABLE DATA public admin_sessions " not in line
        )
        + "\n"
    )


async def create_backup(session: AsyncSession, backup_type: BackupType) -> BackupRecord:
    """Снимает дамп и кладёт его в закрытое хранилище резервных копий."""
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
                "--exclude-schema=backup_storage",
                "--no-owner",
                "--no-privileges",
                "--file",
                dump_path,
            ],
            password=params["password"],
            timeout=DUMP_TIMEOUT_SECONDS,
        )

        size = os.path.getsize(dump_path)

        await storage.write_file(key, dump_path)

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

    params = _connection_params()

    with tempfile.NamedTemporaryFile(suffix=".dump", delete=False) as tmp:
        dump_path = tmp.name
    list_path = None

    try:
        await storage.copy_to_file(record.storage_key, dump_path)
        toc = await _run(
            ["pg_restore", "--list", dump_path], password=params["password"], timeout=30
        )
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".list", delete=False
        ) as table_list:
            list_path = table_list.name
            table_list.write(restore_table_list(toc))

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
                "--single-transaction",
                "--use-list",
                list_path,
                dump_path,
            ],
            password=params["password"],
            timeout=RESTORE_TIMEOUT_SECONDS,
        )
        await invalidate_restored_sessions()
        logger.warning("База восстановлена из копии %s", record.storage_key)

    except StorageNotConfiguredError:
        raise BackupError("Хранилище не настроено") from None
    finally:
        os.unlink(dump_path)
        if list_path is not None:
            os.unlink(list_path)


async def invalidate_restored_sessions() -> None:
    """Старый дамп не должен возвращать доступ ранее отозванным токенам."""
    async with SessionLocal() as db:
        await db.execute(
            update(AdminSession)
            .where(AdminSession.revoked_at.is_(None))
            .values(revoked_at=clock.utc_now())
        )
        await db.commit()
    await bakery_settings.drop_cache()


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

    changed = False
    for record in pending:
        if not record.storage_key:
            continue
        try:
            size = await storage.object_size(record.storage_key)
        except (OSError, StorageNotConfiguredError, ValueError):
            continue
        if size is None:
            continue
        record.status = BackupStatus.SUCCESS
        record.size_bytes = size
        changed = True
        logger.info("Статус копии %s восстановлен по файлу", record.storage_key)

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
