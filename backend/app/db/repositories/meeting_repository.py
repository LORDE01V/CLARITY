"""Meeting repository protocol and implementations."""

from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.models.meeting import MeetingResponse, MeetingStatus


def _row_to_response(row: dict[str, Any]) -> MeetingResponse:
    return MeetingResponse(
        id=row["id"],
        team_id=row["team_id"],
        title=row["title"],
        room_name=row["room_name"],
        meeting_url=row["meeting_url"],
        status=MeetingStatus(row["status"]),
        created_by=row["created_by"],
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
        created_at=row["created_at"],
    )


class MeetingRepository(Protocol):
    async def create(self, row: dict[str, Any]) -> MeetingResponse: ...

    async def get_by_id(self, meeting_id: UUID) -> MeetingResponse | None: ...

    async def list_by_team(self, team_id: UUID) -> list[MeetingResponse]: ...

    async def update(self, meeting_id: UUID, fields: dict[str, Any]) -> MeetingResponse: ...


class InMemoryMeetingRepository:
    def __init__(self) -> None:
        self._rows: dict[UUID, dict[str, Any]] = {}

    async def create(self, row: dict[str, Any]) -> MeetingResponse:
        meeting_id = UUID(str(row["id"]))
        self._rows[meeting_id] = dict(row)
        return _row_to_response(row)

    async def get_by_id(self, meeting_id: UUID) -> MeetingResponse | None:
        row = self._rows.get(meeting_id)
        return _row_to_response(row) if row else None

    async def list_by_team(self, team_id: UUID) -> list[MeetingResponse]:
        rows = [r for r in self._rows.values() if str(r["team_id"]) == str(team_id)]
        rows.sort(key=lambda r: r["started_at"], reverse=True)
        return [_row_to_response(r) for r in rows]

    async def update(self, meeting_id: UUID, fields: dict[str, Any]) -> MeetingResponse:
        row = self._rows.get(meeting_id)
        if not row:
            raise NotFoundError("Meeting not found")
        row.update(fields)
        return _row_to_response(row)


class SupabaseMeetingRepository:
    def __init__(self, client) -> None:
        self._client = client
        self._table = "meetings"

    async def create(self, row: dict[str, Any]) -> MeetingResponse:
        result = self._client.table(self._table).insert(row).execute()
        return _row_to_response(result.data[0])

    async def get_by_id(self, meeting_id: UUID) -> MeetingResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(meeting_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return _row_to_response(result.data)

    async def list_by_team(self, team_id: UUID) -> list[MeetingResponse]:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .order("started_at", desc=True)
            .execute()
        )
        return [_row_to_response(row) for row in (result.data or [])]

    async def update(self, meeting_id: UUID, fields: dict[str, Any]) -> MeetingResponse:
        result = (
            self._client.table(self._table)
            .update(fields)
            .eq("id", str(meeting_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Meeting not found")
        return _row_to_response(result.data[0])


def new_meeting_row(
    *,
    team_id: UUID,
    title: str,
    room_name: str,
    meeting_url: str,
    created_by: UUID,
    status: MeetingStatus = MeetingStatus.LIVE,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "team_id": str(team_id),
        "title": title,
        "room_name": room_name,
        "meeting_url": meeting_url,
        "status": status.value,
        "created_by": str(created_by),
        "started_at": now,
        "ended_at": None,
        "created_at": now,
    }
