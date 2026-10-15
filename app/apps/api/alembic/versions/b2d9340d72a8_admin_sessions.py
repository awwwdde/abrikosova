"""admin sessions

Серверные сессии админки (задание 011a): каждый вход — строка admin_sessions.
Refresh-токен несёт `sid` и `jti`, который должен совпасть с `current_jti`;
`previous_jti` и `rotated_at` различают гонку двух вкладок и кражу токена.
Позволяет показать список входов, «выйти везде» и отзывать входы при смене
пароля или отключении сотрудника. Данные не переносятся: после миграции все
сотрудники входят заново (старые токены без `sid` не принимаются).

Revision ID: b2d9340d72a8
Revises: ce7bed463993
Create Date: 2026-10-01 01:01:08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b2d9340d72a8"
down_revision: str | Sequence[str] | None = "ce7bed463993"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("admin_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("current_jti", sa.String(length=64), nullable=False),
        sa.Column("previous_jti", sa.String(length=64), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["admin_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_admin_sessions_admin_id"), "admin_sessions", ["admin_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_sessions_admin_id"), table_name="admin_sessions")
    op.drop_table("admin_sessions")
