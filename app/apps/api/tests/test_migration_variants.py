"""Миграции 005a туда и обратно на базе с данными.

Отдельная база `abrikosova_migrations`: в ней схема откатывается к состоянию
до вариантов, туда кладутся товары «как на проде», и миграции прогоняются
вперёд и назад. Тестовую базу остальных тестов это не трогает.

Что проверяется: у каждого товара появляется ровно один вариант с его ценой,
весом и порциями; подпись строится из веса, без веса — «Стандарт»; повод `kids`
переезжает в «Кому»; корзина и заказ получают вариант и снапшоты. Откат
возвращает всё как было.
"""

import os
import subprocess
import sys
from pathlib import Path

import asyncpg
import pytest

API_ROOT = Path(__file__).resolve().parent.parent
DATABASE = "abrikosova_migrations"
BEFORE = "0c28685cb7de"  # последняя ревизия до 005a

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


def _urls() -> tuple[str, str, str]:
    base = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
    plain = base.replace("postgresql+asyncpg://", "postgresql://")
    return f"{plain}/postgres", f"{plain}/{DATABASE}", f"{base}/{DATABASE}"


def _alembic(*args: str) -> None:
    _, _, sqlalchemy_url = _urls()
    env = os.environ | {"DATABASE_URL": sqlalchemy_url, "SCHEDULER_ENABLED": "false"}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr[-3000:]


@pytest.fixture
async def db():
    admin_url, url, _ = _urls()
    admin = await asyncpg.connect(admin_url)
    try:
        await admin.execute(f'DROP DATABASE IF EXISTS "{DATABASE}" WITH (FORCE)')
        await admin.execute(f'CREATE DATABASE "{DATABASE}"')
    finally:
        await admin.close()

    _alembic("upgrade", BEFORE)
    connection = await asyncpg.connect(url)
    try:
        yield connection
    finally:
        await connection.close()
        admin = await asyncpg.connect(admin_url)
        try:
            await admin.execute(f'DROP DATABASE IF EXISTS "{DATABASE}" WITH (FORCE)')
        finally:
            await admin.close()


async def _seed_old_schema(db) -> None:
    await db.execute(
        """
        INSERT INTO categories (id, name, slug, "order", is_active)
        VALUES (1, 'Торты', 'torty', 0, true);
        INSERT INTO subcategories (id, category_id, name, slug, "order", is_active,
                                   applies_fillings)
        VALUES (1, 1, 'Детские', 'detskie', 0, true, true);
        INSERT INTO products (id, name, slug, category_id, subcategory_id, price,
                              is_available, is_active, description, composition,
                              weight_grams, portions_min, portions_max, lead_time_days,
                              tags, occasions, dietary, is_featured, "order")
        VALUES
          (1, 'Молочная девочка', 'devochka', 1, 1, 3800, true, true, 'd', 'c',
           1500, 12, 15, 3, '{}', '{kids,birthday}', '{low_sugar}', false, 0),
          (2, 'Сертификат', 'sertifikat', 1, 1, 3000, true, true, 'd', 'c',
           NULL, NULL, NULL, 0, '{}', '{}', '{}', false, 1),
          (3, 'Медовик', 'medovik', 1, 1, 480, true, true, 'd', 'c',
           100, NULL, NULL, 0, '{}', '{tea}', '{}', false, 2);
        INSERT INTO carts (id) VALUES ('00000000-0000-0000-0000-000000000001');
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES ('00000000-0000-0000-0000-000000000001', 3, 2);
        INSERT INTO orders (id, order_number, customer_name, customer_phone,
                            delivery_method, consent_pd, total_price, status)
        VALUES (1, '20261007-AAAAAA', 'Марина', '+79001234567', 'pickup', true, 3800, 'new');
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (1, 1, 1, 3800);
        """
    )


async def test_variants_migration_round_trip(db) -> None:
    await _seed_old_schema(db)

    _alembic("upgrade", "head")

    variants = await db.fetch(
        "SELECT product_id, label, price, weight_grams, portions_min, portions_max"
        " FROM product_variants ORDER BY product_id"
    )
    assert [tuple(v) for v in variants] == [
        (1, "1,5 кг", 3800, 1500, 12, 15),
        (2, "Стандарт", 3000, None, None, None),
        (3, "100 г", 480, 100, None, None),
    ]
    # Цены у товара больше нет — одна правда, в вариантах
    columns = await db.fetch(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'products'"
    )
    assert {"price", "weight_grams", "portions_min"}.isdisjoint({c[0] for c in columns})

    kids = await db.fetchrow(
        "SELECT occasions::text[], recipients::text[] FROM products WHERE id = 1"
    )
    assert (kids[0], kids[1]) == (["birthday"], ["kids"])

    item = await db.fetchrow(
        "SELECT o.product_name, o.variant_label, v.product_id"
        " FROM order_items o JOIN product_variants v ON v.id = o.variant_id"
    )
    assert tuple(item) == ("Молочная девочка", "1,5 кг", 1)
    line = await db.fetchrow(
        "SELECT v.product_id, c.quantity FROM cart_items c"
        " JOIN product_variants v ON v.id = c.variant_id"
    )
    assert tuple(line) == (3, 2)

    _alembic("downgrade", BEFORE)

    products = await db.fetch(
        "SELECT id, price, weight_grams, portions_min, portions_max, occasions::text[]"
        " FROM products ORDER BY id"
    )
    assert [tuple(p) for p in products] == [
        (1, 3800, 1500, 12, 15, ["birthday", "kids"]),
        (2, 3000, None, None, None, []),
        (3, 480, 100, None, None, ["tea"]),
    ]
    assert await db.fetchval("SELECT product_id FROM cart_items") == 3
    assert await db.fetchval("SELECT to_regclass('product_variants')") is None

    # И снова вперёд — цепочка повторяема
    _alembic("upgrade", "head")
    assert await db.fetchval("SELECT count(*) FROM product_variants") == 3
