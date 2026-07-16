"""time_logs.sk_id — attribute focus time to a Specific Knowledge

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-16
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table: SQLite can't ALTER-add a column with an inline FK
    # constraint directly; this uses the copy-and-move strategy there while
    # remaining a plain ADD COLUMN on Postgres.
    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.add_column(sa.Column("sk_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_time_logs_sk_id",
            "specific_knowledges",
            ["sk_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.drop_constraint("fk_time_logs_sk_id", type_="foreignkey")
        batch_op.drop_column("sk_id")
