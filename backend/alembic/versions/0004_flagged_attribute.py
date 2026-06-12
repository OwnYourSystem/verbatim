"""Add user-settable `flagged` attribute to tasks and subtasks

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-12
"""
import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("tasks", "subtasks"):
        op.add_column(
            table,
            sa.Column("flagged", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    for table in ("tasks", "subtasks"):
        op.drop_column(table, "flagged")
