"""Chat channel and message repository protocol and implementations."""

from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import ConflictError, NotFoundError
from app.models.chat import (
    ChannelCreate,
    ChannelResponse,
    MessageCreate,
    MessageResponse,
)


class ChatRepository(Protocol):
    """Contract for team chat persistence."""

    async def create_channel(
        self,
        team_id: UUID,
        payload: ChannelCreate,
        created_by: UUID,
        *,
        is_default: bool = False,
    ) -> ChannelResponse: ...

    async def get_channel(self, channel_id: UUID) -> ChannelResponse | None: ...

    async def list_channels(self, team_id: UUID) -> list[ChannelResponse]: ...

    async def get_default_channel(self, team_id: UUID) -> ChannelResponse | None: ...

    async def create_message(
        self,
        channel_id: UUID,
        payload: MessageCreate,
        *,
        author_id: UUID,
        author_email: str,
        author_name: str | None,
    ) -> MessageResponse: ...

    async def list_messages(
        self,
        channel_id: UUID,
        *,
        limit: int,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[MessageResponse]: ...

    async def count_messages_before(
        self, channel_id: UUID, before: datetime
    ) -> int: ...


class SupabaseChatRepository:
    """Supabase-backed chat repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._channels = "chat_channels"
        self._messages = "chat_messages"

    async def create_channel(
        self,
        team_id: UUID,
        payload: ChannelCreate,
        created_by: UUID,
        *,
        is_default: bool = False,
    ) -> ChannelResponse:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid4()),
            "team_id": str(team_id),
            "name": payload.name,
            "description": payload.description,
            "is_default": is_default,
            "created_by": str(created_by),
            "created_at": now,
        }
        try:
            result = self._client.table(self._channels).insert(row).execute()
        except Exception as exc:
            message = str(exc).lower()
            if "duplicate" in message or "unique" in message:
                raise ConflictError("A channel with that name already exists") from exc
            raise
        return ChannelResponse(**result.data[0])

    async def get_channel(self, channel_id: UUID) -> ChannelResponse | None:
        result = (
            self._client.table(self._channels)
            .select("*")
            .eq("id", str(channel_id))
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return ChannelResponse(**result.data)

    async def list_channels(self, team_id: UUID) -> list[ChannelResponse]:
        result = (
            self._client.table(self._channels)
            .select("*")
            .eq("team_id", str(team_id))
            .order("is_default", desc=True)
            .order("name")
            .execute()
        )
        return [ChannelResponse(**row) for row in result.data]

    async def get_default_channel(self, team_id: UUID) -> ChannelResponse | None:
        result = (
            self._client.table(self._channels)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("is_default", True)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return ChannelResponse(**result.data)

    async def create_message(
        self,
        channel_id: UUID,
        payload: MessageCreate,
        *,
        author_id: UUID,
        author_email: str,
        author_name: str | None,
    ) -> MessageResponse:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid4()),
            "channel_id": str(channel_id),
            "author_id": str(author_id),
            "author_email": author_email,
            "author_name": author_name,
            "body": payload.body,
            "created_at": now,
        }
        result = self._client.table(self._messages).insert(row).execute()
        return MessageResponse(**result.data[0])

    async def list_messages(
        self,
        channel_id: UUID,
        *,
        limit: int,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[MessageResponse]:
        query = (
            self._client.table(self._messages)
            .select("*")
            .eq("channel_id", str(channel_id))
        )

        if after is not None:
            query = (
                query.gt("created_at", after.isoformat())
                .order("created_at")
                .limit(limit)
            )
            result = query.execute()
            return [MessageResponse(**row) for row in result.data]

        # Latest page: fetch newest first, then reverse to chronological.
        query = query.order("created_at", desc=True).limit(limit)
        if before is not None:
            query = query.lt("created_at", before.isoformat())
        result = query.execute()
        rows = list(reversed(result.data or []))
        return [MessageResponse(**row) for row in rows]

    async def count_messages_before(
        self, channel_id: UUID, before: datetime
    ) -> int:
        result = (
            self._client.table(self._messages)
            .select("id", count="exact")
            .eq("channel_id", str(channel_id))
            .lt("created_at", before.isoformat())
            .execute()
        )
        if result.count is not None:
            return int(result.count)
        return len(result.data or [])


class InMemoryChatRepository:
    """In-memory chat store for unit tests."""

    def __init__(self) -> None:
        self._channels: dict[UUID, ChannelResponse] = {}
        self._messages: dict[UUID, MessageResponse] = {}
        self._clock = datetime.now(timezone.utc)

    def _next_ts(self) -> datetime:
        self._clock = self._clock + timedelta(milliseconds=1)
        return self._clock

    async def create_channel(
        self,
        team_id: UUID,
        payload: ChannelCreate,
        created_by: UUID,
        *,
        is_default: bool = False,
    ) -> ChannelResponse:
        name_key = payload.name.lower()
        for channel in self._channels.values():
            if channel.team_id == team_id and channel.name.lower() == name_key:
                raise ConflictError("A channel with that name already exists")
            if is_default and channel.team_id == team_id and channel.is_default:
                raise ConflictError("Team already has a default channel")

        channel = ChannelResponse(
            id=uuid4(),
            team_id=team_id,
            name=payload.name,
            description=payload.description,
            is_default=is_default,
            created_by=created_by,
            created_at=self._next_ts(),
        )
        self._channels[channel.id] = channel
        return channel

    async def get_channel(self, channel_id: UUID) -> ChannelResponse | None:
        return self._channels.get(channel_id)

    async def list_channels(self, team_id: UUID) -> list[ChannelResponse]:
        channels = [c for c in self._channels.values() if c.team_id == team_id]
        return sorted(channels, key=lambda c: (not c.is_default, c.name.lower()))

    async def get_default_channel(self, team_id: UUID) -> ChannelResponse | None:
        for channel in self._channels.values():
            if channel.team_id == team_id and channel.is_default:
                return channel
        return None

    async def create_message(
        self,
        channel_id: UUID,
        payload: MessageCreate,
        *,
        author_id: UUID,
        author_email: str,
        author_name: str | None,
    ) -> MessageResponse:
        message = MessageResponse(
            id=uuid4(),
            channel_id=channel_id,
            author_id=author_id,
            author_email=author_email,
            author_name=author_name,
            body=payload.body,
            created_at=self._next_ts(),
        )
        self._messages[message.id] = message
        return message

    async def list_messages(
        self,
        channel_id: UUID,
        *,
        limit: int,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[MessageResponse]:
        messages = [
            m for m in self._messages.values() if m.channel_id == channel_id
        ]
        messages.sort(key=lambda m: m.created_at)

        if after is not None:
            filtered = [m for m in messages if m.created_at > after]
            return filtered[:limit]

        if before is not None:
            filtered = [m for m in messages if m.created_at < before]
            return filtered[-limit:]

        return messages[-limit:]

    async def count_messages_before(
        self, channel_id: UUID, before: datetime
    ) -> int:
        return sum(
            1
            for m in self._messages.values()
            if m.channel_id == channel_id and m.created_at < before
        )
