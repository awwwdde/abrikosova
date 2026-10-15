"""product sold out today

«Закончилось сегодня» (006b): день кондитерской, в который позиция кончилась.
Дата, а не флаг: на следующий день товар сам снова «в наличии», ночной сброс
не нужен. Пока дата — сегодня, товар продаётся «под заказ на завтра»
(`Product.effective_lead_time_days`).

Revision ID: 690dc68102d3
Revises: c5a8f2d6e914
Create Date: 2026-10-11 23:19:19.312189

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "690dc68102d3"
down_revision: str | Sequence[str] | None = "c5a8f2d6e914"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("sold_out_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "sold_out_on")
