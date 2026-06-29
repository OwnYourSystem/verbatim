"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import ProposalStatus, SKRating, SystemStatus, WorkStatus


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- System ----
class SystemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    icon: str | None = Field(default=None, max_length=10)
    description: str | None = None
    status: SystemStatus = SystemStatus.active
    purpose: str | None = None
    goals: str | None = None
    constraints: str | None = None
    dependencies: str | None = None
    delivery_expectations: str | None = None


class SystemCreate(SystemBase):
    pass


class SystemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    icon: str | None = Field(default=None, max_length=10)
    description: str | None = None
    status: SystemStatus | None = None
    purpose: str | None = None
    goals: str | None = None
    constraints: str | None = None
    dependencies: str | None = None
    delivery_expectations: str | None = None


class SystemRead(_ORM, SystemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    current_priority: int | None = None  # filled by endpoint from current month


# ---- Priority ----
class PriorityBase(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    score: int = Field(ge=1, le=100)


class PriorityCreate(PriorityBase):
    system_id: int


class PriorityRead(_ORM, PriorityBase):
    id: int
    system_id: int


# ---- Shared work-item attributes (Tasks and Subtasks) ----
class WorkItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus = WorkStatus.todo
    priority: int = Field(default=3, ge=1, le=5)  # 1 = highest, 5 = lowest
    deadline: date | None = None
    dedicated_hours: float = Field(default=0.0, ge=0)
    data_exposure_concern: bool = False
    last_checkpoint: str | None = Field(default=None, max_length=100)
    required_demo: bool = False
    flagged: bool = False  # user-raised "needs attention" flag
    position: int = 0


class WorkItemUpdate(BaseModel):
    """Every attribute is optional and editable."""

    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    deadline: date | None = None
    dedicated_hours: float | None = Field(default=None, ge=0)
    data_exposure_concern: bool | None = None
    last_checkpoint: str | None = Field(default=None, max_length=100)
    required_demo: bool | None = None
    flagged: bool | None = None
    position: int | None = None
    sk_ids: list[int] | None = None


class _Computed(BaseModel):
    """Server-computed read-only fields for hours and schedule pressure."""

    spent_hours: float = 0.0
    remaining_hours: float = 0.0
    time_left_days: int | None = None  # deadline - today; negative if overdue


# ---- Task ----
class TaskCreate(WorkItemBase):
    system_id: int
    # IDs of Specific Knowledges to associate (defined while setting up the task).
    sk_ids: list[int] = Field(default_factory=list)


class TaskUpdate(WorkItemUpdate):
    system_id: int | None = None


class TaskRead(_ORM, WorkItemBase, _Computed):
    id: int
    system_id: int
    system_name: str | None = None  # filled by endpoint
    specific_knowledges: list[SKRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ---- Subtask ----
class SubtaskCreate(WorkItemBase):
    task_id: int
    sk_ids: list[int] = Field(default_factory=list)


class SubtaskUpdate(WorkItemUpdate):
    task_id: int | None = None


class SubtaskRead(_ORM, WorkItemBase, _Computed):
    id: int
    task_id: int
    specific_knowledges: list[SKRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    inherited_priority: int | None = None  # System monthly priority (filled by endpoint)


# ---- TimeLog ----
class TimeLogBase(BaseModel):
    hours: float = Field(gt=0)
    day: date | None = None  # defaults to today on the server
    note: str | None = None


class TimeLogCreate(TimeLogBase):
    task_id: int | None = None
    subtask_id: int | None = None


class TimeLogRead(_ORM):
    id: int
    task_id: int | None
    subtask_id: int | None
    hours: float
    day: date
    note: str | None
    created_at: datetime


# ---- FocusBlock ----
class FocusBlockBase(BaseModel):
    day: date
    start_time: time | None = None
    end_time: time | None = None
    system_id: int | None = None
    task_id: int | None = None
    note: str | None = None


class FocusBlockCreate(FocusBlockBase):
    pass


class FocusBlockUpdate(BaseModel):
    day: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    system_id: int | None = None
    task_id: int | None = None
    note: str | None = None


class FocusBlockRead(_ORM, FocusBlockBase):
    id: int
    created_at: datetime
    task_title: str | None = None  # filled by endpoint
    system_name: str | None = None  # filled by endpoint


# ---- AgentProgram ----
class AgentProgramBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: str = "specialist"
    content: str = ""
    metric: str | None = None


class AgentProgramCreate(AgentProgramBase):
    pass


class AgentProgramUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = None
    content: str | None = None
    metric: str | None = None


class AgentProgramRead(_ORM, AgentProgramBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ---- AgentAssignment ----
class AgentAssignmentBase(BaseModel):
    system_id: int
    agent_name: str = Field(min_length=1, max_length=200)
    program_id: int | None = None


class AgentAssignmentCreate(AgentAssignmentBase):
    pass


class AgentAssignmentUpdate(BaseModel):
    agent_name: str | None = Field(default=None, min_length=1, max_length=200)
    program_id: int | None = None


class AgentAssignmentRead(_ORM, AgentAssignmentBase):
    id: int
    created_at: datetime


# ---- CheckIn ----
class CheckInCreate(BaseModel):
    day: date | None = None  # defaults to today on the server
    notes: str | None = None
    completed_task_ids: list[int] = Field(default_factory=list)


class CheckInRead(_ORM):
    id: int
    day: date
    notes: str | None
    completed_task_ids: list[int]
    created_at: datetime


# ---- Rebalance proposals (the AI scrum-master's toolkit) ----
class _WorkItemAttrs(BaseModel):
    """Optional attributes the scrum master may set on a task/subtask."""

    description: str | None = None
    status: WorkStatus | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    deadline: date | None = None
    dedicated_hours: float | None = Field(default=None, ge=0)
    data_exposure_concern: bool | None = None
    last_checkpoint: str | None = Field(default=None, max_length=100)
    required_demo: bool | None = None


class ReorderAction(BaseModel):
    type: Literal["reorder"] = "reorder"
    task_id: int
    position: int


class AddPretaskAction(_WorkItemAttrs):
    type: Literal["add_pretask"] = "add_pretask"
    title: str = Field(min_length=1, max_length=300)
    # New pre-task is inserted at the front of the system's task list.


class AddTaskAction(_WorkItemAttrs):
    """Add a fully-specified task (the scrum master fills every attribute)."""

    type: Literal["add_task"] = "add_task"
    title: str = Field(min_length=1, max_length=300)


class UpdateTaskAction(_WorkItemAttrs):
    """Adjust attributes of an existing task — re-estimate, re-prioritise, etc."""

    type: Literal["update_task"] = "update_task"
    task_id: int
    title: str | None = Field(default=None, min_length=1, max_length=300)


class AddSubtaskAction(_WorkItemAttrs):
    """Break a task down into a subtask with full attributes."""

    type: Literal["add_subtask"] = "add_subtask"
    task_id: int
    title: str = Field(min_length=1, max_length=300)


class ScheduleAction(BaseModel):
    """Put a task on the calendar (creates a focus block)."""

    type: Literal["schedule"] = "schedule"
    task_id: int
    day: date
    note: str | None = None


class InsightAction(BaseModel):
    """A non-mutating PM insight: risk, blocker, estimate, ceremony reminder.

    Applying it changes nothing in the data; it is recorded for the user to read.
    """

    type: Literal["insight"] = "insight"
    kind: Literal["risk", "blocker", "estimate", "suggestion", "ceremony"] = "suggestion"
    message: str = Field(min_length=1)


# Discriminated by the "type" field when parsing agent output.
ProposalAction = (
    ReorderAction
    | AddPretaskAction
    | AddTaskAction
    | UpdateTaskAction
    | AddSubtaskAction
    | ScheduleAction
    | InsightAction
)


class RebalanceProposalRead(_ORM):
    id: int
    system_id: int
    trigger: str
    summary: str
    actions: list[dict]
    status: ProposalStatus
    created_at: datetime
    decided_at: datetime | None


# ---- AI intake interview ----
class IntakeAnswer(BaseModel):
    question: str
    answer: str


class IntakeStepRequest(BaseModel):
    history: list[IntakeAnswer] = Field(default_factory=list)


class ProposedSubtask(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus = WorkStatus.todo
    priority: int = Field(default=3, ge=1, le=5)
    deadline: date | None = None
    dedicated_hours: float = Field(default=0.0, ge=0)
    data_exposure_concern: bool = False
    last_checkpoint: str | None = Field(default=None, max_length=100)
    required_demo: bool = False


class ProposedTask(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus = WorkStatus.todo
    priority: int = Field(default=3, ge=1, le=5)
    deadline: date | None = None
    dedicated_hours: float = Field(default=0.0, ge=0)
    data_exposure_concern: bool = False
    last_checkpoint: str | None = Field(default=None, max_length=100)
    required_demo: bool = False
    subtasks: list[ProposedSubtask] = Field(default_factory=list)


class IntakeSystemFields(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    purpose: str | None = None
    goals: str | None = None
    constraints: str | None = None
    dependencies: str | None = None
    delivery_expectations: str | None = None


class IntakeProposal(BaseModel):
    system: IntakeSystemFields
    tasks: list[ProposedTask] = Field(default_factory=list)


class IntakeStep(BaseModel):
    """One turn of the interview: either the next question, or a final proposal."""

    done: bool
    question: str | None = None
    proposal: IntakeProposal | None = None


class IntakeCommit(IntakeProposal):
    """The user-approved proposal to persist."""


# ---- Reports ----
class ReportSection(BaseModel):
    heading: str
    items: list[str]


class ChartPoint(BaseModel):
    label: str
    value: float
    # Optional second value for waterfall/grouped charts (e.g. spent vs budget).
    secondary: float | None = None
    color: str | None = None


class Chart(BaseModel):
    type: Literal["bar", "pie", "waterfall", "line"]
    title: str
    unit: str | None = None
    points: list[ChartPoint] = Field(default_factory=list)


class Report(BaseModel):
    type: str
    title: str
    generated_at: str
    summary: str
    sections: list[ReportSection]
    charts: list[Chart] = Field(default_factory=list)


# ---- Dashboard ----
class TodayView(BaseModel):
    day: date
    focus_system: SystemRead | None
    focus_tasks: list[TaskRead]
    focus_subtasks: list[SubtaskRead] = []
    upcoming_deadlines: list[TaskRead]
    flagged: list[TaskRead]


# ---- Specific Knowledge ----
class SKCreate(BaseModel):
    name: str
    rating: SKRating = SKRating.warm
    ai_justification: str | None = None


class SKUpdate(BaseModel):
    name: str | None = None
    rating: SKRating | None = None
    # Setting the rating manually counts as an override → marks it finalized.
    rating_finalized: bool | None = None
    ai_justification: str | None = None


class SKRead(_ORM):
    id: int
    name: str
    rating: SKRating
    rating_finalized: bool = False
    ai_justification: str | None = None
    in_universe: bool = False
    completed_count: int = 0
    task_count: int = 0


class SKSuggestRequest(BaseModel):
    title: str
    description: str | None = None


class SKSuggestResponse(BaseModel):
    name: str
    rating: SKRating
    justification: str


# ---- Reading Items (Check Out ASAP) ----
class ReadingItemCreate(BaseModel):
    title: str
    url: str | None = None
    description: str | None = None


class ReadingItemUpdate(BaseModel):
    title: str | None = None
    url: str | None = None
    description: str | None = None
    is_checked: bool | None = None


class ReadingItemRead(_ORM):
    id: int
    title: str
    url: str | None = None
    description: str | None = None
    is_checked: bool
    checked_at: datetime | None = None
    created_at: datetime


# ---- Wall of Pains ----
class PainProjectCreate(BaseModel):
    name: str
    problem_statement: str | None = None
    target_audience: str | None = None
    monetization_model: str | None = None
    phase: str = "idea"


class PainProjectUpdate(BaseModel):
    name: str | None = None
    problem_statement: str | None = None
    target_audience: str | None = None
    monetization_model: str | None = None
    phase: str | None = None


class PainProjectRead(_ORM):
    id: int
    pain_id: int
    name: str
    problem_statement: str | None = None
    target_audience: str | None = None
    monetization_model: str | None = None
    phase: str
    system_id: int | None = None
    system_name: str | None = None


class PainCreate(BaseModel):
    title: str
    description: str | None = None
    source_url: str | None = None
    source_platform: str | None = None
    area: str = "ai"
    is_ai_fetched: bool = False


class PainRead(_ORM):
    id: int
    title: str
    description: str | None = None
    source_url: str | None = None
    source_platform: str | None = None
    area: str
    is_ai_fetched: bool
    created_at: datetime
    project: PainProjectRead | None = None


class PainDiscoveryItem(BaseModel):
    title: str
    description: str
    source_url: str | None = None
    source_platform: str | None = None
    area: str


class AIProjectAssist(BaseModel):
    name: str
    problem_statement: str
    target_audience: str
    monetization_model: str
    justification: str


# ---- Product Development (Scrum) ----

class SprintCreate(BaseModel):
    goal: str | None = None
    start_date: str | None = None  # ISO date
    end_date: str | None = None


class SprintUpdate(BaseModel):
    goal: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None


class SprintRead(_ORM):
    id: int
    pain_project_id: int
    number: int
    goal: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str
    story_count: int = 0
    done_count: int = 0


class StoryCreate(BaseModel):
    title: str
    description: str | None = None
    story_type: str = "story"
    points: int | None = None
    priority: int = 3


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    story_type: str | None = None
    points: int | None = None
    status: str | None = None
    priority: int | None = None
    sprint_id: int | None = None


class StoryRead(_ORM):
    id: int
    pain_project_id: int
    sprint_id: int | None = None
    title: str
    description: str | None = None
    story_type: str
    points: int | None = None
    status: str
    priority: int


class ProductProjectRead(_ORM):
    id: int
    pain_id: int
    name: str
    problem_statement: str | None = None
    target_audience: str | None = None
    monetization_model: str | None = None
    phase: str
    system_id: int | None = None
    story_count: int = 0
    done_count: int = 0
    active_sprint: SprintRead | None = None


# TaskRead / SubtaskRead reference SKRead (defined later); resolve those
# forward references now that every schema in this module exists.
TaskRead.model_rebuild()
SubtaskRead.model_rebuild()
