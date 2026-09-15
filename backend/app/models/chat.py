"""Chat Pydantic models for team channels, DMs, and groups."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ChannelType(str, Enum):
    """Conversation kinds within a team."""

    CHANNEL = "channel"
    DM = "dm"
    GROUP = "group"


class ChannelCreate(BaseModel):
    """Payload for creating a team broadcast channel."""

    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class DirectMessageCreate(BaseModel):
    """Start (or open) a 1:1 DM with another team member."""

    user_id: UUID


class GroupCreate(BaseModel):
    """Create a multi-member group conversation."""

    name: str = Field(min_length=1, max_length=80)
    member_ids: list[UUID] = Field(min_length=1, max_length=50)


class ChannelMemberResponse(BaseModel):
    """Explicit member of a DM or group conversation."""

    user_id: UUID
    email: str
    full_name: str | None = None


class ChannelResponse(BaseModel):
    """Chat conversation returned to clients."""

    id: UUID
    team_id: UUID
    name: str
    description: str | None = None
    is_default: bool
    channel_type: ChannelType = ChannelType.CHANNEL
    created_by: UUID
    created_at: datetime
    members: list[ChannelMemberResponse] = Field(default_factory=list)


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
