"""yandex reviews and page content

Низ главной по макету (задание 004b):

* отзыв: источник `yandex` в enum `review_source` и `external_url` — ссылка
  на оригинал на Яндекс.Картах («Читать на Яндекс.Картах»);
* контент главной: у `content` появилась схема (schemas/pages.py). Черновые
  блоки из задания 004 — `coffee_shop`, `final_cta` и `author {quote, signature}` —
  в неё не входят и удаляются, иначе `GET /pages/home` не прошёл бы проверку
  ответа. Новые тексты блоков приходят из сида или админки.

Значение enum добавляется вручную: autogenerate изменения enum не видит.
`ADD VALUE` внутри транзакции допустим с PostgreSQL 12, само значение в этой
же транзакции не используется.

Revision ID: ce7bed463993
Revises: 7adec216f6cc
Create Date: 2026-09-29 21:22:16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ce7bed463993"
down_revision: str | Sequence[str] | None = "7adec216f6cc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE review_source ADD VALUE IF NOT EXISTS 'yandex'")
    op.add_column("reviews", sa.Column("external_url", sa.String(length=500), nullable=True))

    op.execute(
        "UPDATE page_contents SET content = content - 'coffee_shop' - 'final_cta' "
        "WHERE page_key = 'home'"
    )
    # Автор удаляется, только если это черновик 004 (без имени): блок,
    # уже заполненный по новой схеме, не трогаем
    op.execute(
        "UPDATE page_contents SET content = content - 'author' "
        "WHERE page_key = 'home' AND content ? 'author' AND NOT (content -> 'author' ? 'name')"
    )


def downgrade() -> None:
    op.drop_column("reviews", "external_url")

    # Удалить значение из enum PostgreSQL нельзя — тип пересоздаётся.
    # Отзывы с Яндекса становятся «добавленными вручную»: текст не теряется.
    op.execute("UPDATE reviews SET source = 'manual' WHERE source = 'yandex'")
    op.execute("ALTER TYPE review_source RENAME TO review_source_old")
    op.execute("CREATE TYPE review_source AS ENUM ('site_form', 'manual')")
    op.execute(
        "ALTER TABLE reviews ALTER COLUMN source TYPE review_source "
        "USING source::text::review_source"
    )
    op.execute("DROP TYPE review_source_old")
    # Удалённые черновые блоки главной не восстанавливаются: это демо-тексты
