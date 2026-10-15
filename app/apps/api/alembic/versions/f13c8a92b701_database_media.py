"""Фотографии, видео и закрытые файлы в PostgreSQL.

Revision ID: f13c8a92b701
Revises: d6545e2a4476
"""

import sqlalchemy as sa

from alembic import op

revision = "f13c8a92b701"
down_revision = "d6545e2a4476"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA backup_storage")
    for schema, objects, chunks in [
        (None, "media_objects", "media_chunks"),
        ("backup_storage", "objects", "chunks"),
    ]:
        op.create_table(
            objects,
            sa.Column("key", sa.String(500), primary_key=True),
            sa.Column("size", sa.BigInteger(), nullable=False),
            sa.Column("sha256", sa.String(64), nullable=False),
            schema=schema,
        )
        target = f"{schema}.{objects}" if schema else objects
        op.create_table(
            chunks,
            sa.Column(
                "key",
                sa.String(500),
                sa.ForeignKey(target + ".key", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("number", sa.Integer(), primary_key=True),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            schema=schema,
        )


def downgrade():
    op.drop_table("chunks", schema="backup_storage")
    op.drop_table("objects", schema="backup_storage")
    op.execute("DROP SCHEMA backup_storage")
    op.drop_table("media_chunks")
    op.drop_table("media_objects")
