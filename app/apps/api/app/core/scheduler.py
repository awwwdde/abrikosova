"""Плановые фоновые задачи.

Планировщик работает внутри процесса API — отдельного воркера и очереди
проект не держит (решение зафиксировано в 00-overview.md). Задач всего две,
обе редкие и короткие, поэтому отдельный деплой-юнит под них не оправдан.

Важно: при нескольких экземплярах приложения задачи запустятся в каждом.
Пока экземпляр один, это не проблема; при масштабировании планировщик нужно
либо оставить на одном экземпляре, либо добавить блокировку через Redis.
"""

import asyncio
import logging
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.core import clock
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import BackupType, Product
from app.services import backups, cart, retention, revalidate, sessions

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
            removed = await cart.purge_expired(session)
            logger.info("Удалено просроченных корзин: %s", removed)
        except Exception:
            logger.exception("Плановая очистка персональных данных не выполнена")


async def _nightly_sessions_cleanup() -> None:
    async with SessionLocal() as session:
        try:
            removed = await sessions.purge_ended(session)
            logger.info("Удалено закончившихся сессий админки: %s", removed)
        except Exception:
            logger.exception("Очистка сессий админки не выполнена")


async def refresh_sold_out_pages() -> list[str]:
    """Полночь по Москве (007a): товары, которые закончились вчера, снова в наличии —
    `sold_out_on` больше не сегодня, и API это уже знает. Но страницы товаров и
    каталога закэшированы ISR до 5 минут: сбрасываем их кэш сразу, чтобы
    «Закончилось сегодня» не висело после полуночи. Возвращает сброшенные адреса."""
    yesterday = clock.local_today() - timedelta(days=1)
    async with SessionLocal() as session:
        slugs = (
            await session.scalars(
                select(Product.slug).where(
                    Product.sold_out_on == yesterday, Product.is_active.is_(True)
                )
            )
        ).all()
    paths = sorted({path for slug in slugs for path in revalidate.catalog_paths(slug)})
    if paths:
        # revalidate_paths — синхронный HTTP-запрос к сайту: не держим им цикл событий
        await asyncio.to_thread(revalidate.revalidate_paths, paths)
    return paths


async def _midnight_sold_out() -> None:
    try:
        paths = await refresh_sold_out_pages()
        logger.info("Полночь: сброшен кэш %s страниц закончившихся вчера товаров", len(paths))
    except Exception:
        logger.exception("Сброс кэша закончившихся вчера товаров не выполнен")


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

    # Сессии админки, закончившиеся больше 30 дней назад (задание 011a)
    _scheduler.add_job(
        _nightly_sessions_cleanup,
        CronTrigger(hour=4, minute=30),
        id="nightly_sessions_cleanup",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Полночь по времени кондитерской, а не планировщика: «сегодня» у товара —
    # день BUSINESS_TIMEZONE. 5 секунд запаса — чтобы local_today() уже был новым днём
    _scheduler.add_job(
        _midnight_sold_out,
        CronTrigger(hour=0, minute=0, second=5, timezone=settings.business_timezone),
        id="midnight_sold_out",
        replace_existing=True,
        misfire_grace_time=600,
    )

    _scheduler.start()
    logger.info(
        "Планировщик запущен: кэш закончившихся в 00:00, бэкап в 03:30, очистка ПДн в 04:00, "
        "сессий в 04:30 (%s)",
        settings.scheduler_timezone,
    )


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
