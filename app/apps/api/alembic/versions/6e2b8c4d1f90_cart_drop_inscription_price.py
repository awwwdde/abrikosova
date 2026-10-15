"""cart drop inscription price

Ревью 005a: цена надписи — на момент заказа, как и цена варианта. Корзина больше
не хранит её снимок: показывает и передаёт в заказ текущую цену из настроек.
Снимок в `order_items.inscription_price` остаётся — это история заказа.

Откат возвращает колонку и заполняет её текущей ценой из настроек (или 300 ₽ по
умолчанию) у строк с надписью — других данных о цене в корзине нет.

Revision ID: 6e2b8c4d1f90
Revises: d8f14b6a0c37
Create Date: 2026-10-08 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "6e2b8c4d1f90"
down_revision: str | Sequence[str] | None = "d8f14b6a0c37"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("cart_items", "inscription_price")


def downgrade() -> None:
    op.add_column(
        "cart_items",
        sa.Column("inscription_price", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.execute(
        """
        UPDATE cart_items
        SET inscription_price = COALESCE(
            (SELECT (value #>> '{}')::numeric FROM settings WHERE key = 'inscription_price'),
            300
        )
        WHERE inscription_text IS NOT NULL
        """
    )
