"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.models import SystemStatus, WorkStatus


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- System ----
class SystemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
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


# ---- Task ----
class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus = WorkStatus.todo
    deadline: date | None = None
    position: int = 0


class TaskCreate(TaskBase):
    system_id: int


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    status: WorkStatus | None = None
    deadline: date | None = None
    position: int | None = None
    system_id: int | None = None


class TaskRead(_ORM, TaskBase):
    id: int
    system_id: int
    created_at: datetime
    updated_at: datetime


# ---- Subtask ----
class SubtaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    status: WorkStatus = WorkStatus.todo
    position: int = 0


class SubtaskCreate(SubtaskBase):
    task_id: int


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    status: WorkStatus | None = None
    position: int | None = None
    task_id: int | None = None


class SubtaskRead(_ORM, SubtaskBase):
    id: int
    task_id: int
    created_at: datetime
    updated_at: datetime
    inherited_priority: int | None = None  # filled by endpoint


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


# ---- Dashboard ----
class TodayView(BaseModel):
    day: date
    focus_system: SystemRead | None
    focus_tasks: list[TaskRead]
    upcoming_deadlines: list[TaskRead]
    flagged: list[TaskRead]
