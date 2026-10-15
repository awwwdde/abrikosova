"""legal page

Страница «Правовые документы» (задание 010b): дата редакции политики,
пользовательского соглашения и согласия на обработку ПДн редактируется
в админке «Страницы сайта». Сами тексты документов — в коде, имя оператора —
из реквизитов в контенте контактов.

Новое значение enum `page_key` нельзя использовать в той же транзакции, где
оно добавлено, поэтому `ADD VALUE` — в отдельном autocommit-блоке, а строка
страницы вставляется уже после него. Сид создаёт её на пустой базе сам;
здесь — для баз, где страницы уже есть.

Revision ID: 9c4f2a7e5b13
Revises: 6e2b8c4d1f90
Create Date: 2026-10-09 10:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "9c4f2a7e5b13"
down_revision: str | Sequence[str] | None = "6e2b8c4d1f90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REVISED = "2026-10-01"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE page_key ADD VALUE IF NOT EXISTS 'legal'")
    # Только если страницы контента уже созданы (иначе это пустая база до сида)
    op.execute(
        "INSERT INTO page_contents (page_key, content) "
        "SELECT 'legal', jsonb_build_object("
        f"'privacy_revised_at', '{REVISED}', "
        f"'terms_revised_at', '{REVISED}', "
        f"'consent_revised_at', '{REVISED}') "
        "WHERE EXISTS (SELECT 1 FROM page_contents) "
        "AND NOT EXISTS (SELECT 1 FROM page_contents WHERE page_key = 'legal')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM page_contents WHERE page_key = 'legal'")
    # Удалить значение из enum PostgreSQL нельзя — тип пересоздаётся
    op.execute("ALTER TYPE page_key RENAME TO page_key_old")
    op.execute("CREATE TYPE page_key AS ENUM ('home', 'about', 'custom_cakes', 'contacts')")
    op.execute(
        "ALTER TABLE page_contents ALTER COLUMN page_key TYPE page_key "
        "USING page_key::text::page_key"
    )
    op.execute("DROP TYPE page_key_old")
