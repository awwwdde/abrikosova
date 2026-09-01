"""Плановые фоновые задачи.

Планировщик работает внутри процесса API — отдельного воркера и очереди
проект не держит (решение зафиксировано в 00-overview.md). Задач всего две,
обе редкие и короткие, поэтому отдельный деплой-юнит под них не оправдан.

Важно: при нескольких экземплярах приложения задачи запустятся в каждом.
Пока экземпляр один, это не проблема; при масштабировании планировщик нужно
либо оставить на одном экземпляре, либо добавить блокировку через Redis.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import BackupType
from app.services import backups, retention

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _nightly_backup() -> None:
    async with SessionLocal() as session:
        try:
            await backups.create_backup(session, BackupType.AUTO)
        except Exception:
            # Планировщик не должен умирать из-за одной неудачной ночи
            logger.exception("Плановая резервная копия не создана")


async def _nightly_purge() -> None:
    async with SessionLocal() as session:
        try:
            await retention.purge_expired(session)
        except Exception:
            logger.exception("Плановая очистка персональных данных не выполнена")


def start() -> None:
    global _scheduler

    settings = get_settings()
    if not settings.scheduler_enabled:
        logger.info("Планировщик выключен настройкой SCHEDULER_ENABLED")
        return

    _scheduler = AsyncIOScheduler(timezone=settings.scheduler_timezone)

    # Ночью нагрузка минимальна, а дамп базы её заметно даёт
    _scheduler.add_job(
        _nightly_backup,
        CronTrigger(hour=3, minute=30),
        id="nightly_backup",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        _nightly_purge,
        CronTrigger(hour=4, minute=0),
        id="nightly_purge",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    _scheduler.start()
    logger.info(
        "Планировщик запущен: бэкап в 03:30, очистка ПДн в 04:00 (%s)", settings.scheduler_timezone
    )


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
