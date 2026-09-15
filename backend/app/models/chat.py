"""Chat Pydantic models for team-scoped channels and messages."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChannelCreate(BaseModel):
    """Payload for creating a team chat channel."""

    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class ChannelResponse(BaseModel):
    """Chat channel returned to clients."""

    id: UUID
    team_id: UUID
    name: str
    description: str | None = None
    is_default: bool
    created_by: UUID
    created_at: datetime


class MessageCreate(BaseModel):
    """Payload for sending a chat message."""

    body: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    """Chat message returned to clients."""

    id: UUID
    channel_id: UUID
    author_id: UUID
    author_email: str
    author_name: str | None = None
    body: str
    created_at: datetime


class MessagePage(BaseModel):
    """Paginated message list (chronological, oldest first)."""

    messages: list[MessageResponse]
    has_more: bool
