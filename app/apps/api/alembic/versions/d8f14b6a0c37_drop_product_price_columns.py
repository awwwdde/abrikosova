"""drop product price columns

Задание 005a: цена, вес и порции теперь только у вариантов товара. Колонки
товара удаляются отдельной миграцией после переноса (`a5c3e7d91b42`), чтобы
не осталось двух правд о цене. Заодно корзина перестаёт хранить `product_id`:
товар однозначно определяется вариантом.

Откат восстанавливает колонки из варианта по умолчанию (первого по порядку,
активные — раньше выключенных). Цены остальных вариантов в старой схеме
выразить нечем.

Revision ID: d8f14b6a0c37
Revises: a5c3e7d91b42
Create Date: 2026-10-07 23:05:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d8f14b6a0c37"
down_revision: str | Sequence[str] | None = "a5c3e7d91b42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_product_price_positive", "products", type_="check")
    op.drop_constraint("ck_product_weight_positive", "products", type_="check")
    op.drop_constraint("ck_product_portions_range", "products", type_="check")
    for column in ("price", "weight_grams", "portions_min", "portions_max"):
        op.drop_column("products", column)

    # Внешний ключ удаляется вместе с колонкой
    op.drop_column("cart_items", "product_id")


def downgrade() -> None:
    op.add_column("cart_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE cart_items AS c SET product_id = v.product_id
        FROM product_variants AS v WHERE v.id = c.variant_id
        """
    )
    op.alter_column("cart_items", "product_id", nullable=False)
    op.create_foreign_key(
        "cart_items_product_id_fkey",
        "cart_items",
        "products",
        ["product_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.add_column("products", sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column("products", sa.Column("weight_grams", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("portions_min", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("portions_max", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE products AS p
        SET price = v.price, weight_grams = v.weight_grams,
            portions_min = v.portions_min, portions_max = v.portions_max
        FROM (
            SELECT DISTINCT ON (product_id) *
            FROM product_variants
            ORDER BY product_id, is_active DESC, "order", id
        ) AS v
        WHERE v.product_id = p.id
        """
    )
    op.alter_column("products", "price", nullable=False)
    op.create_check_constraint("ck_product_price_positive", "products", "price > 0")
    op.create_check_constraint(
        "ck_product_weight_positive", "products", "weight_grams IS NULL OR weight_grams > 0"
    )
    op.create_check_constraint(
        "ck_product_portions_range",
        "products",
        "(portions_min IS NULL AND portions_max IS NULL)"
        " OR (portions_min >= 1 AND portions_max >= portions_min)",
    )
