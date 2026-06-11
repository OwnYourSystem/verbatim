"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-11
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- systems ---
    op.create_table(
        "systems",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "paused", "archived", name="systemstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("goals", sa.Text(), nullable=True),
        sa.Column("constraints", sa.Text(), nullable=True),
        sa.Column("dependencies", sa.Text(), nullable=True),
        sa.Column("delivery_expectations", sa.Text(), nullable=True),
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

    # --- priorities ---
    op.create_table(
        "priorities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "system_id",
            sa.Integer(),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
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
        sa.UniqueConstraint("system_id", "year", "month", name="uq_priority_system_month"),
    )

    # --- tasks ---
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "system_id",
            sa.Integer(),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "blocked", "done", name="workstatus"),
            nullable=False,
            server_default="todo",
        ),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
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

    # --- subtasks ---
    op.create_table(
        "subtasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "blocked", "done", name="workstatus"),
            nullable=False,
            server_default="todo",
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
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

    # --- focus_blocks ---
    op.create_table(
        "focus_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column(
            "system_id",
            sa.Integer(),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("note", sa.Text(), nullable=True),
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

    # --- agent_programs ---
    op.create_table(
        "agent_programs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(100), nullable=False, server_default="specialist"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("metric", sa.String(200), nullable=True),
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

    # --- agent_assignments ---
    op.create_table(
        "agent_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "system_id",
            sa.Integer(),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("agent_name", sa.String(200), nullable=False),
        sa.Column(
            "program_id",
            sa.Integer(),
            sa.ForeignKey("agent_programs.id", ondelete="SET NULL"),
            nullable=True,
        ),
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

    # --- check_ins ---
    op.create_table(
        "check_ins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed_task_ids", sa.JSON(), nullable=False, server_default="[]"),
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

    # --- rebalance_proposals ---
    op.create_table(
        "rebalance_proposals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "system_id",
            sa.Integer(),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trigger", sa.String(100), nullable=False, server_default="manual"),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("actions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="proposalstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
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

    # --- indexes for common query patterns ---
    op.create_index("ix_tasks_system_id", "tasks", ["system_id"])
    op.create_index("ix_subtasks_task_id", "subtasks", ["task_id"])
    op.create_index("ix_focus_blocks_day", "focus_blocks", ["day"])
    op.create_index("ix_rebalance_proposals_status", "rebalance_proposals", ["status"])
    op.create_index("ix_check_ins_day", "check_ins", ["day"])


def downgrade() -> None:
    op.drop_table("rebalance_proposals")
    op.drop_table("check_ins")
    op.drop_table("agent_assignments")
    op.drop_table("agent_programs")
    op.drop_table("focus_blocks")
    op.drop_table("subtasks")
    op.drop_table("tasks")
    op.drop_table("priorities")
    op.drop_table("systems")
    op.execute("DROP TYPE IF EXISTS systemstatus")
    op.execute("DROP TYPE IF EXISTS workstatus")
    op.execute("DROP TYPE IF EXISTS proposalstatus")
