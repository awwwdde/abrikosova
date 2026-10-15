"""card label and gallery weight detail

Данные, которых не хватало макету главной (задание 004):

* товар: `card_label` — подпись типа позиции в карточке («фирменная позиция»);
  если пусто, фронтенд пишет название подкатегории;
* работа в галерее: `weight_grams` — вес для подписи «3 яруса · 6 кг · 45 гостей»
  и `detail_image_key` — второй кадр «срез или деталь» при наведении.

Все поля необязательные, данные не переносятся. CHECK на вес дописан вручную:
autogenerate ограничения не видит.

Revision ID: 7adec216f6cc
Revises: 57630ebd5421
Create Date: 2026-09-25 13:19:50

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7adec216f6cc"
down_revision: str | Sequence[str] | None = "57630ebd5421"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("card_label", sa.String(length=50), nullable=True))
    op.add_column(
        "gallery_items", sa.Column("detail_image_key", sa.String(length=500), nullable=True)
    )
    op.add_column("gallery_items", sa.Column("weight_grams", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_gallery_weight_positive", "gallery_items", "weight_grams IS NULL OR weight_grams > 0"
    )


def downgrade() -> None:
    op.drop_constraint("ck_gallery_weight_positive", "gallery_items", type_="check")
    op.drop_column("gallery_items", "weight_grams")
    op.drop_column("gallery_items", "detail_image_key")
    op.drop_column("products", "card_label")
