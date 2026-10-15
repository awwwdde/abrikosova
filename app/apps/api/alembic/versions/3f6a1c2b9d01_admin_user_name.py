"""admin user name

Имя сотрудника (задание 011c): приветствие «Добрый день, Елена» и «Ольга Т.» в журнале.
Колонка обязательная. Существующим сотрудникам имя ставится из части e-mail до «@»
с заглавной буквы («olga.t@…» → «Olga.t»), владелец потом поправит его в «Сотрудниках».
Сначала колонка создаётся пустой, заполняется и только потом становится NOT NULL:
сразу NOT NULL без значения по умолчанию упал бы на непустой таблице.

Revision ID: 3f6a1c2b9d01
Revises: b2d9340d72a8
Create Date: 2026-10-01 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3f6a1c2b9d01"
down_revision: str | Sequence[str] | None = "b2d9340d72a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("name", sa.String(length=100), nullable=True))
    op.execute(
        """
        UPDATE admin_users
        SET name = left(
            upper(left(split_part(email, '@', 1), 1)) || substr(split_part(email, '@', 1), 2),
            100
        )
        """
    )
    op.alter_column("admin_users", "name", nullable=False)


def downgrade() -> None:
    op.drop_column("admin_users", "name")
