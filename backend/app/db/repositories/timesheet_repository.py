"""Time entry repository protocol and implementations."""

from datetime import date, datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.models.timesheet import (
    TimeEntryCreate,
    TimeEntryResponse,
    TimeEntryUpdate,
    hours_to_minutes,
    minutes_to_hours,
)


class TimeEntryRepository(Protocol):
    """Contract for team time-entry persistence."""

    async def create(
        self, team_id: UUID, user_id: UUID, payload: TimeEntryCreate
    ) -> TimeEntryResponse: ...

    async def get_by_id(self, entry_id: UUID) -> TimeEntryResponse | None: ...

    async def list_by_team(
        self,
        team_id: UUID,
        *,
        user_id: UUID | None = None,
        task_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[TimeEntryResponse]: ...

    async def update(
        self, entry_id: UUID, payload: TimeEntryUpdate
    ) -> TimeEntryResponse: ...

    async def delete(self, entry_id: UUID) -> None: ...


def _row_to_response(row: dict) -> TimeEntryResponse:
    return TimeEntryResponse(
        id=row["id"],
        team_id=row["team_id"],
        user_id=row["user_id"],
        task_id=row.get("task_id"),
        work_date=row["work_date"],
        minutes=row["minutes"],
        hours=minutes_to_hours(int(row["minutes"])),
        title=row.get("title"),
        description=row.get("description"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class SupabaseTimeEntryRepository:
    """Supabase-backed time entries."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "time_entries"

    async def create(
        self, team_id: UUID, user_id: UUID, payload: TimeEntryCreate
    ) -> TimeEntryResponse:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid4()),
            "team_id": str(team_id),
            "user_id": str(user_id),
            "task_id": str(payload.task_id) if payload.task_id else None,
            "work_date": payload.work_date.isoformat(),
            "minutes": hours_to_minutes(payload.hours),
            "title": payload.title,
            "description": payload.description,
            "created_at": now,
            "updated_at": now,
        }
        result = self._client.table(self._table).insert(row).execute()
        return _row_to_response(result.data[0])

    async def get_by_id(self, entry_id: UUID) -> TimeEntryResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(entry_id))
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return _row_to_response(result.data)

    async def list_by_team(
        self,
        team_id: UUID,
        *,
        user_id: UUID | None = None,
        task_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[TimeEntryResponse]:
        query = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .order("work_date", desc=True)
            .order("created_at", desc=True)
        )
        if user_id is not None:
            query = query.eq("user_id", str(user_id))
        if task_id is not None:
            query = query.eq("task_id", str(task_id))
        if date_from is not None:
            query = query.gte("work_date", date_from.isoformat())
        if date_to is not None:
            query = query.lte("work_date", date_to.isoformat())
        result = query.execute()
        return [_row_to_response(row) for row in result.data]

    async def update(
        self, entry_id: UUID, payload: TimeEntryUpdate
    ) -> TimeEntryResponse:
        updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
        data = payload.model_dump(exclude_unset=True)

        if "work_date" in data and data["work_date"] is not None:
            updates["work_date"] = data["work_date"].isoformat()
        if "hours" in data and data["hours"] is not None:
            updates["minutes"] = hours_to_minutes(float(data["hours"]))
        if "description" in data:
            updates["description"] = data["description"]
        if "title" in data:
            updates["title"] = data["title"]

        if data.get("clear_task"):
            updates["task_id"] = None
        elif "task_id" in data:
            updates["task_id"] = (
                str(data["task_id"]) if data["task_id"] is not None else None
            )

        result = (
            self._client.table(self._table)
            .update(updates)
            .eq("id", str(entry_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Time entry not found")
        return _row_to_response(result.data[0])

    async def delete(self, entry_id: UUID) -> None:
        self._client.table(self._table).delete().eq("id", str(entry_id)).execute()


class InMemoryTimeEntryRepository:
    """In-memory store for tests."""

    def __init__(self) -> None:
        self._rows: dict[UUID, dict] = {}

    async def create(
        self, team_id: UUID, user_id: UUID, payload: TimeEntryCreate
    ) -> TimeEntryResponse:
        now = datetime.now(timezone.utc)
        entry_id = uuid4()
        row = {
            "id": entry_id,
            "team_id": team_id,
            "user_id": user_id,
            "task_id": payload.task_id,
            "work_date": payload.work_date,
            "minutes": hours_to_minutes(payload.hours),
            "title": payload.title,
            "description": payload.description,
            "created_at": now,
            "updated_at": now,
        }
        self._rows[entry_id] = row
        return _row_to_response(row)

    async def get_by_id(self, entry_id: UUID) -> TimeEntryResponse | None:
        row = self._rows.get(entry_id)
        return _row_to_response(row) if row else None

    async def list_by_team(
        self,
        team_id: UUID,
        *,
        user_id: UUID | None = None,
        task_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[TimeEntryResponse]:
        rows = [r for r in self._rows.values() if r["team_id"] == team_id]
        if user_id is not None:
            rows = [r for r in rows if r["user_id"] == user_id]
        if task_id is not None:
            rows = [r for r in rows if r["task_id"] == task_id]
        if date_from is not None:
            rows = [r for r in rows if r["work_date"] >= date_from]
        if date_to is not None:
            rows = [r for r in rows if r["work_date"] <= date_to]
        rows.sort(key=lambda r: (r["work_date"], r["created_at"]), reverse=True)
        return [_row_to_response(r) for r in rows]

    async def update(
        self, entry_id: UUID, payload: TimeEntryUpdate
    ) -> TimeEntryResponse:
        row = self._rows.get(entry_id)
        if row is None:
            raise NotFoundError("Time entry not found")
        data = payload.model_dump(exclude_unset=True)
        if "work_date" in data and data["work_date"] is not None:
            row["work_date"] = data["work_date"]
        if "hours" in data and data["hours"] is not None:
            row["minutes"] = hours_to_minutes(float(data["hours"]))
        if "description" in data:
            row["description"] = data["description"]
        if "title" in data:
            row["title"] = data["title"]
        if data.get("clear_task"):
            row["task_id"] = None
        elif "task_id" in data:
            row["task_id"] = data["task_id"]
        row["updated_at"] = datetime.now(timezone.utc)
        return _row_to_response(row)

    async def delete(self, entry_id: UUID) -> None:
        self._rows.pop(entry_id, None)
