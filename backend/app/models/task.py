"""Task Pydantic models for Kanban-style team task tracking."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import TaskStatus


class TaskCreate(BaseModel):
    """Payload for creating a team task."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: TaskStatus = TaskStatus.TODO
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int | None = Field(default=None, ge=0)
    story_points: int | None = Field(default=None, ge=1, le=100)
    parent_task_id: UUID | None = None


class TaskUpdate(BaseModel):
    """Partial update payload for a task."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int | None = Field(default=None, ge=0)
    story_points: int | None = Field(default=None, ge=1, le=100)
    parent_task_id: UUID | None = None

    @field_validator("story_points", mode="before")
    @classmethod
    def empty_points_as_none(cls, value: object) -> object:
        if value == "" or value is False:
            return None
        return value


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
    story_points: int | None = None
    parent_task_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def coerce_missing_link_fields(cls, data: object) -> object:
        """Older rows / fixtures may omit story_points / parent_task_id."""
        if isinstance(data, dict):
            data.setdefault("story_points", None)
            data.setdefault("parent_task_id", None)
        return data
