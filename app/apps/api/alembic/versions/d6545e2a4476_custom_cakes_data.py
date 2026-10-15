"""custom cakes data

Торты на заказ (008a):

* дизайн: адрес, повод, подзаголовок, ярусы, минимум гостей, оформление; фото —
  отдельной таблицей с ролями. `price_from` и `image_key` удаляются: цена считается
  из настроек, старое фото переезжает в таблицу фото с ролью «Целиком»;
* начинка: короткое описание и метки состава;
* заявка: номер «З-…», дизайн / работа / начинка, пожелания, дополнения,
  получение, почта, способ связи, ориентир; фото-образцы (до 5) — таблица
  `consultation_images`, старый `reference_image_key` переносится в неё;
* повод заявки — свой тип `request_occasion` (поводы окна заявки). Старые значения:
  юбилей и корпоратив → «Юбилей и корпоратив», чаепитие → «Другое».

Откат возвращает старые колонки: цену — по минимуму гостей и классической цене
по умолчанию, фото и референс — первое из таблиц; «Другое» в старом типе — NULL.

Revision ID: d6545e2a4476
Revises: 5db61b99e03c
Create Date: 2026-10-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d6545e2a4476"
down_revision: str | Sequence[str] | None = "5db61b99e03c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: типы создаются и удаляются явно в начале и конце миграции,
# иначе add_column / create_table попытались бы создать их второй раз
GALLERY_OCCASION = postgresql.ENUM(
    "wedding",
    "birthday",
    "kids",
    "anniversary_corporate",
    name="gallery_occasion",
    create_type=False,
)
CAKE_DECORATION = postgresql.ENUM(
    "classic", "cream_drawing", "multi_tier", name="cake_decoration", create_type=False
)
CAKE_IMAGE_ROLE = postgresql.ENUM(
    "whole", "cut", "detail", "side", name="cake_image_role", create_type=False
)
REQUEST_OCCASION = postgresql.ENUM(
    "wedding",
    "birthday",
    "kids",
    "anniversary_corporate",
    "other",
    name="request_occasion",
    create_type=False,
)


def _existing(name: str) -> postgresql.ENUM:
    """Тип, который уже есть в базе (заказы): только ссылаемся, не создаём."""
    values = {
        "contact_method": ("call", "telegram"),
        "delivery_method": ("pickup", "delivery"),
        "dietary_tag": ("gluten_free", "lactose_free", "low_sugar"),
    }[name]
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (GALLERY_OCCASION, CAKE_DECORATION, CAKE_IMAGE_ROLE, REQUEST_OCCASION):
        enum.create(bind, checkfirst=True)

    # --- Дизайны ---
    op.add_column("custom_cakes", sa.Column("slug", sa.String(200), nullable=True))
    op.add_column("custom_cakes", sa.Column("subtitle", sa.String(300), nullable=True))
    op.add_column(
        "custom_cakes",
        sa.Column("occasion", GALLERY_OCCASION, nullable=False, server_default="birthday"),
    )
    op.add_column(
        "custom_cakes", sa.Column("tiers", sa.Integer(), nullable=False, server_default="1")
    )
    op.add_column(
        "custom_cakes", sa.Column("min_guests", sa.Integer(), nullable=False, server_default="10")
    )
    op.add_column(
        "custom_cakes",
        sa.Column("decoration", CAKE_DECORATION, nullable=False, server_default="classic"),
    )
    # У старых дизайнов адреса не было: «cake-<id>», владелица поправит в админке
    op.execute("UPDATE custom_cakes SET slug = 'cake-' || id WHERE slug IS NULL")
    op.alter_column("custom_cakes", "slug", nullable=False)
    for column in ("occasion", "tiers", "min_guests", "decoration"):
        op.alter_column("custom_cakes", column, server_default=None)
    op.create_unique_constraint("uq_custom_cakes_slug", "custom_cakes", ["slug"])
    op.create_index("ix_custom_cakes_occasion", "custom_cakes", ["occasion"])
    op.create_check_constraint("ck_custom_cake_tiers", "custom_cakes", "tiers >= 1")
    op.create_check_constraint("ck_custom_cake_min_guests", "custom_cakes", "min_guests >= 1")

    op.create_table(
        "custom_cake_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "cake_id",
            sa.Integer(),
            sa.ForeignKey("custom_cakes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("role", CAKE_IMAGE_ROLE, nullable=True),
        sa.Column("order", sa.Integer(), nullable=False),
    )
    op.create_index("ix_custom_cake_images_cake_id", "custom_cake_images", ["cake_id"])
    op.execute(
        """
        INSERT INTO custom_cake_images (cake_id, storage_key, role, "order")
        SELECT id, image_key, 'whole', 0 FROM custom_cakes WHERE coalesce(image_key, '') <> ''
        """
    )
    op.drop_column("custom_cakes", "image_key")
    op.drop_column("custom_cakes", "price_from")

    # --- Начинки ---
    op.add_column("fillings", sa.Column("short_description", sa.String(120), nullable=True))
    op.add_column(
        "fillings",
        sa.Column(
            "dietary",
            postgresql.ARRAY(_existing("dietary_tag")),
            nullable=False,
            server_default="{}",
        ),
    )

    # --- Заявки ---
    op.execute(
        """
        ALTER TABLE consultation_requests ALTER COLUMN occasion TYPE request_occasion
        USING (CASE occasion::text
            WHEN 'anniversary' THEN 'anniversary_corporate'
            WHEN 'corporate' THEN 'anniversary_corporate'
            WHEN 'tea' THEN 'other'
            ELSE occasion::text
        END)::request_occasion
        """
    )
    op.add_column("consultation_requests", sa.Column("number", sa.String(32), nullable=True))
    op.add_column("consultation_requests", sa.Column("email", sa.String(254), nullable=True))
    op.add_column(
        "consultation_requests",
        sa.Column("contact_method", _existing("contact_method"), nullable=True),
    )
    op.add_column(
        "consultation_requests",
        sa.Column(
            "design_id",
            sa.Integer(),
            sa.ForeignKey("custom_cakes.id", ondelete="SET NULL", name="fk_consultation_design"),
            nullable=True,
        ),
    )
    op.add_column(
        "consultation_requests",
        sa.Column(
            "gallery_item_id",
            sa.Integer(),
            sa.ForeignKey(
                "gallery_items.id", ondelete="SET NULL", name="fk_consultation_gallery_item"
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "consultation_requests",
        sa.Column(
            "filling_id",
            sa.Integer(),
            sa.ForeignKey("fillings.id", ondelete="SET NULL", name="fk_consultation_filling"),
            nullable=True,
        ),
    )
    op.add_column("consultation_requests", sa.Column("wishes", sa.Text(), nullable=True))
    op.add_column(
        "consultation_requests",
        sa.Column(
            "extras",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "consultation_requests",
        sa.Column("delivery_method", _existing("delivery_method"), nullable=True),
    )
    op.add_column(
        "consultation_requests",
        sa.Column("estimate", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_consultation_requests_design_id", "consultation_requests", ["design_id"])
    # Номера старым заявкам на торт — тем же видом, что у новых: «З-<дата>-<4 знака>»
    op.execute(
        """
        UPDATE consultation_requests
        SET number = 'З-' || to_char(created_at AT TIME ZONE 'Europe/Moscow', 'YYYYMMDD')
                     || '-' || upper(substr(md5(id::text || clock_timestamp()::text), 1, 4))
        WHERE source = 'custom_cake'
        """
    )
    op.create_unique_constraint(
        "uq_consultation_requests_number", "consultation_requests", ["number"]
    )

    op.create_table(
        "consultation_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("consultation_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
    )
    op.create_index("ix_consultation_images_request_id", "consultation_images", ["request_id"])
    op.execute(
        """
        INSERT INTO consultation_images (request_id, storage_key, "order")
        SELECT id, reference_image_key, 0 FROM consultation_requests
        WHERE reference_image_key IS NOT NULL
        """
    )
    op.drop_column("consultation_requests", "reference_image_key")


def downgrade() -> None:
    # --- Заявки ---
    op.add_column(
        "consultation_requests",
        sa.Column("reference_image_key", sa.String(500), nullable=True),
    )
    op.execute(
        """
        UPDATE consultation_requests r SET reference_image_key = i.storage_key
        FROM (SELECT DISTINCT ON (request_id) request_id, storage_key
              FROM consultation_images ORDER BY request_id, "order", id) i
        WHERE i.request_id = r.id
        """
    )
    op.drop_index("ix_consultation_images_request_id", table_name="consultation_images")
    op.drop_table("consultation_images")
    op.drop_constraint("uq_consultation_requests_number", "consultation_requests", type_="unique")
    op.drop_index("ix_consultation_requests_design_id", table_name="consultation_requests")
    for column in (
        "estimate",
        "delivery_method",
        "extras",
        "wishes",
        "filling_id",
        "gallery_item_id",
        "design_id",
        "contact_method",
        "email",
        "number",
    ):
        op.drop_column("consultation_requests", column)
    op.execute(
        """
        ALTER TABLE consultation_requests ALTER COLUMN occasion TYPE occasion
        USING (CASE occasion::text
            WHEN 'anniversary_corporate' THEN 'anniversary'
            WHEN 'other' THEN NULL
            ELSE occasion::text
        END)::occasion
        """
    )

    # --- Начинки ---
    op.drop_column("fillings", "dietary")
    op.drop_column("fillings", "short_description")

    # --- Дизайны ---
    op.add_column(
        "custom_cakes",
        sa.Column("price_from", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "custom_cakes",
        sa.Column("image_key", sa.String(500), nullable=False, server_default=""),
    )
    # Цена «от» по минимуму гостей: 150 г на гостя, вверх до 0,5 кг, не меньше 2 кг,
    # по классической цене 3 200 ₽ — значения по умолчанию 008a
    op.execute(
        """
        UPDATE custom_cakes SET price_from =
            greatest(2, ceil(min_guests * 0.15 * 2) / 2) * 3200
        """
    )
    op.execute(
        """
        UPDATE custom_cakes c SET image_key = i.storage_key
        FROM (SELECT DISTINCT ON (cake_id) cake_id, storage_key
              FROM custom_cake_images ORDER BY cake_id, "order", id) i
        WHERE i.cake_id = c.id
        """
    )
    op.alter_column("custom_cakes", "price_from", server_default=None)
    op.alter_column("custom_cakes", "image_key", server_default=None)
    op.drop_index("ix_custom_cake_images_cake_id", table_name="custom_cake_images")
    op.drop_table("custom_cake_images")
    op.drop_constraint("ck_custom_cake_min_guests", "custom_cakes", type_="check")
    op.drop_constraint("ck_custom_cake_tiers", "custom_cakes", type_="check")
    op.drop_index("ix_custom_cakes_occasion", table_name="custom_cakes")
    op.drop_constraint("uq_custom_cakes_slug", "custom_cakes", type_="unique")
    for column in ("decoration", "min_guests", "tiers", "occasion", "subtitle", "slug"):
        op.drop_column("custom_cakes", column)

    bind = op.get_bind()
    for enum in (REQUEST_OCCASION, CAKE_IMAGE_ROLE, CAKE_DECORATION, GALLERY_OCCASION):
        enum.drop(bind, checkfirst=True)
