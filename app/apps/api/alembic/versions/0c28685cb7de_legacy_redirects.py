"""legacy redirects

Таблица соответствия адресов старого сайта новым сущностям (задание 012): старый
слаг товара, старый id подкатегории, старый путь картинки → товар, подкатегория,
ключ в хранилище. Создаётся пустой — заполняется при переносе данных со старого
сайта; пока строк нет, сайт отдаёт для этих адресов запасные редиректы.

Revision ID: 0c28685cb7de
Revises: 4c7e9a2d6b13
Create Date: 2026-10-02 22:45:18

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0c28685cb7de"
down_revision: str | Sequence[str] | None = "4c7e9a2d6b13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "legacy_redirects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("old_key", sa.String(length=500), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("subcategory_id", sa.Integer(), nullable=True),
        sa.Column("media_key", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(kind = 'product' AND product_id IS NOT NULL)"
            " OR (kind = 'subcategory' AND subcategory_id IS NOT NULL)"
            " OR (kind = 'media' AND media_key IS NOT NULL)",
            name="ck_legacy_redirect_target",
        ),
        sa.CheckConstraint(
            "kind IN ('product', 'subcategory', 'media')", name="ck_legacy_redirect_kind"
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subcategory_id"], ["subcategories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kind", "old_key", name="uq_legacy_redirect_kind_key"),
    )


def downgrade() -> None:
    op.drop_table("legacy_redirects")
