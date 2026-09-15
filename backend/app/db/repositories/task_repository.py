"""Task repository protocol and implementations."""

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.models.enums import TaskStatus
from app.models.task import TaskCreate, TaskResponse, TaskUpdate


class TaskRepository(Protocol):
    """Contract for team task persistence."""

    async def create(self, team_id: UUID, payload: TaskCreate) -> TaskResponse: ...

    async def get_by_id(self, task_id: UUID) -> TaskResponse | None: ...

    async def list_by_team(
        self, team_id: UUID, status: TaskStatus | None = None
    ) -> list[TaskResponse]: ...

    async def update(self, task_id: UUID, payload: TaskUpdate) -> TaskResponse: ...

    async def update_status(
        self, task_id: UUID, status: TaskStatus, position: int | None = None
    ) -> TaskResponse: ...

    async def delete(self, task_id: UUID) -> None: ...

    async def next_position(self, team_id: UUID, status: TaskStatus) -> int: ...


class SupabaseTaskRepository:
    """Supabase-backed task repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "tasks"

    async def create(self, team_id: UUID, payload: TaskCreate) -> TaskResponse:
        position = payload.position
        if position is None:
            position = await self.next_position(team_id, payload.status)

        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid4()),
            "team_id": str(team_id),
            "title": payload.title,
            "description": payload.description,
            "status": payload.status.value,
            "assignee_id": str(payload.assignee_id) if payload.assignee_id else None,
            "due_date": payload.due_date.isoformat() if payload.due_date else None,
            "position": position,
            "created_at": now,
            "updated_at": now,
        }
        result = self._client.table(self._table).insert(row).execute()
        return TaskResponse(**result.data[0])

    async def get_by_id(self, task_id: UUID) -> TaskResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(task_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return TaskResponse(**result.data)

    async def list_by_team(
        self, team_id: UUID, status: TaskStatus | None = None
    ) -> list[TaskResponse]:
        query = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .order("position")
        )
        if status is not None:
            query = query.eq("status", status.value)
        result = query.execute()
        return [TaskResponse(**row) for row in result.data]

    async def update(self, task_id: UUID, payload: TaskUpdate) -> TaskResponse:
        updates = payload.model_dump(exclude_unset=True)
        if "assignee_id" in updates and updates["assignee_id"] is not None:
            updates["assignee_id"] = str(updates["assignee_id"])
        if "due_date" in updates and updates["due_date"] is not None:
            updates["due_date"] = updates["due_date"].isoformat()
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            self._client.table(self._table)
            .update(updates)
            .eq("id", str(task_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Task not found")
        return TaskResponse(**result.data[0])

    async def update_status(
        self, task_id: UUID, status: TaskStatus, position: int | None = None
    ) -> TaskResponse:
        updates: dict = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if position is not None:
            updates["position"] = position
        else:
            task = await self.get_by_id(task_id)
            if task is None:
                raise NotFoundError("Task not found")
            updates["position"] = await self.next_position(task.team_id, status)

        result = (
            self._client.table(self._table)
            .update(updates)
            .eq("id", str(task_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Task not found")
        return TaskResponse(**result.data[0])

    async def delete(self, task_id: UUID) -> None:
        result = (
            self._client.table(self._table)
            .delete()
            .eq("id", str(task_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Task not found")

    async def next_position(self, team_id: UUID, status: TaskStatus) -> int:
        result = (
            self._client.table(self._table)
            .select("position")
            .eq("team_id", str(team_id))
            .eq("status", status.value)
            .order("position", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return 0
        return int(result.data[0]["position"]) + 1


class InMemoryTaskRepository:
    """In-memory task store for unit tests."""

    def __init__(self) -> None:
        self._tasks: dict[UUID, TaskResponse] = {}

    async def create(self, team_id: UUID, payload: TaskCreate) -> TaskResponse:
        position = payload.position
        if position is None:
            position = await self.next_position(team_id, payload.status)

        now = datetime.now(timezone.utc)
        task = TaskResponse(
            id=uuid4(),
            team_id=team_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            assignee_id=payload.assignee_id,
            due_date=payload.due_date,
            position=position,
            created_at=now,
            updated_at=now,
        )
        self._tasks[task.id] = task
        return task

    async def get_by_id(self, task_id: UUID) -> TaskResponse | None:
        return self._tasks.get(task_id)

    async def list_by_team(
        self, team_id: UUID, status: TaskStatus | None = None
    ) -> list[TaskResponse]:
        tasks = [t for t in self._tasks.values() if t.team_id == team_id]
        if status is not None:
            tasks = [t for t in tasks if t.status == status]
        return sorted(tasks, key=lambda t: (t.status.value, t.position))

    async def update(self, task_id: UUID, payload: TaskUpdate) -> TaskResponse:
        task = self._tasks.get(task_id)
        if task is None:
            raise NotFoundError("Task not found")

        updates = payload.model_dump(exclude_unset=True)
        updates["updated_at"] = datetime.now(timezone.utc)
        updated = task.model_copy(update=updates)
        self._tasks[task_id] = updated
        return updated

    async def update_status(
        self, task_id: UUID, status: TaskStatus, position: int | None = None
    ) -> TaskResponse:
        task = self._tasks.get(task_id)
        if task is None:
            raise NotFoundError("Task not found")

        new_position = position
        if new_position is None:
            new_position = await self.next_position(task.team_id, status)

        updated = task.model_copy(
            update={
                "status": status,
                "position": new_position,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._tasks[task_id] = updated
        return updated

    async def delete(self, task_id: UUID) -> None:
        if task_id not in self._tasks:
            raise NotFoundError("Task not found")
        del self._tasks[task_id]

    async def next_position(self, team_id: UUID, status: TaskStatus) -> int:
        positions = [
            t.position
            for t in self._tasks.values()
            if t.team_id == team_id and t.status == status
        ]
        if not positions:
            return 0
        return max(positions) + 1
