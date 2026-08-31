from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Базовый класс SQLAlchemy-моделей. Сами модели — Этап 1, по new/spec/01-data-model.md."""


async def get_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
