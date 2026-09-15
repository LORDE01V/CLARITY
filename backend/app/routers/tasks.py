"""Team task routes for Kanban CRUD and status moves."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_task_service
from app.dependencies.rbac import require_team_role
from app.models.enums import Role, TaskStatus
from app.models.task import (
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/teams/{team_id}/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    team_id: UUID,
    payload: TaskCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Create a task on the team board (Member+ required)."""
    return await task_service.create_task(team_id, payload, user)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    team_id: UUID,
    user: CurrentUser,
    status: TaskStatus | None = Query(default=None),
    _role: Role = Depends(require_team_role(Role.GUEST)),
    task_service: TaskService = Depends(get_task_service),
) -> list[TaskResponse]:
    """List team tasks, optionally filtered by Kanban status."""
    return await task_service.list_tasks(team_id, user, status)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    team_id: UUID,
    task_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Get a single task within a team."""
    return await task_service.get_task(team_id, task_id, user)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    team_id: UUID,
    task_id: UUID,
    payload: TaskUpdate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Update task title, description, assignee, or position."""
    return await task_service.update_task(team_id, task_id, payload, user)


@router.patch("/{task_id}/status", response_model=TaskResponse)
async def move_task(
    team_id: UUID,
    task_id: UUID,
    payload: TaskStatusUpdate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Move a task between Kanban columns (todo / in_progress / done)."""
    return await task_service.move_task(team_id, task_id, payload, user)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    team_id: UUID,
    task_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    task_service: TaskService = Depends(get_task_service),
) -> None:
    """Delete a task from the team board."""
    await task_service.delete_task(team_id, task_id, user)
