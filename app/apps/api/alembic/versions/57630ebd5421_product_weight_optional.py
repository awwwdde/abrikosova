"""product weight optional

Вес товара становится необязательным: у подарочного сертификата и услуг его нет,
а обязательное поле заставляло вписывать «1 г», которое покупатель видел
в карточке каталога. Если вес указан — он по-прежнему положительный.

Revision ID: 57630ebd5421
Revises: 7c1e2a9d4f10
Create Date: 2026-09-25 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "57630ebd5421"
down_revision: str | Sequence[str] | None = "7c1e2a9d4f10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_product_weight_positive", "products", type_="check")
    op.alter_column("products", "weight_grams", existing_type=sa.Integer(), nullable=True)
    op.create_check_constraint(
        "ck_product_weight_positive", "products", "weight_grams IS NULL OR weight_grams > 0"
    )


def downgrade() -> None:
    # Выдумывать вес при откате нельзя — это обещание покупателю. Товары без
    # веса нужно поправить вручную, миграция называет их и останавливается.
    bind = op.get_bind()
    missing = bind.execute(
        sa.text("SELECT id, name FROM products WHERE weight_grams IS NULL ORDER BY id")
    ).all()
    if missing:
        listing = "; ".join(f"#{row.id} «{row.name}»" for row in missing)
        raise RuntimeError(
            "У товаров не указан вес, а до этой ревизии он обязателен — заполните "
            f"weight_grams вручную и повторите откат: {listing}"
        )

    op.drop_constraint("ck_product_weight_positive", "products", type_="check")
    op.alter_column("products", "weight_grams", existing_type=sa.Integer(), nullable=False)
    op.create_check_constraint("ck_product_weight_positive", "products", "weight_grams > 0")
