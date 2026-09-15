"""Chat channel and message repository protocol and implementations."""

from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import ConflictError
from app.models.chat import (
    ChannelCreate,
    ChannelMemberResponse,
    ChannelResponse,
    ChannelType,
    MessageCreate,
    MessageResponse,
)


def dm_pair_key(user_a: UUID, user_b: UUID) -> str:
    """Canonical sorted key for a DM pair (order-independent)."""
    left, right = sorted((str(user_a), str(user_b)))
    return f"{left}:{right}"


class ChatRepository(Protocol):
    """Contract for team chat persistence."""

    async def create_channel(
        self,
        team_id: UUID,
        payload: ChannelCreate,
        created_by: UUID,
        *,
        is_default: bool = False,
        channel_type: ChannelType = ChannelType.CHANNEL,
        dm_pair_key_value: str | None = None,
        members: list[ChannelMemberResponse] | None = None,
    ) -> ChannelResponse: ...

    async def get_channel(self, channel_id: UUID) -> ChannelResponse | None: ...

    async def list_channels_for_user(
        self, team_id: UUID, user_id: UUID
    ) -> list[ChannelResponse]: ...

    async def get_default_channel(self, team_id: UUID) -> ChannelResponse | None: ...

    async def find_dm(
        self, team_id: UUID, pair_key: str
    ) -> ChannelResponse | None: ...

    async def is_channel_member(self, channel_id: UUID, user_id: UUID) -> bool: ...

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
        self._members = "chat_channel_members"
        self._messages = "chat_messages"

    async def create_channel(
        self,
        team_id: UUID,
        payload: ChannelCreate,
        created_by: UUID,
        *,
        is_default: bool = False,
        channel_type: ChannelType = ChannelType.CHANNEL,
        dm_pair_key_value: str | None = None,
        members: list[ChannelMemberResponse] | None = None,
    ) -> ChannelResponse:
        now = datetime.now(timezone.utc).isoformat()
        channel_id = uuid4()
        row = {
            "id": str(channel_id),
            "team_id": str(team_id),
            "name": payload.name,
            "description": payload.description,
            "is_default": is_default,
            "channel_type": channel_type.value,
            "dm_pair_key": dm_pair_key_value,
            "created_by": str(created_by),
            "created_at": now,
        }
        try:
            result = self._client.table(self._channels).insert(row).execute()
        except Exception as exc:
            message = str(exc).lower()
            if "duplicate" in message or "unique" in message:
                if channel_type == ChannelType.DM:
                    raise ConflictError("Direct message already exists") from exc
                raise ConflictError("A channel with that name already exists") from exc
            raise

        member_rows = members or []
        if member_rows:
            self._client.table(self._members).insert(
                [
                    {
                        "channel_id": str(channel_id),
                        "user_id": str(m.user_id),
                        "email": m.email,
                        "full_name": m.full_name,
                        "joined_at": now,
                    }
                    for m in member_rows
                ]
            ).execute()

        return self._to_channel(result.data[0], member_rows)

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
        members = await self._list_members(channel_id)
        return self._to_channel(result.data, members)

    async def list_channels_for_user(
        self, team_id: UUID, user_id: UUID
    ) -> list[ChannelResponse]:
        broadcast = (
            self._client.table(self._channels)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("channel_type", ChannelType.CHANNEL.value)
            .execute()
        )
        member_rows = (
            self._client.table(self._members)
            .select("channel_id")
            .eq("user_id", str(user_id))
            .execute()
        )
        member_channel_ids = [row["channel_id"] for row in (member_rows.data or [])]

        private_rows: list[dict] = []
        if member_channel_ids:
            private = (
                self._client.table(self._channels)
                .select("*")
                .eq("team_id", str(team_id))
                .in_("id", member_channel_ids)
                .neq("channel_type", ChannelType.CHANNEL.value)
                .execute()
            )
            private_rows = list(private.data or [])

        channels: list[ChannelResponse] = []
        for row in list(broadcast.data or []) + private_rows:
            channel_id = UUID(row["id"])
            members = await self._list_members(channel_id)
            channels.append(self._to_channel(row, members))

        return self._sort_channels(channels)

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
        return self._to_channel(result.data, [])

    async def find_dm(
        self, team_id: UUID, pair_key: str
    ) -> ChannelResponse | None:
        result = (
            self._client.table(self._channels)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("channel_type", ChannelType.DM.value)
            .eq("dm_pair_key", pair_key)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        channel_id = UUID(result.data["id"])
        members = await self._list_members(channel_id)
        return self._to_channel(result.data, members)

    async def is_channel_member(self, channel_id: UUID, user_id: UUID) -> bool:
        result = (
            self._client.table(self._members)
            .select("user_id")
            .eq("channel_id", str(channel_id))
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        return result is not None and bool(result.data)

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

    async def _list_members(self, channel_id: UUID) -> list[ChannelMemberResponse]:
        result = (
            self._client.table(self._members)
            .select("user_id,email,full_name")
            .eq("channel_id", str(channel_id))
            .execute()
        )
        return [
            ChannelMemberResponse(
                user_id=UUID(row["user_id"]),
                email=row["email"],
                full_name=row.get("full_name"),
            )
            for row in (result.data or [])
        ]

    @staticmethod
    def _to_channel(
        row: dict, members: list[ChannelMemberResponse]
    ) -> ChannelResponse:
        raw_type = row.get("channel_type") or ChannelType.CHANNEL.value
        return ChannelResponse(
            id=UUID(str(row["id"])),
            team_id=UUID(str(row["team_id"])),
            name=row["name"],
            description=row.get("description"),
            is_default=bool(row.get("is_default", False)),
            channel_type=ChannelType(raw_type),
            created_by=UUID(str(row["created_by"])),
            created_at=row["created_at"],
            members=members,
        )

    @staticmethod
    def _sort_channels(channels: list[ChannelResponse]) -> list[ChannelResponse]:
        type_order = {
            ChannelType.CHANNEL: 0,
            ChannelType.DM: 1,
            ChannelType.GROUP: 2,
        }
        return sorted(
            channels,
            key=lambda c: (
                type_order.get(c.channel_type, 9),
                not c.is_default,
                c.name.lower(),
            ),
        )


class InMemoryChatRepository:
    """In-memory chat store for unit tests."""

    def __init__(self) -> None:
        self._channels: dict[UUID, ChannelResponse] = {}
        self._dm_pair_keys: dict[tuple[UUID, str], UUID] = {}
        self._members: dict[UUID, list[ChannelMemberResponse]] = {}
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
        channel_type: ChannelType = ChannelType.CHANNEL,
        dm_pair_key_value: str | None = None,
        members: list[ChannelMemberResponse] | None = None,
    ) -> ChannelResponse:
        if channel_type == ChannelType.CHANNEL:
            name_key = payload.name.lower()
            for channel in self._channels.values():
                if (
                    channel.team_id == team_id
                    and channel.channel_type == ChannelType.CHANNEL
                    and channel.name.lower() == name_key
                ):
                    raise ConflictError("A channel with that name already exists")
                if is_default and channel.team_id == team_id and channel.is_default:
                    raise ConflictError("Team already has a default channel")

        if channel_type == ChannelType.DM and dm_pair_key_value:
            existing_id = self._dm_pair_keys.get((team_id, dm_pair_key_value))
            if existing_id is not None:
                raise ConflictError("Direct message already exists")

        channel = ChannelResponse(
            id=uuid4(),
            team_id=team_id,
            name=payload.name,
            description=payload.description,
            is_default=is_default,
            channel_type=channel_type,
            created_by=created_by,
            created_at=self._next_ts(),
            members=list(members or []),
        )
        self._channels[channel.id] = channel
        self._members[channel.id] = list(members or [])
        if channel_type == ChannelType.DM and dm_pair_key_value:
            self._dm_pair_keys[(team_id, dm_pair_key_value)] = channel.id
        return channel

    async def get_channel(self, channel_id: UUID) -> ChannelResponse | None:
        channel = self._channels.get(channel_id)
        if channel is None:
            return None
        return channel.model_copy(
            update={"members": list(self._members.get(channel_id, []))}
        )

    async def list_channels_for_user(
        self, team_id: UUID, user_id: UUID
    ) -> list[ChannelResponse]:
        result: list[ChannelResponse] = []
        for channel in self._channels.values():
            if channel.team_id != team_id:
                continue
            if channel.channel_type == ChannelType.CHANNEL:
                result.append(
                    channel.model_copy(
                        update={"members": list(self._members.get(channel.id, []))}
                    )
                )
                continue
            members = self._members.get(channel.id, [])
            if any(m.user_id == user_id for m in members):
                result.append(channel.model_copy(update={"members": list(members)}))
        return SupabaseChatRepository._sort_channels(result)

    async def get_default_channel(self, team_id: UUID) -> ChannelResponse | None:
        for channel in self._channels.values():
            if channel.team_id == team_id and channel.is_default:
                return channel.model_copy(
                    update={"members": list(self._members.get(channel.id, []))}
                )
        return None

    async def find_dm(
        self, team_id: UUID, pair_key: str
    ) -> ChannelResponse | None:
        channel_id = self._dm_pair_keys.get((team_id, pair_key))
        if channel_id is None:
            return None
        return await self.get_channel(channel_id)

    async def is_channel_member(self, channel_id: UUID, user_id: UUID) -> bool:
        return any(m.user_id == user_id for m in self._members.get(channel_id, []))

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
