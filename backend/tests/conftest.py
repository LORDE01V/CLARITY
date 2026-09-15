"""
Shared pytest fixtures for CLARITY backend tests.

Uses in-memory repositories and dependency overrides so tests run
without a live Supabase connection.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.repositories.chat_repository import InMemoryChatRepository
from app.db.repositories.invite_repository import InMemoryInviteRepository
from app.db.repositories.org_repository import InMemoryOrganizationRepository
from app.db.repositories.task_repository import InMemoryTaskRepository
from app.db.repositories.team_repository import (
    InMemoryMemberRepository,
    InMemoryTeamRepository,
)
from app.dependencies.auth import get_current_user
from app.dependencies.providers import (
    get_chat_service,
    get_invite_service,
    get_org_service,
    get_task_service,
    get_team_service,
)
from app.main import create_app
from app.models.auth import AuthUser
from app.models.enums import Role
from app.models.org import OrganizationCreate
from app.models.team import TeamCreate
from app.services.chat_service import ChatService
from app.services.invite_service import InviteService
from app.services.org_service import OrganizationService
from app.services.task_service import TaskService
from app.services.team_service import TeamService

@pytest.fixture
def settings() -> Settings:
    """Test settings with short invite expiry."""
    return Settings(
        supabase_url="http://localhost:54321",
        supabase_anon_key="test-anon-key",
        supabase_service_role_key="test-service-key",
        supabase_jwt_secret="test-jwt-secret",
        invite_token_expire_hours=72,
    )


@pytest.fixture
def owner_user() -> AuthUser:
    return AuthUser(id=uuid4(), email="owner@example.com", full_name="Org Owner")


@pytest.fixture
def pm_user() -> AuthUser:
    return AuthUser(id=uuid4(), email="pm@example.com", full_name="Project Manager")


@pytest.fixture
def member_user() -> AuthUser:
    return AuthUser(id=uuid4(), email="member@example.com", full_name="Team Member")


@pytest.fixture
def invitee_user() -> AuthUser:
    return AuthUser(id=uuid4(), email="invitee@example.com", full_name="Invitee")


@pytest.fixture
def repos():
    """Fresh in-memory repositories for each test."""
    return {
        "org": InMemoryOrganizationRepository(),
        "team": InMemoryTeamRepository(),
        "member": InMemoryMemberRepository(),
        "invite": InMemoryInviteRepository(),
        "task": InMemoryTaskRepository(),
        "chat": InMemoryChatRepository(),
    }


@pytest.fixture
def org_service(repos) -> OrganizationService:
    return OrganizationService(
        org_repo=repos["org"],
        team_repo=repos["team"],
        member_repo=repos["member"],
    )


@pytest.fixture
def team_service(repos) -> TeamService:
    return TeamService(
        team_repo=repos["team"],
        member_repo=repos["member"],
        org_repo=repos["org"],
    )


@pytest.fixture
def invite_service(repos, team_service, settings) -> InviteService:
    return InviteService(
        invite_repo=repos["invite"],
        member_repo=repos["member"],
        team_repo=repos["team"],
        team_service=team_service,
        settings=settings,
    )


@pytest.fixture
def task_service(repos, team_service) -> TaskService:
    return TaskService(
        task_repo=repos["task"],
        team_service=team_service,
    )


@pytest.fixture
def chat_service(repos, team_service) -> ChatService:
    return ChatService(
        chat_repo=repos["chat"],
        team_service=team_service,
    )


@pytest.fixture
async def seeded_org(repos, org_service, owner_user):
    """Create an org with a default team and owner membership."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await repos["team"].list_by_org(org.id)
    return {"org": org, "team": teams[0]}


@pytest.fixture
def client(
    repos,
    org_service,
    team_service,
    invite_service,
    task_service,
    chat_service,
    owner_user,
):
    """FastAPI test client with in-memory services and auth override."""
    app = create_app()

    async def override_user():
        return owner_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_org_service] = lambda: org_service
    app.dependency_overrides[get_team_service] = lambda: team_service
    app.dependency_overrides[get_invite_service] = lambda: invite_service
    app.dependency_overrides[get_task_service] = lambda: task_service
    app.dependency_overrides[get_chat_service] = lambda: chat_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
