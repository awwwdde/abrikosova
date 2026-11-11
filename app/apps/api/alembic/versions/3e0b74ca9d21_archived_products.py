"""Товары, удалённые из каталога с сохранением в истории заказов."""

import sqlalchemy as sa

from alembic import op

revision = "3e0b74ca9d21"
down_revision = "f13c8a92b701"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("products", "is_archived")
