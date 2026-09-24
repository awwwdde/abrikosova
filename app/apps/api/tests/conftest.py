"""Общие фикстуры тестов.

Тесты работают с настоящими PostgreSQL и Redis из docker-compose: фильтры
по массивам enum, CHECK-ограничения и GIN-индексы — поведение конкретной СУБД,
и на SQLite или моках его не проверить.

Каждый тест, которому нужен каталог, получает собственную изолированную
категорию со своими товарами и после себя её удаляет. На демо-данные из seed
тесты не опираются: их правят руками, и тесты не должны от этого краснеть.
"""

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
from app.core.security import create_access_token, hash_password
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
    Review,
    SubCategory,
)


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
    keys = [key async for key in redis.scan_iter("ratelimit:*")]
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


@pytest.fixture
async def catalog() -> AsyncIterator[CatalogFixture]:
    """Три товара, покрывающие все оси фильтров.

    * kids-cake — детский торт под заказ (3 дня), 12–15 порций, сниженный сахар;
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

        def make(slug: str, **fields) -> Product:
            defaults = {
                "name": slug,
                "slug": f"{slug}-{suffix}",
                "category_id": category.id,
                "subcategory_id": sub_id,
                "description": "Тест",
                "composition": "Тест",
            }
            return Product(**(defaults | fields))

        products = [
            make(
                "kids-cake",
                price=Decimal("3800"),
                weight_grams=1500,
                portions_min=12,
                portions_max=15,
                lead_time_days=3,
                occasions=[Occasion.KIDS, Occasion.BIRTHDAY],
                dietary=[DietaryTag.LOW_SUGAR],
            ),
            make(
                "gf-cookie",
                price=Decimal("350"),
                weight_grams=180,
                portions_min=3,
                portions_max=4,
                occasions=[Occasion.TEA],
                dietary=[DietaryTag.GLUTEN_FREE, DietaryTag.LACTOSE_FREE],
            ),
            make(
                "gift-box",
                price=Decimal("1600"),
                weight_grams=240,
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
            password_hash=hash_password("not-used-in-tests"),
            role=AdminRole.OWNER,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        admin_id = admin.id

    token, _ = create_access_token(str(admin_id), AdminRole.OWNER.value)
    yield {"Authorization": f"Bearer {token}"}

    async with SessionLocal() as session:
        await session.execute(delete(AdminUser).where(AdminUser.id == admin_id))
        await session.commit()
