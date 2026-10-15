"""order cancel reason

Причина отмены заказа (задание 011d): необязательное поле диалога «Отменить заказ».
Живёт в самом заказе — в журнал действий пишется только факт и новый статус.

Revision ID: 4c7e9a2d6b13
Revises: 8d2e4f7a1c55
Create Date: 2026-10-02 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4c7e9a2d6b13"
down_revision: str | Sequence[str] | None = "8d2e4f7a1c55"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("cancel_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "cancel_reason")
