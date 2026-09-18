"""Time entry business logic — task hours + external work."""

from datetime import date
from uuid import UUID

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.db.repositories.task_repository import TaskRepository
from app.db.repositories.timesheet_repository import TimeEntryRepository
from app.models.auth import AuthUser
from app.models.enums import Role, role_at_least
from app.models.timesheet import TimeEntryCreate, TimeEntryResponse, TimeEntryUpdate
from app.services.team_service import TeamService


class TimesheetService:
    """Manages team time entries linked to tasks or external work."""

    def __init__(
        self,
        time_repo: TimeEntryRepository,
        task_repo: TaskRepository,
        team_service: TeamService,
    ) -> None:
        self._time_repo = time_repo
        self._task_repo = task_repo
        self._team_service = team_service

    async def create_entry(
        self, team_id: UUID, payload: TimeEntryCreate, actor: AuthUser
    ) -> TimeEntryResponse:
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._validate_task(team_id, payload.task_id)
        return await self._time_repo.create(team_id, actor.id, payload)

    async def list_entries(
        self,
        team_id: UUID,
        actor: AuthUser,
        *,
        user_id: UUID | None = None,
        task_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[TimeEntryResponse]:
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        return await self._time_repo.list_by_team(
            team_id,
            user_id=user_id,
            task_id=task_id,
            date_from=date_from,
            date_to=date_to,
        )

    async def update_entry(
        self,
        team_id: UUID,
        entry_id: UUID,
        payload: TimeEntryUpdate,
        actor: AuthUser,
    ) -> TimeEntryResponse:
        role = await self._team_service.require_team_role(
            team_id, actor, Role.MEMBER
        )
        entry = await self._get_team_entry(team_id, entry_id)
        self._assert_can_mutate(entry, actor, role)

        data = payload.model_dump(exclude_unset=True)
        if not data:
            raise ValidationError("No fields to update")

        next_task = entry.task_id
        if data.get("clear_task"):
            next_task = None
        elif "task_id" in data:
            next_task = payload.task_id

        next_title = payload.title if "title" in data else entry.title
        if next_task is None and not next_title:
            raise ValidationError("External work needs a title when no task is linked")

        await self._validate_task(team_id, next_task)
        return await self._time_repo.update(entry_id, payload)

    async def delete_entry(
        self, team_id: UUID, entry_id: UUID, actor: AuthUser
    ) -> None:
        role = await self._team_service.require_team_role(
            team_id, actor, Role.MEMBER
        )
        entry = await self._get_team_entry(team_id, entry_id)
        self._assert_can_mutate(entry, actor, role)
        await self._time_repo.delete(entry_id)

    async def _get_team_entry(
        self, team_id: UUID, entry_id: UUID
    ) -> TimeEntryResponse:
        entry = await self._time_repo.get_by_id(entry_id)
        if entry is None or entry.team_id != team_id:
            raise NotFoundError("Time entry not found")
        return entry

    async def _validate_task(self, team_id: UUID, task_id: UUID | None) -> None:
        if task_id is None:
            return
        task = await self._task_repo.get_by_id(task_id)
        if task is None or task.team_id != team_id:
            raise ValidationError("Task not found on this team")

    @staticmethod
    def _assert_can_mutate(
        entry: TimeEntryResponse, actor: AuthUser, role: Role
    ) -> None:
        if entry.user_id == actor.id:
            return
        if role_at_least(role, Role.PROJECT_MANAGER):
            return
        raise PermissionDeniedError("You can only edit your own time entries")
