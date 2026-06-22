"""specific_knowledge table + sk_ids on tasks/subtasks

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-22
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "specific_knowledges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("temperature", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("ai_justification", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    for table in ("tasks", "subtasks"):
        op.add_column(table, sa.Column("sk_ids", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    for table in ("tasks", "subtasks"):
        op.drop_column(table, "sk_ids")
    op.drop_table("specific_knowledges")
