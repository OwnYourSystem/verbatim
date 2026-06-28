"""Specific Knowledge: 3-level rating + normalized join tables

Replaces the denormalized JSON `sk_ids` list on tasks/subtasks with proper
many-to-many association tables, and replaces the 1-10 integer `temperature`
with a 3-level HOT/WARM/COLD `rating` (plus a `rating_finalized` flag).

Existing data is backfilled: temperatures map to ratings (>=7 hot, >=4 warm,
else cold) and each `sk_ids` element becomes an association row.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-28
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    # 1. Association tables (normalized many-to-many).
    op.create_table(
        "task_specific_knowledge",
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "sk_id",
            sa.Integer(),
            sa.ForeignKey("specific_knowledges.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "subtask_specific_knowledge",
        sa.Column(
            "subtask_id",
            sa.Integer(),
            sa.ForeignKey("subtasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "sk_id",
            sa.Integer(),
            sa.ForeignKey("specific_knowledges.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # 2. New rating columns on specific_knowledges.
    op.add_column(
        "specific_knowledges",
        sa.Column("rating", sa.String(10), nullable=False, server_default="warm"),
    )
    op.add_column(
        "specific_knowledges",
        sa.Column(
            "rating_finalized",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # 3. Backfill rating from the old integer temperature.
    op.execute(
        """
        UPDATE specific_knowledges
        SET rating = CASE
            WHEN temperature >= 7 THEN 'hot'
            WHEN temperature >= 4 THEN 'warm'
            ELSE 'cold'
        END
        """
    )

    # 4. Backfill association rows from the old JSON sk_ids lists (Postgres only;
    #    SQLite installs always start from this schema so there is nothing to
    #    backfill there).
    if _is_postgres():
        op.execute(
            """
            INSERT INTO task_specific_knowledge (task_id, sk_id)
            SELECT t.id, (elem)::int
            FROM tasks t,
                 json_array_elements_text(t.sk_ids) AS elem
            WHERE t.sk_ids IS NOT NULL
            ON CONFLICT DO NOTHING
            """
        )
        op.execute(
            """
            INSERT INTO subtask_specific_knowledge (subtask_id, sk_id)
            SELECT s.id, (elem)::int
            FROM subtasks s,
                 json_array_elements_text(s.sk_ids) AS elem
            WHERE s.sk_ids IS NOT NULL
            ON CONFLICT DO NOTHING
            """
        )

    # 5. Drop the old columns now that data has moved.
    op.drop_column("tasks", "sk_ids")
    op.drop_column("subtasks", "sk_ids")
    op.drop_column("specific_knowledges", "temperature")


def downgrade() -> None:
    op.add_column(
        "specific_knowledges",
        sa.Column("temperature", sa.Integer(), nullable=False, server_default="5"),
    )
    op.execute(
        """
        UPDATE specific_knowledges
        SET temperature = CASE
            WHEN rating = 'hot' THEN 9
            WHEN rating = 'warm' THEN 5
            ELSE 2
        END
        """
    )
    op.add_column(
        "subtasks",
        sa.Column("sk_ids", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "tasks",
        sa.Column("sk_ids", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.drop_column("specific_knowledges", "rating_finalized")
    op.drop_column("specific_knowledges", "rating")
    op.drop_table("subtask_specific_knowledge")
    op.drop_table("task_specific_knowledge")
