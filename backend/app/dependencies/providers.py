"""Service and repository dependency providers."""

from app.core.config import get_settings
from app.db.repositories.chat_repository import SupabaseChatRepository
from app.db.repositories.github_event_repository import get_shared_github_event_store
from app.db.repositories.github_installation_repository import (
    get_shared_github_installation_store,
)
from app.db.repositories.invite_repository import SupabaseInviteRepository
from app.db.repositories.org_repository import SupabaseOrganizationRepository
from app.db.repositories.task_repository import SupabaseTaskRepository
from app.db.repositories.team_repository import (
    SupabaseMemberRepository,
    SupabaseTeamRepository,
)
from app.db.supabase import get_supabase_client
from app.services.auth_service import AuthService
from app.services.chat_service import ChatService
from app.services.github_service import GitHubService
from app.services.invite_service import InviteService
from app.services.org_service import OrganizationService
from app.services.task_service import TaskService
from app.services.team_service import TeamService


def get_org_service() -> OrganizationService:
    """Provide OrganizationService with Supabase repositories."""
    client = get_supabase_client()
    team_repo = SupabaseTeamRepository(client)
    member_repo = SupabaseMemberRepository(client)
    return OrganizationService(
        org_repo=SupabaseOrganizationRepository(client),
        team_repo=team_repo,
        member_repo=member_repo,
    )


def get_team_service() -> TeamService:
    """Provide TeamService with Supabase repositories."""
    client = get_supabase_client()
    return TeamService(
        team_repo=SupabaseTeamRepository(client),
        member_repo=SupabaseMemberRepository(client),
        org_repo=SupabaseOrganizationRepository(client),
    )


def get_invite_service() -> InviteService:
    """Provide InviteService with Supabase repositories."""
    client = get_supabase_client()
    team_service = get_team_service()
    return InviteService(
        invite_repo=SupabaseInviteRepository(client),
        member_repo=SupabaseMemberRepository(client),
        team_repo=SupabaseTeamRepository(client),
        team_service=team_service,
    )


def get_task_service() -> TaskService:
    """Provide TaskService with Supabase repositories."""
    client = get_supabase_client()
    return TaskService(
        task_repo=SupabaseTaskRepository(client),
        team_service=get_team_service(),
    )


def get_chat_service() -> ChatService:
    """Provide ChatService with Supabase repositories."""
    client = get_supabase_client()
    return ChatService(
        chat_repo=SupabaseChatRepository(client),
        team_service=get_team_service(),
    )


def get_auth_service() -> AuthService:
    """Provide AuthService with the anon auth client (not the service-role DB client)."""
    from app.db.supabase import get_supabase_auth_client

    return AuthService(get_supabase_auth_client())


def get_github_service() -> GitHubService:
    """
    Provide GitHubService with shared in-memory event + installation stores.

    Task completion on merged PRs is best-effort and only activates when a
    task repository exposing an in-memory map is injected (tests / local wiring).
    """
    return GitHubService(
        settings=get_settings(),
        event_repo=get_shared_github_event_store(),
        installation_repo=get_shared_github_installation_store(),
        task_repo=None,
    )
