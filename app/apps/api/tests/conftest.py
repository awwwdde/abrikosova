"""Общие фикстуры тестов.

Тесты работают с настоящими PostgreSQL и Redis из docker-compose: фильтры
по массивам enum, CHECK-ограничения и GIN-индексы — поведение конкретной СУБД,
и на SQLite или моках его не проверить.

Каждый тест, которому нужен каталог, получает собственную изолированную
категорию со своими товарами и после себя её удаляет. На демо-данные из seed
тесты не опираются: их правят руками, и тесты не должны от этого краснеть.
"""

# --- Отдельная база для тестов (011c) ---
# До импорта приложения: настройки и движок SQLAlchemy читают DATABASE_URL при
# импорте `app.*`. Тесты работают в базе `abrikosova_test` того же PostgreSQL и в
# Redis-базе 1, поэтому их заказы, сотрудники и записи журнала больше не попадают
# в базу разработки (раньше лента «Последние действия» была полна `test-…@example.com`).
import os

TEST_DATABASE = "abrikosova_test"
_dev_url = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://abrikosova:abrikosova@localhost:5432/abrikosova"
)
os.environ["DATABASE_URL"] = _dev_url.rsplit("/", 1)[0] + f"/{TEST_DATABASE}"
_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
os.environ["REDIS_URL"] = _redis_url.rsplit("/", 1)[0] + "/1"
# Включённые локальные интеграции не должны отправлять реальные уведомления
# при прогоне тестов; тесты интеграций задают свои параметры явно.
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_CHAT_ID"] = ""
os.environ["SMTP_HOST"] = ""

import asyncio
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import delete, select

from app.core.db import SessionLocal, engine
from app.core.redis import close_redis, get_redis
from app.core.security import hash_password
from app.main import app
from app.models import (
    AdminRole,
    AdminUser,
    Category,
    DietaryTag,
    Occasion,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    Recipient,
    Review,
    SiteSetting,
    SubCategory,
)
from app.services import bakery_settings, sessions


@pytest.fixture(autouse=True)
def isolated_media(tmp_path, monkeypatch):
    # Тесты не пишут в постоянный том с настоящими фото и приватными образцами.
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "media_root", str(tmp_path / "media"))
    monkeypatch.setattr(get_settings(), "media_storage", "filesystem")


def pytest_sessionstart(session) -> None:
    """Один раз за прогон: создать тестовую базу, если её нет, и накатить миграции.

    Миграциями, а не `Base.metadata.create_all`: так тесты заодно проверяют, что
    цепочка ревизий собирает ту же схему, что и на проде. Сид не нужен — тесты
    создают свои данные сами (см. docstring модуля).
    """
    import asyncpg
    from alembic.config import Config

    from alembic import command

    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    admin_url = url.rsplit("/", 1)[0] + "/postgres"

    async def ensure_database() -> None:
        connection = await asyncpg.connect(admin_url)
        try:
            exists = await connection.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DATABASE
            )
            if not exists:
                await connection.execute(f'CREATE DATABASE "{TEST_DATABASE}"')
        finally:
            await connection.close()

    asyncio.run(ensure_database())
    command.upgrade(Config("alembic.ini"), "head")
    # env.py Alembic зовёт logging.config.fileConfig, а тот по умолчанию отключает
    # все уже созданные логгеры — и тесты на caplog видели пустой лог
    import logging

    for logger in logging.root.manager.loggerDict.values():
        if isinstance(logger, logging.Logger):
            logger.disabled = False
    asyncio.run(_ensure_pages())


async def _ensure_pages() -> None:
    """Контент страниц из сида: тесты редактора страниц и главной читают его как
    данные, которые «всегда есть». Остальной сид (каталог с фото в хранилище)
    тестам не нужен — они создают свои товары."""
    import copy

    from app.models import PageContent
    from app.models.enums import PageKey
    from app.seed import CONTACTS_FIELDS, PAGE_CONTENT

    async with SessionLocal() as session:
        existing = set((await session.scalars(select(PageContent.page_key))).all())
        content = copy.deepcopy(PAGE_CONTENT)
        for page_key in PageKey:
            if page_key in existing:
                continue
            extra = CONTACTS_FIELDS if page_key is PageKey.CONTACTS else {}
            session.add(PageContent(page_key=page_key, content=content[page_key], **extra))
        await session.commit()
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _dispose_engine():
    """Закрывает соединения с БД и Redis после каждого теста.

    pytest-asyncio создаёт для каждого теста свой цикл событий, а движок
    SQLAlchemy — модульный и держит соединения в пуле. Соединение, открытое
    в одном цикле, к следующему тесту оказывается привязано к уже закрытому
    циклу — и падает при попытке использования. Освобождаем пул, пока цикл
    ещё жив.
    """
    yield
    await engine.dispose()
    # С клиентом Redis та же история: его пул соединений привязан к циклу,
    # в котором он создан. Закрываем — следующий тест создаст новый.
    await close_redis()


@pytest.fixture(autouse=True)
async def _reset_rate_limits():
    """Сбрасывает счётчики rate limiting, чтобы тесты не упирались в 429.

    Удаляются только ключи лимитов, а не вся база Redis: в ней же живёт
    allowlist refresh-токенов разработчика.
    """
    redis = get_redis()
    # Счётчики лимитов и блокировок входа (задание 011a) — у каждого теста свои
    keys = [key async for key in redis.scan_iter("ratelimit:*")]
    keys += [key async for key in redis.scan_iter("login:*")]
    keys += [key async for key in redis.scan_iter("admin_session_alive:*")]
    if keys:
        await redis.delete(*keys)
    yield


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@dataclass
class CatalogFixture:
    """Изолированный кусок каталога для одного теста."""

    category_slug: str
    category_id: int
    subcategory_id: int
    foreign_subcategory_id: int
    # slug → id
    products: dict[str, int]
    # slug → id варианта по умолчанию (у тестовых товаров он единственный)
    variants: dict[str, int]

    def order_item(self, slug: str, quantity: int, price: str) -> OrderItem:
        """Позиция заказа на товар фикстуры — для тестов, собирающих заказ напрямую."""
        return OrderItem(
            product_id=self.products[slug],
            variant_id=self.variants[slug],
            product_name=slug,
            variant_label="Тест",
            quantity=quantity,
            price=Decimal(price),
        )


