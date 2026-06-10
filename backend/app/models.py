"""SQLAlchemy ORM models — the three-level hierarchy plus supporting entities.

System ──< Task ──< Subtask
System ──< Priority   (one per month)
System ──< FocusBlock (calendar)
System ──  AgentAssignment ──> AgentProgram
"""
from __future__ import annotations

import enum
from datetime import date, datetime, time

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class SystemStatus(enum.StrEnum):
    active = "active"
    paused = "paused"
    archived = "archived"


class WorkStatus(enum.StrEnum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"


class ProposalStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class System(TimestampMixin, Base):
    __tablename__ = "systems"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[SystemStatus] = mapped_column(
        Enum(SystemStatus), default=SystemStatus.active, nullable=False
    )

    # Captured during the AI intake interview (Phase 6); free-form for now.
    purpose: Mapped[str | None] = mapped_column(Text)
    goals: Mapped[str | None] = mapped_column(Text)
    constraints: Mapped[str | None] = mapped_column(Text)
    dependencies: Mapped[str | None] = mapped_column(Text)
    delivery_expectations: Mapped[str | None] = mapped_column(Text)

    tasks: Mapped[list[Task]] = relationship(
        back_populates="system", cascade="all, delete-orphan"
    )
    priorities: Mapped[list[Priority]] = relationship(
        back_populates="system", cascade="all, delete-orphan"
    )
    focus_blocks: Mapped[list[FocusBlock]] = relationship(
        back_populates="system", cascade="all, delete-orphan"
    )
    assignment: Mapped[AgentAssignment | None] = relationship(
        back_populates="system", cascade="all, delete-orphan", uselist=False
    )


class Priority(TimestampMixin, Base):
    """Monthly priority score for a System. Higher score = more important."""

    __tablename__ = "priorities"
    __table_args__ = (
        UniqueConstraint("system_id", "year", "month", name="uq_priority_system_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    system_id: Mapped[int] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-100

    system: Mapped[System] = relationship(back_populates="priorities")


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    system_id: Mapped[int] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[WorkStatus] = mapped_column(
        Enum(WorkStatus), default=WorkStatus.todo, nullable=False
    )
    deadline: Mapped[date | None] = mapped_column(Date)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    system: Mapped[System] = relationship(back_populates="tasks")
    subtasks: Mapped[list[Subtask]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Subtask(TimestampMixin, Base):
    """Inherits its parent System's current monthly priority (computed, not stored)."""

    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[WorkStatus] = mapped_column(
        Enum(WorkStatus), default=WorkStatus.todo, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    task: Mapped[Task] = relationship(back_populates="subtasks")


class FocusBlock(TimestampMixin, Base):
    """A scheduled work window on the calendar."""

    __tablename__ = "focus_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    system_id: Mapped[int | None] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE")
    )
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    note: Mapped[str | None] = mapped_column(Text)

    system: Mapped[System | None] = relationship(back_populates="focus_blocks")


class AgentProgram(TimestampMixin, Base):
    """An editable role-instruction file for an agent (program.md-style)."""

    __tablename__ = "agent_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(100), default="specialist", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    metric: Mapped[str | None] = mapped_column(String(200))


class AgentAssignment(TimestampMixin, Base):
    """Which agent owns which System."""

    __tablename__ = "agent_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    system_id: Mapped[int] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(200), nullable=False)
    program_id: Mapped[int | None] = mapped_column(
        ForeignKey("agent_programs.id", ondelete="SET NULL")
    )

    system: Mapped[System] = relationship(back_populates="assignment")
    program: Mapped[AgentProgram | None] = relationship()


class CheckIn(TimestampMixin, Base):
    """End-of-day check-in. Closes the loop instead of ticking tasks all day."""

    __tablename__ = "check_ins"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    # IDs of tasks marked done during this check-in (echoed for history).
    completed_task_ids: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)


class RebalanceProposal(TimestampMixin, Base):
    """A proposed plan from a specialist agent, awaiting the user's approval.

    Nothing is applied until `approve` is called — this enforces the
    'propose, never auto-reorganize' product rule.
    """

    __tablename__ = "rebalance_proposals"

    id: Mapped[int] = mapped_column(primary_key=True)
    system_id: Mapped[int] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE"), nullable=False
    )
    trigger: Mapped[str] = mapped_column(String(100), default="manual", nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # List of action dicts (see schemas.ProposalAction): reorder / add_pretask.
    actions: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[ProposalStatus] = mapped_column(
        Enum(ProposalStatus), default=ProposalStatus.pending, nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
