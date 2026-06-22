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
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
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


class WorkItemMixin:
    """Shared, fully-editable attributes for both Tasks and Subtasks.

    Priority hierarchy: 1 = highest, 5 = lowest (see CR-1 §10).
    `dedicated_hours` is the planned budget; hours actually spent are summed from
    TimeLog rows, and the difference (remaining) is surfaced in the Report layer.
    `last_checkpoint` records the functional phase (Planning/Development/Testing/
    Staging/Production) as free text.
    """

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[WorkStatus] = mapped_column(
        Enum(WorkStatus), default=WorkStatus.todo, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=3, nullable=False)  # 1=highest
    deadline: Mapped[date | None] = mapped_column(Date)
    dedicated_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    data_exposure_concern: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    last_checkpoint: Mapped[str | None] = mapped_column(String(100))
    required_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # User-raised flag: "this needs attention". Auto-flagging (overdue / blocked)
    # is derived in services.build_today; this column is the manual counterpart.
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sk_ids: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)


class System(TimestampMixin, Base):
    __tablename__ = "systems"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(10))  # emoji, e.g. "💻"
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


class Task(WorkItemMixin, TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    system_id: Mapped[int] = mapped_column(
        ForeignKey("systems.id", ondelete="CASCADE"), nullable=False
    )

    system: Mapped[System] = relationship(back_populates="tasks")
    subtasks: Mapped[list[Subtask]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    time_logs: Mapped[list[TimeLog]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Subtask(WorkItemMixin, TimestampMixin, Base):
    """Carries the same editable attributes as a Task; also exposes its parent
    System's current monthly priority (computed, not stored)."""

    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )

    task: Mapped[Task] = relationship(back_populates="subtasks")
    time_logs: Mapped[list[TimeLog]] = relationship(
        back_populates="subtask", cascade="all, delete-orphan"
    )


class TimeLog(TimestampMixin, Base):
    """A recorded chunk of hours spent on a Task or Subtask.

    `dedicated_hours - sum(TimeLog.hours)` is the remaining budget reported in
    the Report layer so the user knows how many hours are left.
    """

    __tablename__ = "time_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE")
    )
    subtask_id: Mapped[int | None] = mapped_column(
        ForeignKey("subtasks.id", ondelete="CASCADE")
    )
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    task: Mapped[Task | None] = relationship(back_populates="time_logs")
    subtask: Mapped[Subtask | None] = relationship(back_populates="time_logs")


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


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="tester", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


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


class SpecificKnowledge(TimestampMixin, Base):
    """A named skill/knowledge item with a rarity temperature (1=cold/teachable, 10=hot/unique)."""

    __tablename__ = "specific_knowledges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    temperature: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    ai_justification: Mapped[str | None] = mapped_column(Text)


class ReadingItem(TimestampMixin, Base):
    """A link or title saved to review later (Check Out ASAP)."""

    __tablename__ = "reading_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000))
    description: Mapped[str | None] = mapped_column(Text)
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
