"""train_config table for MindTrain wagon order and castle goals

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
        "train_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wagon_order", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("goal_1", sa.String(500), nullable=True),
        sa.Column("goal_2", sa.String(500), nullable=True),
        sa.Column("goal_3", sa.String(500), nullable=True),
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


def downgrade() -> None:
    op.drop_table("train_config")
