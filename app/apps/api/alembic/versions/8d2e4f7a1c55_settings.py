"""settings

Настройки кондитерской «ключ → JSONB» (задание 011c): пороги «крупного» заказа и
события для главной админки. Таблица создаётся пустой — значения по умолчанию
(10 000 ₽, 30 гостей) живут в схеме и действуют, пока владелец их не сохранил.

Revision ID: 8d2e4f7a1c55
Revises: 3f6a1c2b9d01
Create Date: 2026-10-01 12:05:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "8d2e4f7a1c55"
down_revision: str | Sequence[str] | None = "3f6a1c2b9d01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("settings")
