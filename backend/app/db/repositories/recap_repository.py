"""Meeting recap repository protocol and Supabase implementation."""

from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.models.recap import RecapActionItem, RecapResponse, RecapStatus


def _parse_action_items(raw: Any) -> list[RecapActionItem]:
    if not isinstance(raw, list):
        return []
    items: list[RecapActionItem] = []
    for entry in raw:
        if isinstance(entry, dict) and entry.get("text"):
            items.append(
                RecapActionItem(
                    text=str(entry["text"]),
                    done=bool(entry.get("done", False)),
                )
            )
    return items


def _row_to_response(row: dict[str, Any]) -> RecapResponse:
    return RecapResponse(
        id=row["id"],
        team_id=row["team_id"],
        title=row["title"],
        meeting_url=row.get("meeting_url"),
        transcript=row["transcript"],
        summary=row.get("summary") or "",
        action_items=_parse_action_items(row.get("action_items")),
        status=RecapStatus(row["status"]),
        model=row.get("model"),
        created_by=row["created_by"],
        reviewed_by=row.get("reviewed_by"),
        sent_channel_id=row.get("sent_channel_id"),
        sent_at=row.get("sent_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class RecapRepository(Protocol):
    async def create(self, row: dict[str, Any]) -> RecapResponse: ...

    async def get_by_id(self, recap_id: UUID) -> RecapResponse | None: ...

    async def list_by_team(self, team_id: UUID) -> list[RecapResponse]: ...

    async def update(self, recap_id: UUID, fields: dict[str, Any]) -> RecapResponse: ...


class InMemoryRecapRepository:
    """In-memory store for unit tests."""

    def __init__(self) -> None:
        self._rows: dict[UUID, dict[str, Any]] = {}

    async def create(self, row: dict[str, Any]) -> RecapResponse:
        recap_id = UUID(str(row["id"]))
        self._rows[recap_id] = dict(row)
        return _row_to_response(self._rows[recap_id])

    async def get_by_id(self, recap_id: UUID) -> RecapResponse | None:
        row = self._rows.get(recap_id)
        return _row_to_response(row) if row else None

    async def list_by_team(self, team_id: UUID) -> list[RecapResponse]:
        rows = [r for r in self._rows.values() if str(r["team_id"]) == str(team_id)]
        rows.sort(key=lambda r: r["created_at"], reverse=True)
        return [_row_to_response(r) for r in rows]

    async def update(self, recap_id: UUID, fields: dict[str, Any]) -> RecapResponse:
        row = self._rows.get(recap_id)
        if not row:
            raise NotFoundError("Recap not found")
        row.update(fields)
        return _row_to_response(row)


class SupabaseRecapRepository:
    """Supabase-backed meeting recap repository (service-role client)."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "meeting_recaps"

    async def create(self, row: dict[str, Any]) -> RecapResponse:
        result = self._client.table(self._table).insert(row).execute()
        return _row_to_response(result.data[0])

    async def get_by_id(self, recap_id: UUID) -> RecapResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(recap_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return _row_to_response(result.data)

    async def list_by_team(self, team_id: UUID) -> list[RecapResponse]:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .order("created_at", desc=True)
            .execute()
        )
        return [_row_to_response(row) for row in (result.data or [])]

    async def update(self, recap_id: UUID, fields: dict[str, Any]) -> RecapResponse:
        result = (
            self._client.table(self._table)
            .update(fields)
            .eq("id", str(recap_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Recap not found")
        return _row_to_response(result.data[0])


def new_recap_row(
    *,
    team_id: UUID,
    title: str,
    transcript: str,
    summary: str,
    action_items: list[RecapActionItem],
    created_by: UUID,
    model: str | None,
    meeting_url: str | None = None,
    status: RecapStatus = RecapStatus.DRAFT,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "team_id": str(team_id),
        "title": title,
        "meeting_url": meeting_url,
        "transcript": transcript,
        "summary": summary,
        "action_items": [item.model_dump() for item in action_items],
        "status": status.value,
        "model": model,
        "created_by": str(created_by),
        "reviewed_by": None,
        "sent_channel_id": None,
        "sent_at": None,
        "created_at": now,
        "updated_at": now,
    }
