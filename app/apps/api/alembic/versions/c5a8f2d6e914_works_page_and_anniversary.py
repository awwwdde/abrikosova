"""works page and anniversary

Страница «Работы» (009):

* повод `anniversary` («Юбилей») в enum `occasion` — подписи работ «ЮБИЛЕЙ · АПРЕЛЬ
  2026». Каталог его не использует (CATALOG_OCCASIONS), в галерее он вместе
  с корпоративом образует фильтр «Юбилей и корпоратив» (`anniversary_corporate`);
* страница контента `gallery`: текст справа от заголовка и плашка «Не нашли
  похожий?» — тексты с макета works.png;
* карточка «Юбилей и корпоратив» мега-меню «Торты на заказ» (014) ведёт на тот же
  фильтр: `corporate` → `anniversary_corporate` в уже сохранённом контенте.

Новые значения enum нельзя использовать в той же транзакции — `ADD VALUE`
в отдельном autocommit-блоке.

Revision ID: c5a8f2d6e914
Revises: b7d3e1a9c428
Create Date: 2026-10-10 10:00:00

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c5a8f2d6e914"
down_revision: str | Sequence[str] | None = "b7d3e1a9c428"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GALLERY = {
    "intro": (
        "Свадьбы, дни рождения и юбилеи. Понравился торт, закажите похожий: Елена "
        "подстроит его под ваш повод и число гостей"
    ),
    "cta": {
        "title": "Не нашли похожий?",
        "text": (
            "Пришлите фото-образец или опишите идею. В день обращения назовём вес, срок и стоимость"
        ),
    },
}


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE occasion ADD VALUE IF NOT EXISTS 'anniversary'")
        op.execute("ALTER TYPE page_key ADD VALUE IF NOT EXISTS 'gallery'")
    bind = op.get_bind()
    # Только если страницы уже созданы (иначе это пустая база до сида)
    bind.execute(
        sa.text(
            "INSERT INTO page_contents (page_key, content) "
            "SELECT 'gallery', cast(:content as jsonb) "
            "WHERE EXISTS (SELECT 1 FROM page_contents) "
            "AND NOT EXISTS (SELECT 1 FROM page_contents WHERE page_key = 'gallery')"
        ),
        {"content": json.dumps(GALLERY, ensure_ascii=False)},
    )
    # Карточка меню: значение фильтра галереи вместо повода каталога
    bind.execute(
        sa.text(
            "UPDATE page_contents SET content = jsonb_set(content, '{header_menu,cards}', ("
            "SELECT jsonb_agg(CASE WHEN card->>'occasion' = 'corporate' "
            "THEN jsonb_set(card, '{occasion}', '\"anniversary_corporate\"') ELSE card END) "
            "FROM jsonb_array_elements(content->'header_menu'->'cards') AS card)) "
            "WHERE page_key = 'custom_cakes' "
            "AND jsonb_typeof(content->'header_menu'->'cards') = 'array' "
            "AND jsonb_array_length(content->'header_menu'->'cards') > 0"
        )
    )


def downgrade() -> None:
    op.execute(
        "UPDATE page_contents SET content = jsonb_set(content, '{header_menu,cards}', ("
        "SELECT jsonb_agg(CASE WHEN card->>'occasion' = 'anniversary_corporate' "
        "THEN jsonb_set(card, '{occasion}', '\"corporate\"') ELSE card END) "
        "FROM jsonb_array_elements(content->'header_menu'->'cards') AS card)) "
        "WHERE page_key = 'custom_cakes' "
        "AND jsonb_typeof(content->'header_menu'->'cards') = 'array' "
        "AND jsonb_array_length(content->'header_menu'->'cards') > 0"
    )
    op.execute("DELETE FROM page_contents WHERE page_key = 'gallery'")
    # Работы с юбилеем становятся корпоративом: подпись меняется, сама работа остаётся.
    # Значение 'anniversary' остаётся в типе occasion: пересоздавать тип трёх таблиц
    # (в том числе массив products.occasions) ради отката не стоит, а без строк
    # с этим значением оно ни на что не влияет. page_key пересоздаётся, как в 9c4f2a7e5b13
    op.execute("UPDATE gallery_items SET occasion = 'corporate' WHERE occasion = 'anniversary'")
    op.execute(
        "UPDATE consultation_requests SET occasion = 'corporate' WHERE occasion = 'anniversary'"
    )
    op.execute(
        "UPDATE products SET occasions = array_replace(occasions, 'anniversary', 'corporate')"
    )
    op.execute("ALTER TYPE page_key RENAME TO page_key_old")
    op.execute(
        "CREATE TYPE page_key AS ENUM ('home', 'about', 'custom_cakes', 'contacts', 'legal')"
    )
    op.execute(
        "ALTER TABLE page_contents ALTER COLUMN page_key TYPE page_key "
        "USING page_key::text::page_key"
    )
    op.execute("DROP TYPE page_key_old")
