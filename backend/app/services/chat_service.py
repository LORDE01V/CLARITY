"""Chat business logic for team channels, DMs, and groups."""

import re
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.db.repositories.chat_repository import ChatRepository, dm_pair_key
from app.models.auth import AuthUser
from app.models.chat import (
    ChannelCreate,
    ChannelMemberResponse,
    ChannelResponse,
    ChannelType,
    DirectMessageCreate,
    GroupCreate,
    MessageCreate,
    MessagePage,
    MessageResponse,
)
from app.models.enums import Role
from app.services.team_service import TeamService

_CHANNEL_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
DEFAULT_CHANNEL_NAME = "general"


class UserProfileProvider(Protocol):
    """Looks up email / display name for a user id."""

    async def get_profile(self, user_id: UUID) -> tuple[str, str | None]: ...


class DictUserProfileProvider:
    """In-memory profile map for tests."""

    def __init__(self) -> None:
        self._profiles: dict[UUID, tuple[str, str | None]] = {}

    def put(self, user: AuthUser) -> None:
        self._profiles[user.id] = (str(user.email), user.full_name)

    async def get_profile(self, user_id: UUID) -> tuple[str, str | None]:
        if user_id in self._profiles:
            return self._profiles[user_id]
        return f"{user_id}@users.local", None


class SupabaseUserProfileProvider:
    """Resolve profiles via Supabase Auth Admin (service-role client)."""

    def __init__(self, client) -> None:
        self._client = client

    async def get_profile(self, user_id: UUID) -> tuple[str, str | None]:
        try:
            response = self._client.auth.admin.get_user_by_id(str(user_id))
            user = getattr(response, "user", None) or response
            email = getattr(user, "email", None) or f"{user_id}@users.local"
            metadata = getattr(user, "user_metadata", None) or {}
            full_name = metadata.get("full_name") if isinstance(metadata, dict) else None
            if isinstance(full_name, str):
                full_name = full_name or None
            else:
                full_name = None
            return str(email), full_name
        except Exception:
            return f"{user_id}@users.local", None


def normalize_channel_name(raw: str) -> str:
    """Normalize channel names to lowercase slug-like identifiers."""
    name = raw.strip().lower().replace(" ", "-")
    name = re.sub(r"[^a-z0-9_-]", "", name)
    name = re.sub(r"-{2,}", "-", name).strip("-_")
    return name


class ChatService:
    """Manages team chat channels, DMs, groups, and messages."""

    def __init__(
        self,
        chat_repo: ChatRepository,
        team_service: TeamService,
        user_profiles: UserProfileProvider,
    ) -> None:
        self._chat_repo = chat_repo
        self._team_service = team_service
        self._user_profiles = user_profiles

    async def list_channels(
        self, team_id: UUID, actor: AuthUser
    ) -> list[ChannelResponse]:
        """List conversations visible to the actor (channels + their DMs/groups)."""
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._ensure_default_channel(team_id, actor)
        return await self._chat_repo.list_channels_for_user(team_id, actor.id)

    async def create_channel(
        self, team_id: UUID, payload: ChannelCreate, actor: AuthUser
    ) -> ChannelResponse:
        """Create a named broadcast channel on the team (Member+)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        name = self._validate_channel_name(payload.name)
        return await self._chat_repo.create_channel(
            team_id,
            ChannelCreate(name=name, description=payload.description),
            actor.id,
            channel_type=ChannelType.CHANNEL,
        )

    async def start_dm(
        self, team_id: UUID, payload: DirectMessageCreate, actor: AuthUser
    ) -> ChannelResponse:
        """Find or create a 1:1 DM with another team member."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)

        if payload.user_id == actor.id:
            raise ValidationError("Cannot start a direct message with yourself")

        if not await self._team_service.user_belongs_to_team(team_id, payload.user_id):
            raise ValidationError("Recipient must be a member of this team")

        pair = dm_pair_key(actor.id, payload.user_id)
        existing = await self._chat_repo.find_dm(team_id, pair)
        if existing is not None:
            return existing

        other_email, other_name = await self._user_profiles.get_profile(payload.user_id)
        display = other_name or other_email
        members = [
            ChannelMemberResponse(
                user_id=actor.id,
                email=str(actor.email),
                full_name=actor.full_name,
            ),
            ChannelMemberResponse(
                user_id=payload.user_id,
                email=other_email,
                full_name=other_name,
            ),
        ]
        return await self._chat_repo.create_channel(
            team_id,
            ChannelCreate(name=display, description=None),
            actor.id,
            channel_type=ChannelType.DM,
            dm_pair_key_value=pair,
            members=members,
        )

    async def create_group(
        self, team_id: UUID, payload: GroupCreate, actor: AuthUser
    ) -> ChannelResponse:
        """Create a group conversation with explicit team-member roster."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)

        name = payload.name.strip()
        if not name:
            raise ValidationError("Group name cannot be empty")

        unique_ids = list(dict.fromkeys(payload.member_ids))
        if actor.id in unique_ids:
            unique_ids = [uid for uid in unique_ids if uid != actor.id]
        if not unique_ids:
            raise ValidationError("Group requires at least one other member")

        members = [
            ChannelMemberResponse(
                user_id=actor.id,
                email=str(actor.email),
                full_name=actor.full_name,
            )
        ]
        for user_id in unique_ids:
            if not await self._team_service.user_belongs_to_team(team_id, user_id):
                raise ValidationError(
                    "All group members must belong to this team"
                )
            email, full_name = await self._user_profiles.get_profile(user_id)
            members.append(
                ChannelMemberResponse(
                    user_id=user_id, email=email, full_name=full_name
                )
            )

        return await self._chat_repo.create_channel(
            team_id,
            ChannelCreate(name=name, description=None),
            actor.id,
            channel_type=ChannelType.GROUP,
            members=members,
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
        """List messages if the actor can access the conversation."""
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._require_conversation_access(team_id, channel_id, actor)

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
        """Send a message when the actor can access the conversation (Member+)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._require_conversation_access(team_id, channel_id, actor)

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
            channel_type=ChannelType.CHANNEL,
        )

    async def _require_conversation_access(
        self, team_id: UUID, channel_id: UUID, actor: AuthUser
    ) -> ChannelResponse:
        channel = await self._chat_repo.get_channel(channel_id)
        if channel is None or channel.team_id != team_id:
            raise NotFoundError("Channel not found")

        if channel.channel_type == ChannelType.CHANNEL:
            return channel

        if not await self._chat_repo.is_channel_member(channel_id, actor.id):
            raise PermissionDeniedError("Not a member of this conversation")
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
