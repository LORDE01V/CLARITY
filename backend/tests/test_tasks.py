"""
Tests for the team Tasks API.

Covers CRUD, Kanban status moves, RBAC, and HTTP endpoints
using in-memory repositories.
"""

from datetime import date
from uuid import uuid4

import pytest

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.dependencies.auth import get_current_user
from app.models.enums import Role, TaskStatus
from app.models.org import OrganizationCreate
from app.models.task import TaskCreate, TaskStatusUpdate, TaskUpdate
from app.models.team import TeamCreate


@pytest.mark.asyncio
async def test_member_can_create_task(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Team members can create tasks on their board."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    task = await task_service.create_task(
        team.id,
        TaskCreate(title="Ship Tasks API", description="Phase 2 backend"),
        member_user,
    )

    assert task.team_id == team.id
    assert task.title == "Ship Tasks API"
    assert task.status == TaskStatus.TODO
    assert task.position == 0
    assert task.assignee_id is None
    assert task.due_date is None


@pytest.mark.asyncio
async def test_create_task_with_due_date(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Members can set a due date when creating a task."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    due = date(2026, 9, 12)
    task = await task_service.create_task(
        team.id,
        TaskCreate(title="Prepare recap", due_date=due),
        member_user,
    )

    assert task.due_date == due


@pytest.mark.asyncio
async def test_guest_cannot_create_task(
    repos, org_service, team_service, task_service, owner_user
):
    """Guests are read-only and cannot create tasks."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    guest = type(owner_user)(
        id=uuid4(), email="guest@example.com", full_name="Guest User"
    )
    await repos["member"].add_member(team.id, guest.id, Role.GUEST)

    with pytest.raises(PermissionDeniedError):
        await task_service.create_task(
            team.id, TaskCreate(title="Should fail"), guest
        )


@pytest.mark.asyncio
async def test_list_tasks_and_filter_by_status(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Listing returns team tasks and supports status filtering."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    await task_service.create_task(
        team.id, TaskCreate(title="Todo item"), member_user
    )
    in_progress = await task_service.create_task(
        team.id,
        TaskCreate(title="Active item", status=TaskStatus.IN_PROGRESS),
        member_user,
    )

    all_tasks = await task_service.list_tasks(team.id, member_user)
    assert len(all_tasks) == 2

    filtered = await task_service.list_tasks(
        team.id, member_user, status=TaskStatus.IN_PROGRESS
    )
    assert len(filtered) == 1
    assert filtered[0].id == in_progress.id


@pytest.mark.asyncio
async def test_update_and_move_task(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Members can update fields and move tasks across Kanban columns."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    task = await task_service.create_task(
        team.id, TaskCreate(title="Draft"), member_user
    )

    due = date(2026, 10, 1)
    updated = await task_service.update_task(
        team.id,
        task.id,
        TaskUpdate(title="Ready", assignee_id=member_user.id, due_date=due),
        member_user,
    )
    assert updated.title == "Ready"
    assert updated.assignee_id == member_user.id
    assert updated.due_date == due

    moved = await task_service.move_task(
        team.id,
        task.id,
        TaskStatusUpdate(status=TaskStatus.DONE),
        member_user,
    )
    assert moved.status == TaskStatus.DONE
    assert moved.position == 0


@pytest.mark.asyncio
async def test_delete_task(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Deleting a task removes it from the board."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    task = await task_service.create_task(
        team.id, TaskCreate(title="Temporary"), member_user
    )
    await task_service.delete_task(team.id, task.id, member_user)

    with pytest.raises(NotFoundError):
        await task_service.get_task(team.id, task.id, member_user)


@pytest.mark.asyncio
async def test_task_not_found_for_wrong_team(
    repos, org_service, team_service, task_service, owner_user, member_user
):
    """Tasks cannot be accessed under a different team id."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team_a = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    team_b = await team_service.create_team(
        org.id, TeamCreate(name="Design"), owner_user
    )
    await repos["member"].add_member(team_a.id, member_user.id, Role.MEMBER)
    await repos["member"].add_member(team_b.id, member_user.id, Role.MEMBER)

    task = await task_service.create_task(
        team_a.id, TaskCreate(title="Scoped"), member_user
    )

    with pytest.raises(NotFoundError):
        await task_service.get_task(team_b.id, task.id, member_user)


@pytest.mark.asyncio
async def test_create_task_api_endpoint(client, seeded_org, owner_user):
    """POST /teams/{id}/tasks returns 201 with task details."""
    team = seeded_org["team"]

    response = client.post(
        f"/api/v1/teams/{team.id}/tasks",
        json={"title": "API task", "description": "via HTTP"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "API task"
    assert data["status"] == "todo"
    assert data["team_id"] == str(team.id)


@pytest.mark.asyncio
async def test_move_task_api_endpoint(client, seeded_org, repos, member_user):
    """PATCH /teams/{id}/tasks/{task_id}/status moves Kanban column."""
    team = seeded_org["team"]
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    client.app.dependency_overrides[get_current_user] = lambda: member_user

    create_response = client.post(
        f"/api/v1/teams/{team.id}/tasks",
        json={"title": "Move me"},
    )
    assert create_response.status_code == 201
    task_id = create_response.json()["id"]

    move_response = client.patch(
        f"/api/v1/teams/{team.id}/tasks/{task_id}/status",
        json={"status": "in_progress"},
    )

    assert move_response.status_code == 200
    assert move_response.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_guest_cannot_create_task_via_api(client, seeded_org, repos):
    """POST /teams/{id}/tasks returns 403 for guests."""
    from app.models.auth import AuthUser

    team = seeded_org["team"]
    guest = AuthUser(id=uuid4(), email="guest@example.com", full_name="Guest")
    await repos["member"].add_member(team.id, guest.id, Role.GUEST)

    client.app.dependency_overrides[get_current_user] = lambda: guest

    response = client.post(
        f"/api/v1/teams/{team.id}/tasks",
        json={"title": "Blocked"},
    )

    assert response.status_code == 403