@pytest.fixture
async def catalog() -> AsyncIterator[CatalogFixture]:
    """Три товара, покрывающие все оси фильтров. У каждого один вариант.

    * kids-cake — детский торт (кому: для детей) под заказ (3 дня), 12–15 порций,
      сниженный сахар, можно надпись;
    * gf-cookie — печенье в наличии, 3–4 порции, без глютена и без лактозы;
    * gift-box — набор без порций, снят с продажи (is_available=false).
    """
    suffix = uuid.uuid4().hex[:8]
    async with SessionLocal() as session:
        category = Category(name=f"Тест {suffix}", slug=f"test-{suffix}")
        category.subcategories = [SubCategory(name="Тестовая", slug=f"sub-{suffix}")]
        other = Category(name=f"Чужая {suffix}", slug=f"other-{suffix}")
        other.subcategories = [SubCategory(name="Чужая", slug=f"other-sub-{suffix}")]
        session.add_all([category, other])
        await session.flush()

        sub_id = category.subcategories[0].id

        def make(slug: str, variant: dict, **fields) -> Product:
            defaults = {
                "name": slug,
                "slug": f"{slug}-{suffix}",
                "category_id": category.id,
                "subcategory_id": sub_id,
                "description": "Тест",
                "composition": "Тест",
            }
            product = Product(**(defaults | fields))
            product.variants = [ProductVariant(order=0, **variant)]
            return product

        products = [
            make(
                "kids-cake",
                {
                    "label": "1,5 кг",
                    "price": Decimal("3800"),
                    "weight_grams": 1500,
                    "portions_min": 12,
                    "portions_max": 15,
                },
                lead_time_days=3,
                occasions=[Occasion.BIRTHDAY],
                recipients=[Recipient.KIDS],
                dietary=[DietaryTag.LOW_SUGAR],
                allows_inscription=True,
            ),
            make(
                "gf-cookie",
                {
                    "label": "180 г",
                    "price": Decimal("350"),
                    "weight_grams": 180,
                    "portions_min": 3,
                    "portions_max": 4,
                },
                occasions=[Occasion.TEA],
                dietary=[DietaryTag.GLUTEN_FREE, DietaryTag.LACTOSE_FREE],
            ),
            make(
                "gift-box",
                {"label": "240 г", "price": Decimal("1600"), "weight_grams": 240},
                is_available=False,
                occasions=[Occasion.CORPORATE],
            ),
        ]
        session.add_all(products)
        await session.commit()

        result = CatalogFixture(
            category_slug=category.slug,
            category_id=category.id,
            subcategory_id=sub_id,
            foreign_subcategory_id=other.subcategories[0].id,
            products={p.slug.removesuffix(f"-{suffix}"): p.id for p in products},
            variants={p.slug.removesuffix(f"-{suffix}"): p.variants[0].id for p in products},
        )

    yield result

    # Уборка в порядке зависимостей: заказы держат товары через RESTRICT
    async with SessionLocal() as session:
        product_ids = list(
            (
                await session.scalars(
                    select(Product.id).where(
                        Product.category_id.in_([result.category_id, other.id])
                    )
                )
            ).all()
        )
        order_ids = select(OrderItem.order_id).where(OrderItem.product_id.in_(product_ids))
        await session.execute(delete(Order).where(Order.id.in_(order_ids)))
        await session.execute(delete(Review).where(Review.product_id.in_(product_ids)))
        await session.execute(delete(Product).where(Product.id.in_(product_ids)))
        await session.execute(
            delete(Category).where(Category.id.in_([result.category_id, other.id]))
        )
        await session.commit()


@pytest.fixture
async def admin_headers() -> AsyncIterator[dict[str, str]]:
    """Заголовок авторизации временного администратора-владельца."""
    async with SessionLocal() as session:
        admin = AdminUser(
            email=f"test-{uuid.uuid4().hex[:8]}@example.com",
            name="Тест Владелец",
            password_hash=hash_password("not-used-in-tests"),
            role=AdminRole.OWNER,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        admin_id = admin.id

    # Токен — на настоящую серверную сессию: без sid get_current_admin его не примет
    async with SessionLocal() as session:
        admin = await session.get(AdminUser, admin_id)
        admin_session = await sessions.create(session, admin, "127.0.0.1", "pytest")
        await session.commit()
        token, _ = sessions.issue_tokens(admin, admin_session)
    yield {"Authorization": f"Bearer {token}"}

    async with SessionLocal() as session:
        await session.execute(delete(AdminUser).where(AdminUser.id == admin_id))
        await session.commit()


@pytest.fixture
async def manager_headers() -> AsyncIterator[dict[str, str]]:
    """Заголовок авторизации менеджера «Ольга Тихонова» — для проверок 403 и ленты."""
    async with SessionLocal() as session:
        admin = AdminUser(
            email=f"manager-{uuid.uuid4().hex[:8]}@example.com",
            name="Ольга Тихонова",
            password_hash=hash_password("not-used-in-tests"),
            role=AdminRole.MANAGER,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        admin_session = await sessions.create(session, admin, "127.0.0.1", "pytest")
        await session.commit()
        token, _ = sessions.issue_tokens(admin, admin_session)
        admin_id = admin.id
    yield {"Authorization": f"Bearer {token}"}
    async with SessionLocal() as session:
        await session.execute(delete(AdminUser).where(AdminUser.id == admin_id))
        await session.commit()


@pytest.fixture
async def clean_settings():
    """Настройки кондитерской — значения по умолчанию на время теста (011c, 005a)."""
    async with SessionLocal() as session:
        await session.execute(delete(SiteSetting))
        await session.commit()
    await bakery_settings.drop_cache()
    yield
    async with SessionLocal() as session:
        await session.execute(delete(SiteSetting))
        await session.commit()
    await bakery_settings.drop_cache()
