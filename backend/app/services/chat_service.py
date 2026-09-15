"""Chat business logic for team-scoped channels and messages."""

import re
from datetime import datetime
from uuid import UUID

from app.core.exceptions import NotFoundError, ValidationError
from app.db.repositories.chat_repository import ChatRepository
from app.models.auth import AuthUser
from app.models.chat import (
    ChannelCreate,
    ChannelResponse,
    MessageCreate,
    MessagePage,
    MessageResponse,
)
from app.models.enums import Role
from app.services.team_service import TeamService

_CHANNEL_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
DEFAULT_CHANNEL_NAME = "general"


def normalize_channel_name(raw: str) -> str:
    """Normalize channel names to lowercase slug-like identifiers."""
    name = raw.strip().lower().replace(" ", "-")
    name = re.sub(r"[^a-z0-9_-]", "", name)
    name = re.sub(r"-{2,}", "-", name).strip("-_")
    return name


class ChatService:
    """Manages team chat channels and messages."""

    def __init__(
        self,
        chat_repo: ChatRepository,
        team_service: TeamService,
    ) -> None:
        self._chat_repo = chat_repo
        self._team_service = team_service

    async def list_channels(
        self, team_id: UUID, actor: AuthUser
    ) -> list[ChannelResponse]:
        """List channels for a team, ensuring a default #general exists."""
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._ensure_default_channel(team_id, actor)
        return await self._chat_repo.list_channels(team_id)

    async def create_channel(
        self, team_id: UUID, payload: ChannelCreate, actor: AuthUser
    ) -> ChannelResponse:
        """Create a named channel on the team (Member+)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        name = self._validate_channel_name(payload.name)
        return await self._chat_repo.create_channel(
            team_id,
            ChannelCreate(name=name, description=payload.description),
            actor.id,
        )

    async def list_messages(
        self,
        team_id: UUID,
        channel_id: UUID,
        actor: AuthUser,
        *,
        limit: int = 50,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> MessagePage:
        """
        List messages chronologically (oldest first).

        Default: latest `limit` messages.
        `after`: newer messages for polling.
        `before`: older page for scroll-up history.
        """
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._get_team_channel(team_id, channel_id)

        if before is not None and after is not None:
            raise ValidationError("Use either before or after, not both")

        limit = max(1, min(limit, 100))
        messages = await self._chat_repo.list_messages(
            channel_id, limit=limit, before=before, after=after
        )

        has_more = False
        if after is None and messages:
            has_more = (
                await self._chat_repo.count_messages_before(
                    channel_id, messages[0].created_at
                )
            ) > 0

        return MessagePage(messages=messages, has_more=has_more)

    async def send_message(
        self,
        team_id: UUID,
        channel_id: UUID,
        payload: MessageCreate,
        actor: AuthUser,
    ) -> MessageResponse:
        """Send a message to a team channel (Member+)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_channel(team_id, channel_id)

        body = payload.body.strip()
        if not body:
            raise ValidationError("Message body cannot be empty")

        return await self._chat_repo.create_message(
            channel_id,
            MessageCreate(body=body),
            author_id=actor.id,
            author_email=str(actor.email),
            author_name=actor.full_name,
        )

    async def _ensure_default_channel(
        self, team_id: UUID, actor: AuthUser
    ) -> ChannelResponse:
        existing = await self._chat_repo.get_default_channel(team_id)
        if existing is not None:
            return existing
        return await self._chat_repo.create_channel(
            team_id,
            ChannelCreate(
                name=DEFAULT_CHANNEL_NAME,
                description="Default team channel",
            ),
            actor.id,
            is_default=True,
        )

    async def _get_team_channel(
        self, team_id: UUID, channel_id: UUID
    ) -> ChannelResponse:
        channel = await self._chat_repo.get_channel(channel_id)
        if channel is None or channel.team_id != team_id:
            raise NotFoundError("Channel not found")
        return channel

    def _validate_channel_name(self, raw: str) -> str:
        name = normalize_channel_name(raw)
        if not name or not _CHANNEL_NAME_RE.match(name):
            raise ValidationError(
                "Channel name must be lowercase letters, numbers, "
                "hyphens, or underscores"
            )
        if name == DEFAULT_CHANNEL_NAME:
            raise ValidationError("Channel name 'general' is reserved")
        return name
