"""product_sprints and story_items tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-29
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_sprints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pain_project_id",
            sa.Integer(),
            sa.ForeignKey("pain_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planning"),
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
    op.create_table(
        "story_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pain_project_id",
            sa.Integer(),
            sa.ForeignKey("pain_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sprint_id",
            sa.Integer(),
            sa.ForeignKey("product_sprints.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("story_type", sa.String(20), nullable=False, server_default="story"),
        sa.Column("points", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="backlog"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="3"),
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
    op.drop_table("story_items")
    op.drop_table("product_sprints")
