"""Task business logic for team-scoped Kanban boards."""

from uuid import UUID

from app.core.exceptions import NotFoundError, ValidationError
from app.db.repositories.task_repository import TaskRepository
from app.models.auth import AuthUser
from app.models.enums import Role, TaskStatus
from app.models.task import (
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.team_service import TeamService


class TaskService:
    """Manages CRUD and status moves for team tasks."""

    def __init__(
        self,
        task_repo: TaskRepository,
        team_service: TeamService,
    ) -> None:
        self._task_repo = task_repo
        self._team_service = team_service

    async def create_task(
        self, team_id: UUID, payload: TaskCreate, actor: AuthUser
    ) -> TaskResponse:
        """Create a task on a team board (Member+ required)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        return await self._task_repo.create(team_id, payload)

    async def list_tasks(
        self,
        team_id: UUID,
        actor: AuthUser,
        status: TaskStatus | None = None,
    ) -> list[TaskResponse]:
        """List tasks for a team, optionally filtered by status."""
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        return await self._task_repo.list_by_team(team_id, status)

    async def get_task(
        self, team_id: UUID, task_id: UUID, actor: AuthUser
    ) -> TaskResponse:
        """Fetch a single task within a team."""
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        return await self._get_team_task(team_id, task_id)

    async def update_task(
        self,
        team_id: UUID,
        task_id: UUID,
        payload: TaskUpdate,
        actor: AuthUser,
    ) -> TaskResponse:
        """Update task fields (Member+ required)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_task(team_id, task_id)

        if not payload.model_dump(exclude_unset=True):
            raise ValidationError("No fields to update")

        return await self._task_repo.update(task_id, payload)

    async def move_task(
        self,
        team_id: UUID,
        task_id: UUID,
        payload: TaskStatusUpdate,
        actor: AuthUser,
    ) -> TaskResponse:
        """Move a task to another Kanban column (Member+ required)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_task(team_id, task_id)
        return await self._task_repo.update_status(
            task_id, payload.status, payload.position
        )

    async def delete_task(
        self, team_id: UUID, task_id: UUID, actor: AuthUser
    ) -> None:
        """Delete a task (Member+ required)."""
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_task(team_id, task_id)
        await self._task_repo.delete(task_id)

    async def _get_team_task(self, team_id: UUID, task_id: UUID) -> TaskResponse:
        task = await self._task_repo.get_by_id(task_id)
        if task is None or task.team_id != team_id:
            raise NotFoundError("Task not found")
        return task
