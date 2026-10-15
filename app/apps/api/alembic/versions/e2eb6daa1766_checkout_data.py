"""checkout data

Корзина и оформление (007a):

* заказ: почта для копии, «как связаться», получатель, квартира/подъезд/этаж,
  комментарий курьеру, сумма позиций и снапшот стоимости доставки;
* у старых заказов `subtotal` = `total_price`, доставка 0, почты нет — обязательность
  почты только у новых заказов, в схеме `OrderCreate`;
* товар: «Предлагать в корзине» (`is_upsell`).

Revision ID: e2eb6daa1766
Revises: 690dc68102d3
Create Date: 2026-10-12

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "e2eb6daa1766"
down_revision: str | Sequence[str] | None = "690dc68102d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

contact_method = postgresql.ENUM("call", "telegram", name="contact_method", create_type=False)


def upgrade() -> None:
    contact_method.create(op.get_bind(), checkfirst=True)
    op.add_column("orders", sa.Column("customer_email", sa.String(length=254), nullable=True))
    op.add_column("orders", sa.Column("contact_method", contact_method, nullable=True))
    op.add_column("orders", sa.Column("recipient_name", sa.String(length=200), nullable=True))
    op.add_column("orders", sa.Column("recipient_phone", sa.String(length=20), nullable=True))
    op.add_column("orders", sa.Column("address_apartment", sa.String(length=20), nullable=True))
    op.add_column("orders", sa.Column("address_entrance", sa.String(length=20), nullable=True))
    op.add_column("orders", sa.Column("address_floor", sa.String(length=20), nullable=True))
    op.add_column("orders", sa.Column("courier_comment", sa.Text(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("delivery_price", sa.Numeric(10, 2), server_default="0", nullable=False),
    )
    # Сумма позиций: у старых заказов доставки не было — это весь итог
    op.add_column("orders", sa.Column("subtotal", sa.Numeric(10, 2), nullable=True))
    op.execute("UPDATE orders SET subtotal = total_price")
    op.alter_column("orders", "subtotal", nullable=False)
    op.add_column(
        "products",
        sa.Column("is_upsell", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("products", "is_upsell")
    for column in (
        "subtotal",
        "delivery_price",
        "courier_comment",
        "address_floor",
        "address_entrance",
        "address_apartment",
        "recipient_phone",
        "recipient_name",
        "contact_method",
        "customer_email",
    ):
        op.drop_column("orders", column)
    contact_method.drop(op.get_bind(), checkfirst=True)
