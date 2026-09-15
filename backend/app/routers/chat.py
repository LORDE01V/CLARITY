"""Team chat routes for channels and messages."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_chat_service
from app.dependencies.rbac import require_team_role
from app.models.chat import (
    ChannelCreate,
    ChannelResponse,
    MessageCreate,
    MessagePage,
    MessageResponse,
)
from app.models.enums import Role
from app.services.chat_service import ChatService

router = APIRouter(prefix="/teams/{team_id}/channels", tags=["chat"])


@router.get("", response_model=list[ChannelResponse])
async def list_channels(
    team_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    chat_service: ChatService = Depends(get_chat_service),
) -> list[ChannelResponse]:
    """List team channels; auto-creates #general on first visit."""
    return await chat_service.list_channels(team_id, user)


@router.post("", response_model=ChannelResponse, status_code=201)
async def create_channel(
    team_id: UUID,
    payload: ChannelCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChannelResponse:
    """Create a chat channel on the team (Member+ required)."""
    return await chat_service.create_channel(team_id, payload, user)


@router.get("/{channel_id}/messages", response_model=MessagePage)
async def list_messages(
    team_id: UUID,
    channel_id: UUID,
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    before: datetime | None = Query(default=None),
    after: datetime | None = Query(default=None),
    _role: Role = Depends(require_team_role(Role.GUEST)),
    chat_service: ChatService = Depends(get_chat_service),
) -> MessagePage:
    """List messages chronologically (oldest first), with optional cursor pagination."""
    return await chat_service.list_messages(
        team_id,
        channel_id,
        user,
        limit=limit,
        before=before,
        after=after,
    )


@router.post(
    "/{channel_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
async def send_message(
    team_id: UUID,
    channel_id: UUID,
    payload: MessageCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    chat_service: ChatService = Depends(get_chat_service),
) -> MessageResponse:
    """Send a message to a channel (Member+ required)."""
    return await chat_service.send_message(team_id, channel_id, payload, user)
