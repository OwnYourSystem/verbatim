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
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
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


class SKRating(enum.StrEnum):
    """Three-level rarity rating for a Specific Knowledge.

    The AI decides how unique / not-teachable-elsewhere the knowledge is and
    rates it on a single thermometer: cold (teachable) → warm → hot (unique).
    """

    cold = "cold"
    warm = "warm"
    hot = "hot"


# ── Specific-Knowledge association tables (normalized many-to-many) ────────────
# A Task (or Subtask) has 1..* Specific Knowledges; an SK is unique and can be
# shared across work items. These join tables make that a real relational link
# instead of a denormalized JSON id-list.
task_specific_knowledge = Table(
    "task_specific_knowledge",
    Base.metadata,
    Column(
        "task_id",
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "sk_id",
        ForeignKey("specific_knowledges.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

subtask_specific_knowledge = Table(
    "subtask_specific_knowledge",
    Base.metadata,
    Column(
        "subtask_id",
        ForeignKey("subtasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "sk_id",
        ForeignKey("specific_knowledges.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


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
    specific_knowledges: Mapped[list[SpecificKnowledge]] = relationship(
        secondary=task_specific_knowledge, back_populates="tasks"
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
    specific_knowledges: Mapped[list[SpecificKnowledge]] = relationship(
        secondary=subtask_specific_knowledge, back_populates="subtasks"
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
    # Which Specific Knowledge this chunk of time was spent building — set when
    # the log comes from the Focus Timer, so the Today page can attribute
    # today's focus time per knowledge area ("Achievements"). Optional: manual
    # time logs (not via the timer) don't set this. SET NULL on SK delete so
    # historical time logs aren't lost.
    sk_id: Mapped[int | None] = mapped_column(
        ForeignKey("specific_knowledges.id", ondelete="SET NULL")
    )
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    task: Mapped[Task | None] = relationship(back_populates="time_logs")
    subtask: Mapped[Subtask | None] = relationship(back_populates="time_logs")
    specific_knowledge: Mapped[SpecificKnowledge | None] = relationship()


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
    """A unique named skill/knowledge item with a 3-level rarity rating.

    The AI judges how unique and not-teachable-elsewhere the knowledge is and
    rates it COLD / WARM / HOT on a single thermometer. The rating is suggested
    when the SK is defined on a Task/Subtask, finalized (re-evaluated) when that
    work item is completed, and may be overridden manually at any time.
    """

    __tablename__ = "specific_knowledges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    rating: Mapped[SKRating] = mapped_column(
        Enum(SKRating, native_enum=False, length=10),
        nullable=False,
        default=SKRating.warm,
    )
    # True once the owning work item has been completed and the AI has locked in
    # its uniqueness judgement. Until then the rating is a setup-time suggestion.
    rating_finalized: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    ai_justification: Mapped[str | None] = mapped_column(Text)

    tasks: Mapped[list[Task]] = relationship(
        secondary=task_specific_knowledge, back_populates="specific_knowledges"
    )
    subtasks: Mapped[list[Subtask]] = relationship(
        secondary=subtask_specific_knowledge, back_populates="specific_knowledges"
    )


class ReadingItem(TimestampMixin, Base):
    """A link or title saved to review later (Check Out ASAP)."""

    __tablename__ = "reading_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000))
    description: Mapped[str | None] = mapped_column(Text)
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StoryType(enum.StrEnum):
    epic = "epic"
    story = "story"
    task = "task"
    bug = "bug"


class StoryStatus(enum.StrEnum):
    backlog = "backlog"
    todo = "todo"
    doing = "doing"
    review = "review"
    done = "done"


class SprintStatus(enum.StrEnum):
    planning = "planning"
    active = "active"
    review = "review"
    closed = "closed"


class PainArea(enum.StrEnum):
    data_engineering = "data_engineering"
    ml = "ml"
    ai = "ai"


class MonetizationModel(enum.StrEnum):
    saas = "saas"
    api_product = "api_product"
    consulting = "consulting"
    course = "course"
    open_source_premium = "open_source_premium"
    marketplace = "marketplace"


class ProjectPhase(enum.StrEnum):
    idea = "idea"
    validate = "validate"
    build = "build"
    launch = "launch"


class Pain(TimestampMixin, Base):
    __tablename__ = "pains"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_platform: Mapped[str | None] = mapped_column(String(100))
    area: Mapped[str] = mapped_column(String(50), nullable=False, default="ai")
    is_ai_fetched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    project: Mapped[PainProject | None] = relationship(
        back_populates="pain", cascade="all, delete-orphan", uselist=False
    )


class PainProject(TimestampMixin, Base):
    __tablename__ = "pain_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    pain_id: Mapped[int] = mapped_column(
        ForeignKey("pains.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    problem_statement: Mapped[str | None] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(Text)
    monetization_model: Mapped[str | None] = mapped_column(String(50))
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="idea")
    system_id: Mapped[int | None] = mapped_column(
        ForeignKey("systems.id", ondelete="SET NULL")
    )

    pain: Mapped[Pain] = relationship(back_populates="project")
    system: Mapped[System | None] = relationship()
    sprints: Mapped[list[ProductSprint]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProductSprint.number"
    )
    stories: Mapped[list[StoryItem]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProductSprint(TimestampMixin, Base):
    """A time-boxed Scrum sprint for a product project."""

    __tablename__ = "product_sprints"

    id: Mapped[int] = mapped_column(primary_key=True)
    pain_project_id: Mapped[int] = mapped_column(
        ForeignKey("pain_projects.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    goal: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[SprintStatus] = mapped_column(
        Enum(SprintStatus), default=SprintStatus.planning, nullable=False
    )

    project: Mapped[PainProject] = relationship(back_populates="sprints")
    stories: Mapped[list[StoryItem]] = relationship(back_populates="sprint")


class StoryItem(TimestampMixin, Base):
    """A user story / backlog item belonging to a product project.

    `sprint_id = None` → lives in the product backlog.
    `sprint_id` set + `status` in todo/doing/review → active sprint work.
    `status = done` → completed, regardless of sprint.
    """

    __tablename__ = "story_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    pain_project_id: Mapped[int] = mapped_column(
        ForeignKey("pain_projects.id", ondelete="CASCADE"), nullable=False
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_sprints.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    story_type: Mapped[StoryType] = mapped_column(
        Enum(StoryType), default=StoryType.story, nullable=False
    )
    points: Mapped[int | None] = mapped_column(Integer)  # Fibonacci: 1,2,3,5,8,13
    status: Mapped[StoryStatus] = mapped_column(
        Enum(StoryStatus), default=StoryStatus.backlog, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=3, nullable=False)  # 1=highest

    project: Mapped[PainProject] = relationship(back_populates="stories")
    sprint: Mapped[ProductSprint | None] = relationship(back_populates="stories")
