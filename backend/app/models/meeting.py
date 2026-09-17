"""Pydantic models for Jitsi-backed team meetings."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class MeetingResponse(BaseModel):
    id: UUID
    team_id: UUID
    title: str
    room_name: str
    meeting_url: str
    status: MeetingStatus
    created_by: UUID
    started_at: datetime
    ended_at: datetime | None = None
    created_at: datetime


class MeetingRecapFromMeetingRequest(BaseModel):
    """Generate a recap for a meeting using a transcript (paste or Whisper)."""

    transcript: str = Field(min_length=20, max_length=100_000)

    @field_validator("transcript")
    @classmethod
    def strip_transcript(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned
