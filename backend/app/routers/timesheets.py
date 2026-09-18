"""Team timesheets — log hours on tasks or external work."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_timesheet_service
from app.dependencies.rbac import require_team_role
from app.models.enums import Role
from app.models.timesheet import TimeEntryCreate, TimeEntryResponse, TimeEntryUpdate
from app.services.timesheet_service import TimesheetService

router = APIRouter(prefix="/teams/{team_id}/timesheets", tags=["timesheets"])


@router.get("", response_model=list[TimeEntryResponse])
async def list_time_entries(
    team_id: UUID,
    user: CurrentUser,
    user_id: UUID | None = Query(default=None),
    task_id: UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    _role: Role = Depends(require_team_role(Role.GUEST)),
    timesheet_service: TimesheetService = Depends(get_timesheet_service),
) -> list[TimeEntryResponse]:
    """List team time entries, optionally filtered by person, task, or date range."""
    return await timesheet_service.list_entries(
        team_id,
        user,
        user_id=user_id,
        task_id=task_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("", response_model=TimeEntryResponse, status_code=201)
async def create_time_entry(
    team_id: UUID,
    payload: TimeEntryCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    timesheet_service: TimesheetService = Depends(get_timesheet_service),
) -> TimeEntryResponse:
    """Log hours against a task or external work (Member+)."""
    return await timesheet_service.create_entry(team_id, payload, user)


@router.patch("/{entry_id}", response_model=TimeEntryResponse)
async def update_time_entry(
    team_id: UUID,
    entry_id: UUID,
    payload: TimeEntryUpdate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    timesheet_service: TimesheetService = Depends(get_timesheet_service),
) -> TimeEntryResponse:
    """Update a time entry (own entries, or PM+ for anyone)."""
    return await timesheet_service.update_entry(team_id, entry_id, payload, user)


@router.delete("/{entry_id}", status_code=204)
async def delete_time_entry(
    team_id: UUID,
    entry_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    timesheet_service: TimesheetService = Depends(get_timesheet_service),
) -> None:
    """Delete a time entry (own entries, or PM+ for anyone)."""
    await timesheet_service.delete_entry(team_id, entry_id, user)
