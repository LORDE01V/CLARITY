"""Unit tests for task-linked and external time entries."""

from datetime import date
from uuid import uuid4

import pytest

from app.core.exceptions import PermissionDeniedError, ValidationError
from app.db.repositories.task_repository import InMemoryTaskRepository
from app.db.repositories.timesheet_repository import InMemoryTimeEntryRepository
from app.models.enums import Role
from app.models.org import OrganizationCreate
from app.models.task import TaskCreate
from app.models.timesheet import TimeEntryCreate, TimeEntryUpdate, hours_to_minutes
from app.services.task_service import TaskService
from app.services.timesheet_service import TimesheetService


def test_hours_to_minutes_rounds():
    assert hours_to_minutes(1) == 60
    assert hours_to_minutes(1.5) == 90
    assert hours_to_minutes(0.25) == 15


@pytest.mark.asyncio
async def test_log_task_and_external_hours(org_service, team_service, owner_user):
    org = await org_service.create_organization(
        OrganizationCreate(name="Time Co", slug=f"time-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    task_repo = InMemoryTaskRepository()
    task_service = TaskService(task_repo=task_repo, team_service=team_service)
    task = await task_service.create_task(
        team.id, TaskCreate(title="Lab report draft"), owner_user
    )

    service = TimesheetService(
        time_repo=InMemoryTimeEntryRepository(),
        task_repo=task_repo,
        team_service=team_service,
    )

    on_task = await service.create_entry(
        team.id,
        TimeEntryCreate(
            work_date=date(2026, 3, 18),
            hours=2.5,
            task_id=task.id,
            description="Draft methods section",
        ),
        owner_user,
    )
    assert on_task.task_id == task.id
    assert on_task.minutes == 150
    assert on_task.hours == 2.5

    external = await service.create_entry(
        team.id,
        TimeEntryCreate(
            work_date=date(2026, 3, 18),
            hours=1,
            title="Client site visit",
            description="Offsite sampling",
        ),
        owner_user,
    )
    assert external.task_id is None
    assert external.title == "Client site visit"

    listed = await service.list_entries(team.id, owner_user)
    assert len(listed) == 2


@pytest.mark.asyncio
async def test_external_requires_title(org_service, team_service, owner_user):
    org = await org_service.create_organization(
        OrganizationCreate(name="Title Co", slug=f"title-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    service = TimesheetService(
        time_repo=InMemoryTimeEntryRepository(),
        task_repo=InMemoryTaskRepository(),
        team_service=team_service,
    )
    with pytest.raises(Exception):
        TimeEntryCreate(work_date=date(2026, 3, 18), hours=1)


@pytest.mark.asyncio
async def test_member_cannot_edit_others_entry(
    org_service, team_service, owner_user, member_user, repos
):
    org = await org_service.create_organization(
        OrganizationCreate(name="Perm Co", slug=f"perm-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    task_repo = InMemoryTaskRepository()
    service = TimesheetService(
        time_repo=InMemoryTimeEntryRepository(),
        task_repo=task_repo,
        team_service=team_service,
    )
    entry = await service.create_entry(
        team.id,
        TimeEntryCreate(
            work_date=date(2026, 3, 18), hours=1, title="Owner work"
        ),
        owner_user,
    )

    with pytest.raises(PermissionDeniedError):
        await service.update_entry(
            team.id,
            entry.id,
            TimeEntryUpdate(hours=2),
            member_user,
        )


@pytest.mark.asyncio
async def test_reject_foreign_task(org_service, team_service, owner_user):
    org = await org_service.create_organization(
        OrganizationCreate(name="Foreign Co", slug=f"fx-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    service = TimesheetService(
        time_repo=InMemoryTimeEntryRepository(),
        task_repo=InMemoryTaskRepository(),
        team_service=team_service,
    )
    with pytest.raises(ValidationError):
        await service.create_entry(
            team.id,
            TimeEntryCreate(
                work_date=date(2026, 3, 18),
                hours=1,
                task_id=uuid4(),
            ),
            owner_user,
        )
