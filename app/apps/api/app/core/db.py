from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# echo не используется: он вешает собственный обработчик SQLAlchemy, и каждая запись
# выходила в лог дважды. Поток SQL включается через SQL_ECHO в setup_logging.
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Базовый класс SQLAlchemy-моделей. Сами модели — Этап 1, по new/spec/01-data-model.md."""


async def get_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
