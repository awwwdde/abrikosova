"""product variants and catalog fields

Задание 005a — данные под макеты каталога и страницы товара:

* варианты товара `product_variants` (вес со своей ценой, порциями и размером).
  Каждому товару создаётся ровно один вариант из его текущих цены, веса и порций;
  подпись строится из веса («100 г», «1,2 кг»), без веса — «Стандарт»;
* корзина и заказ ссылаются на вариант; в заказе — снапшоты названия товара
  и подписи варианта, надпись на табличке и её цена;
* «Кому» (`recipients`): повод `kids` переезжает из `occasions` в получателей;
* новые поля товара (подзаголовок, короткий состав, аллергены, упаковка,
  «можно надпись»), роль фото, текст под сеткой у разделов.

Старые колонки цены, веса и порций у товара удаляет следующая миграция
(`d8f14b6a0c37`): здесь они ещё нужны как источник данных.

Revision ID: a5c3e7d91b42
Revises: 0c28685cb7de
Create Date: 2026-10-07 23:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a5c3e7d91b42"
down_revision: str | Sequence[str] | None = "0c28685cb7de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: типы создаются явно один раз (см. 7c1e2a9d4f10)
recipient = postgresql.ENUM("her", "him", "kids", name="recipient", create_type=False)
image_role = postgresql.ENUM(
    "whole", "cut", "detail", "package", name="image_role", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (recipient, image_role):
        enum_type.create(bind, checkfirst=True)

    # --- Варианты ---
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("weight_grams", sa.Integer(), nullable=True),
        sa.Column("portions_min", sa.Integer(), nullable=True),
        sa.Column("portions_max", sa.Integer(), nullable=True),
        sa.Column("size_note", sa.String(length=100), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("price > 0", name="ck_variant_price_positive"),
        sa.CheckConstraint(
            "weight_grams IS NULL OR weight_grams > 0", name="ck_variant_weight_positive"
        ),
        sa.CheckConstraint(
            "(portions_min IS NULL AND portions_max IS NULL)"
            " OR (portions_min >= 1 AND portions_max >= portions_min)",
            name="ck_variant_portions_range",
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_variants_product_id"), "product_variants", ["product_id"])

    # Один вариант на товар из его текущих полей. Подпись — из веса:
    # 100 → «100 г», 1000 → «1 кг», 1200 → «1,2 кг»; без веса — «Стандарт».
    op.execute(
        r"""
        INSERT INTO product_variants (
            product_id, label, price, weight_grams, portions_min, portions_max,
            "order", is_active
        )
        SELECT
            id,
            CASE
                WHEN weight_grams IS NULL THEN 'Стандарт'
                WHEN weight_grams >= 1000 THEN replace(
                    rtrim(rtrim((weight_grams / 1000.0)::numeric(10, 3)::text, '0'), '.'),
                    '.', ','
                ) || ' кг'
                ELSE weight_grams || ' г'
            END,
            price, weight_grams, portions_min, portions_max, 0, true
        FROM products
        """
    )

    # --- Товар: новые поля ---
    op.add_column("products", sa.Column("subtitle", sa.String(length=120), nullable=True))
    op.add_column("products", sa.Column("card_ingredients", sa.String(length=120), nullable=True))
    op.add_column("products", sa.Column("allergens", sa.String(length=200), nullable=True))
    op.add_column("products", sa.Column("packaging", sa.String(length=200), nullable=True))
    op.add_column(
        "products",
        sa.Column("allows_inscription", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "products",
        sa.Column("recipients", postgresql.ARRAY(recipient), server_default="{}", nullable=False),
    )
    op.create_index("ix_product_recipients", "products", ["recipients"], postgresql_using="gin")

    # «Детский» в каталоге — это не повод, а получатель: «для детей». Значение
    # enum `occasion.kids` остаётся — им пользуется галерея работ.
    op.execute(
        """
        UPDATE products
        SET recipients = array_append(recipients, 'kids'::recipient),
            occasions = array_remove(occasions, 'kids'::occasion)
        WHERE 'kids'::occasion = ANY(occasions)
        """
    )

    # --- Фото и разделы ---
    op.add_column("product_images", sa.Column("role", image_role, nullable=True))
    op.add_column("categories", sa.Column("intro", sa.Text(), nullable=True))
    op.add_column("categories", sa.Column("all_label", sa.String(length=50), nullable=True))
    op.add_column("subcategories", sa.Column("intro", sa.Text(), nullable=True))

    # --- Корзина: строка — это вариант + надпись ---
    op.add_column("cart_items", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.add_column("cart_items", sa.Column("inscription_text", sa.String(length=30), nullable=True))
    op.add_column(
        "cart_items",
        sa.Column("inscription_price", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.execute(
        """
        UPDATE cart_items AS c SET variant_id = v.id
        FROM product_variants AS v WHERE v.product_id = c.product_id
        """
    )
    op.alter_column("cart_items", "variant_id", nullable=False)
    op.create_foreign_key(
        "cart_items_variant_id_fkey",
        "cart_items",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("uq_cart_item_product", "cart_items", type_="unique")
    op.create_unique_constraint(
        "uq_cart_item_variant_inscription",
        "cart_items",
        ["cart_id", "variant_id", "inscription_text"],
        postgresql_nulls_not_distinct=True,
    )

    # --- Заказ: вариант и снапшоты ---
    op.add_column("order_items", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("product_name", sa.String(length=200), nullable=True))
    op.add_column("order_items", sa.Column("variant_label", sa.String(length=50), nullable=True))
    op.add_column("order_items", sa.Column("inscription_text", sa.String(length=30), nullable=True))
    op.add_column(
        "order_items",
        sa.Column("inscription_price", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.execute(
        """
        UPDATE order_items AS o
        SET variant_id = v.id, variant_label = v.label, product_name = p.name
        FROM product_variants AS v
        JOIN products AS p ON p.id = v.product_id
        WHERE v.product_id = o.product_id
        """
    )
    for column in ("variant_id", "product_name", "variant_label"):
        op.alter_column("order_items", column, nullable=False)
    op.create_foreign_key(
        "order_items_variant_id_fkey",
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # server_default нужен был, только чтобы заполнить существующие строки
    op.alter_column("products", "allows_inscription", server_default=None)


def downgrade() -> None:
    # Заказ
    op.drop_constraint("order_items_variant_id_fkey", "order_items", type_="foreignkey")
    for column in (
        "inscription_price",
        "inscription_text",
        "variant_label",
        "product_name",
        "variant_id",
    ):
        op.drop_column("order_items", column)

    # Корзина: прежний ключ — один товар на корзину. Строки одного товара с разными
    # вариантами или надписями схлопываем в первую — корзина временная, а без
    # этого уникальное ограничение не создастся.
    op.drop_constraint("uq_cart_item_variant_inscription", "cart_items", type_="unique")
    op.execute(
        """
        DELETE FROM cart_items AS c
        USING cart_items AS first
        WHERE c.cart_id = first.cart_id AND c.product_id = first.product_id AND c.id > first.id
        """
    )
    op.create_unique_constraint("uq_cart_item_product", "cart_items", ["cart_id", "product_id"])
    op.drop_constraint("cart_items_variant_id_fkey", "cart_items", type_="foreignkey")
    for column in ("inscription_price", "inscription_text", "variant_id"):
        op.drop_column("cart_items", column)

    # Разделы и фото
    op.drop_column("subcategories", "intro")
    op.drop_column("categories", "all_label")
    op.drop_column("categories", "intro")
    op.drop_column("product_images", "role")

    # «Для детей» возвращается поводом; «для неё» и «для него» в старой схеме
    # выразить нечем — они теряются
    op.execute(
        """
        UPDATE products
        SET occasions = array_append(occasions, 'kids'::occasion)
        WHERE 'kids'::recipient = ANY(recipients) AND NOT 'kids'::occasion = ANY(occasions)
        """
    )
    op.drop_index("ix_product_recipients", table_name="products", postgresql_using="gin")
    for column in (
        "recipients",
        "allows_inscription",
        "packaging",
        "allergens",
        "card_ingredients",
        "subtitle",
    ):
        op.drop_column("products", column)

    op.drop_index(op.f("ix_product_variants_product_id"), table_name="product_variants")
    op.drop_table("product_variants")

    bind = op.get_bind()
    for enum_type in (image_role, recipient):
        enum_type.drop(bind, checkfirst=True)
