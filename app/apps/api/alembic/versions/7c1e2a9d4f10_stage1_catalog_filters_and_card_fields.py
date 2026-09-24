"""stage1: catalog filters and product card fields

Изменения по PDF «Этап 1 · Аналитика и проектирование»:

* товар: вес и порции числами вместо текста, КБЖУ, перевозка, срок изготовления,
  поводы и ограничения в питании (сквозные фильтры каталога);
* отзыв может относиться к товару;
* работа в галерее получает подпись: повод, ярусы, гости, месяц;
* заявка на торт: повод, дата события, число гостей;
* заказ: интервал доставки;
* контакты: рейтинг Яндекса и ссылка на Telegram.

Миграция написана вручную поверх autogenerate: autogenerate не создаёт
PostgreSQL-типы enum при add_column, не видит CHECK-ограничения и, главное,
ничего не знает о переносе данных из старых текстовых полей weight/portions.

Revision ID: 7c1e2a9d4f10
Revises: 448a09002416
Create Date: 2026-09-25 01:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "7c1e2a9d4f10"
down_revision: str | Sequence[str] | None = "448a09002416"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: типы создаются явно один раз ниже. Иначе каждая колонка,
# где встречается `occasion`, попыталась бы создать тип заново.
occasion = postgresql.ENUM(
    "birthday", "kids", "wedding", "corporate", "tea", name="occasion", create_type=False
)
dietary_tag = postgresql.ENUM(
    "gluten_free", "lactose_free", "low_sugar", name="dietary_tag", create_type=False
)
delivery_interval = postgresql.ENUM(
    "09-12", "12-15", "15-18", "18-21", name="delivery_interval", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (occasion, dietary_tag, delivery_interval):
        enum_type.create(bind, checkfirst=True)

    # --- Товар: новые поля ---
    op.add_column("products", sa.Column("weight_grams", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("portions_min", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("portions_max", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("kcal", sa.Numeric(6, 1), nullable=True))
    op.add_column("products", sa.Column("proteins", sa.Numeric(5, 1), nullable=True))
    op.add_column("products", sa.Column("fats", sa.Numeric(5, 1), nullable=True))
    op.add_column("products", sa.Column("carbs", sa.Numeric(5, 1), nullable=True))
    op.add_column("products", sa.Column("transport_time", sa.String(100), nullable=True))
    op.add_column(
        "products",
        sa.Column("lead_time_days", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "products",
        sa.Column("occasions", postgresql.ARRAY(occasion), server_default="{}", nullable=False),
    )
    op.add_column(
        "products",
        sa.Column("dietary", postgresql.ARRAY(dietary_tag), server_default="{}", nullable=False),
    )

    # --- Перенос данных: «1 кг» → 1000, «450 г» → 450 ---
    op.execute(
        r"""
        UPDATE products SET weight_grams = CASE
            WHEN lower(weight) ~ '\d+([.,]\d+)?\s*кг'
                THEN round(
                    replace(substring(lower(weight) from '(\d+(?:[.,]\d+)?)\s*кг'), ',', '.')
                    ::numeric * 1000
                )::int
            WHEN lower(weight) ~ '\d+\s*г'
                THEN substring(lower(weight) from '(\d+)\s*г')::int
        END
        """
    )
    # Молча подставлять выдуманный вес нельзя — это обещание покупателю.
    # Если текст не распознан, миграция останавливается и называет товары.
    unparsed = bind.execute(
        sa.text("SELECT id, name, weight FROM products WHERE weight_grams IS NULL")
    ).all()
    if unparsed:
        listing = "; ".join(f"#{row.id} «{row.name}»: {row.weight!r}" for row in unparsed)
        raise RuntimeError(
            "Не удалось перевести вес в граммы — поправьте поле weight вручную и "
            f"повторите миграцию: {listing}"
        )

    # «на 8–10 персон» → 8 и 10, «на 1 человека» → 1 и 1. Порции необязательны,
    # поэтому нераспознанный текст просто даёт пустой диапазон.
    op.execute(
        r"""
        UPDATE products SET
            portions_min = substring(portions from '(\d+)')::int,
            portions_max = substring(portions from '(\d+)\D*$')::int
        WHERE portions ~ '\d'
        """
    )

    op.alter_column("products", "weight_grams", nullable=False)
    op.drop_column("products", "weight")
    op.drop_column("products", "portions")

    op.create_check_constraint("ck_product_weight_positive", "products", "weight_grams > 0")
    op.create_check_constraint(
        "ck_product_portions_range",
        "products",
        "(portions_min IS NULL AND portions_max IS NULL)"
        " OR (portions_min >= 1 AND portions_max >= portions_min)",
    )
    op.create_check_constraint(
        "ck_product_lead_time_non_negative", "products", "lead_time_days >= 0"
    )
    op.create_index("ix_product_occasions", "products", ["occasions"], postgresql_using="gin")
    op.create_index("ix_product_dietary", "products", ["dietary"], postgresql_using="gin")

    # --- Отзыв к товару ---
    op.add_column("reviews", sa.Column("product_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_reviews_product_id"), "reviews", ["product_id"])
    op.create_foreign_key(
        "reviews_product_id_fkey",
        "reviews",
        "products",
        ["product_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- Галерея: подпись работы ---
    op.add_column("gallery_items", sa.Column("occasion", occasion, nullable=True))
    op.add_column("gallery_items", sa.Column("tiers", sa.Integer(), nullable=True))
    op.add_column("gallery_items", sa.Column("guests", sa.Integer(), nullable=True))
    op.add_column("gallery_items", sa.Column("made_in", sa.Date(), nullable=True))
    op.create_index(op.f("ix_gallery_items_occasion"), "gallery_items", ["occasion"])
    op.create_check_constraint(
        "ck_gallery_tiers", "gallery_items", "tiers IS NULL OR tiers BETWEEN 1 AND 10"
    )
    op.create_check_constraint(
        "ck_gallery_guests", "gallery_items", "guests IS NULL OR guests >= 1"
    )

    # --- Заявка на торт ---
    op.add_column("consultation_requests", sa.Column("occasion", occasion, nullable=True))
    op.add_column("consultation_requests", sa.Column("event_date", sa.Date(), nullable=True))
    op.add_column("consultation_requests", sa.Column("guests_count", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_consultation_guests",
        "consultation_requests",
        "guests_count IS NULL OR guests_count >= 1",
    )

    # --- Заказ: интервал ---
    op.add_column("orders", sa.Column("delivery_interval", delivery_interval, nullable=True))

    # --- Контакты: рейтинг и Telegram ---
    op.add_column("page_contents", sa.Column("yandex_rating", sa.Numeric(2, 1), nullable=True))
    op.add_column("page_contents", sa.Column("yandex_reviews_count", sa.Integer(), nullable=True))
    op.add_column("page_contents", sa.Column("yandex_maps_url", sa.String(500), nullable=True))
    op.add_column("page_contents", sa.Column("telegram_url", sa.String(500), nullable=True))

    # server_default нужен был только чтобы заполнить существующие строки;
    # дальше значение по умолчанию задаёт модель, как у остальных колонок
    op.alter_column("products", "lead_time_days", server_default=None)


def downgrade() -> None:
    op.drop_column("page_contents", "telegram_url")
    op.drop_column("page_contents", "yandex_maps_url")
    op.drop_column("page_contents", "yandex_reviews_count")
    op.drop_column("page_contents", "yandex_rating")

    op.drop_column("orders", "delivery_interval")

    op.drop_constraint("ck_consultation_guests", "consultation_requests", type_="check")
    op.drop_column("consultation_requests", "guests_count")
    op.drop_column("consultation_requests", "event_date")
    op.drop_column("consultation_requests", "occasion")

    op.drop_constraint("ck_gallery_guests", "gallery_items", type_="check")
    op.drop_constraint("ck_gallery_tiers", "gallery_items", type_="check")
    op.drop_index(op.f("ix_gallery_items_occasion"), table_name="gallery_items")
    op.drop_column("gallery_items", "made_in")
    op.drop_column("gallery_items", "guests")
    op.drop_column("gallery_items", "tiers")
    op.drop_column("gallery_items", "occasion")

    op.drop_constraint("reviews_product_id_fkey", "reviews", type_="foreignkey")
    op.drop_index(op.f("ix_reviews_product_id"), table_name="reviews")
    op.drop_column("reviews", "product_id")

    # Обратный перенос: числа снова становятся текстом
    op.add_column("products", sa.Column("weight", sa.String(50), nullable=True))
    op.add_column("products", sa.Column("portions", sa.String(50), nullable=True))
    op.execute("UPDATE products SET weight = weight_grams || ' г'")
    op.execute(
        """
        UPDATE products SET portions = CASE
            WHEN portions_min = portions_max THEN portions_min::text
            ELSE portions_min || '–' || portions_max
        END
        WHERE portions_min IS NOT NULL
        """
    )
    op.alter_column("products", "weight", nullable=False)

    op.drop_index("ix_product_dietary", table_name="products", postgresql_using="gin")
    op.drop_index("ix_product_occasions", table_name="products", postgresql_using="gin")
    op.drop_constraint("ck_product_lead_time_non_negative", "products", type_="check")
    op.drop_constraint("ck_product_portions_range", "products", type_="check")
    op.drop_constraint("ck_product_weight_positive", "products", type_="check")
    for column in (
        "dietary",
        "occasions",
        "lead_time_days",
        "transport_time",
        "carbs",
        "fats",
        "proteins",
        "kcal",
        "portions_max",
        "portions_min",
        "weight_grams",
    ):
        op.drop_column("products", column)

    bind = op.get_bind()
    for enum_type in (delivery_interval, dietary_tag, occasion):
        enum_type.drop(bind, checkfirst=True)
