"""Time entry models — task-linked hours and external work."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


def hours_to_minutes(hours: float) -> int:
    """Convert decimal hours to whole minutes (nearest minute, min 1)."""
    minutes = int(round(hours * 60))
    return max(1, minutes)


def minutes_to_hours(minutes: int) -> float:
    return round(minutes / 60, 2)


class TimeEntryCreate(BaseModel):
    """Log hours against a team task or external work."""

    work_date: date
    hours: float = Field(gt=0, le=24)
    task_id: UUID | None = None
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "description", mode="before")
    @classmethod
    def empty_str_as_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def require_task_or_external_title(self) -> "TimeEntryCreate":
        if self.task_id is None and not self.title:
            raise ValueError("Provide a task_id or an external work title")
        return self


class TimeEntryUpdate(BaseModel):
    """Partial update for a time entry."""

    work_date: date | None = None
    hours: float | None = Field(default=None, gt=0, le=24)
    task_id: UUID | None = None
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    clear_task: bool = False

    @field_validator("title", "description", mode="before")
    @classmethod
    def empty_str_as_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class TimeEntryResponse(BaseModel):
    """Time entry returned to clients."""

    id: UUID
    team_id: UUID
    user_id: UUID
    task_id: UUID | None = None
    work_date: date
    minutes: int
    hours: float
    title: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def derive_hours(cls, data: object) -> object:
        if isinstance(data, dict) and "hours" not in data and "minutes" in data:
            data = {**data, "hours": minutes_to_hours(int(data["minutes"]))}
        return data
