"""task/subtask attributes + time logs (CR-1)

Adds the shared work-item attributes to tasks and subtasks, and a time_logs
table for recording hours spent (so remaining budget can be reported).

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-12
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


_NEW_COLUMNS = [
    ("priority", sa.Column("priority", sa.Integer(), nullable=False, server_default="3")),
    (
        "dedicated_hours",
        sa.Column("dedicated_hours", sa.Float(), nullable=False, server_default="0"),
    ),
    (
        "data_exposure_concern",
        sa.Column(
            "data_exposure_concern", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    ),
    ("last_checkpoint", sa.Column("last_checkpoint", sa.String(100), nullable=True)),
    (
        "required_demo",
        sa.Column("required_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
    ),
]


def upgrade() -> None:
    # Shared attributes on both tasks and subtasks.
    for table in ("tasks", "subtasks"):
        for _name, column in _NEW_COLUMNS:
            op.add_column(table, column)

    # Subtasks gain description + deadline (tasks already have them).
    op.add_column("subtasks", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("subtasks", sa.Column("deadline", sa.Date(), nullable=True))

    # --- time_logs ---
    op.create_table(
        "time_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column(
            "subtask_id",
            sa.Integer(),
            sa.ForeignKey("subtasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("hours", sa.Float(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_time_logs_task_id", "time_logs", ["task_id"])
    op.create_index("ix_time_logs_subtask_id", "time_logs", ["subtask_id"])


def downgrade() -> None:
    op.drop_index("ix_time_logs_subtask_id", table_name="time_logs")
    op.drop_index("ix_time_logs_task_id", table_name="time_logs")
    op.drop_table("time_logs")

    op.drop_column("subtasks", "deadline")
    op.drop_column("subtasks", "description")
    for table in ("subtasks", "tasks"):
        for name, _column in reversed(_NEW_COLUMNS):
            op.drop_column(table, name)
