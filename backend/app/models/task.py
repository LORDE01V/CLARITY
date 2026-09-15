"""Task Pydantic models for Kanban-style team task tracking."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import TaskStatus


class TaskCreate(BaseModel):
    """Payload for creating a team task."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: TaskStatus = TaskStatus.TODO
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int | None = Field(default=None, ge=0)


class TaskUpdate(BaseModel):
    """Partial update payload for a task."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int | None = Field(default=None, ge=0)


class TaskStatusUpdate(BaseModel):
    """Payload for moving a task between Kanban columns."""

    status: TaskStatus
    position: int | None = Field(default=None, ge=0)


class TaskResponse(BaseModel):
    """Task record returned to clients."""

    id: UUID
    team_id: UUID
    title: str
    description: str | None = None
    status: TaskStatus
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int
    created_at: datetime
    updated_at: datetime
