"""Pydantic models for AI meeting recaps."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RecapStatus(str, Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    SENT = "sent"


class RecapActionItem(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    done: bool = False


class RecapGenerateRequest(BaseModel):
    """Create a recap by sending a transcript (or notes) to GPT-4o-mini."""

    title: str = Field(min_length=1, max_length=200)
    transcript: str = Field(min_length=20, max_length=100_000)
    meeting_url: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "transcript")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("meeting_url")
    @classmethod
    def strip_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class RecapUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=20_000)
    action_items: list[RecapActionItem] | None = None
    meeting_url: str | None = Field(default=None, max_length=2000)


class RecapSendRequest(BaseModel):
    """Post the reviewed recap into a team chat channel (defaults to #general)."""

    channel_id: UUID | None = None


class RecapResponse(BaseModel):
    id: UUID
    team_id: UUID
    title: str
    meeting_url: str | None = None
    transcript: str
    summary: str
    action_items: list[RecapActionItem]
    status: RecapStatus
    model: str | None = None
    created_by: UUID
    reviewed_by: UUID | None = None
    sent_channel_id: UUID | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
