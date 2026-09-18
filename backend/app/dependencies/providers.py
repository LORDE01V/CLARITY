"""Service and repository dependency providers."""

from app.core.config import get_settings
from app.db.repositories.chat_repository import SupabaseChatRepository
from app.db.repositories.document_repository import SupabaseDocumentRepository
from app.db.repositories.github_event_repository import (
    SupabaseGitHubEventRepository,
    get_shared_github_event_store,
)
from app.db.repositories.github_installation_repository import (
    SupabaseGitHubInstallationRepository,
    get_shared_github_installation_store,
)
from app.db.repositories.invite_repository import SupabaseInviteRepository
from app.db.repositories.org_repository import SupabaseOrganizationRepository
from app.db.repositories.task_repository import SupabaseTaskRepository
from app.db.repositories.team_repository import (
    SupabaseMemberRepository,
    SupabaseTeamRepository,
)
from app.db.repositories.timesheet_repository import SupabaseTimeEntryRepository
from app.db.supabase import get_supabase_client
from app.services.auth_service import AuthService
from app.services.chat_service import ChatService
from app.services.document_service import DocumentService
from app.services.github_service import GitHubService
from app.services.invite_service import InviteService
from app.services.openai_recap import OpenAIRecapClient
from app.services.org_service import OrganizationService
from app.services.recap_service import RecapService
from app.services.task_service import TaskService
from app.services.team_service import TeamService
from app.services.timesheet_service import TimesheetService
from app.db.repositories.meeting_repository import SupabaseMeetingRepository
from app.db.repositories.recap_repository import SupabaseRecapRepository
from app.services.meeting_service import MeetingService
from app.services.openai_whisper import OpenAIWhisperClient


def get_settings_dep():
    """FastAPI-friendly settings dependency."""
    return get_settings()


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
    from app.services.chat_service import SupabaseUserProfileProvider

    client = get_supabase_client()
    return TeamService(
        team_repo=SupabaseTeamRepository(client),
        member_repo=SupabaseMemberRepository(client),
        org_repo=SupabaseOrganizationRepository(client),
        user_profiles=SupabaseUserProfileProvider(client),
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


def get_timesheet_service() -> TimesheetService:
    """Provide TimesheetService with Supabase repositories."""
    client = get_supabase_client()
    return TimesheetService(
        time_repo=SupabaseTimeEntryRepository(client),
        task_repo=SupabaseTaskRepository(client),
        team_service=get_team_service(),
    )


def get_document_service() -> DocumentService:
    """Provide DocumentService with Supabase repositories."""
    client = get_supabase_client()
    return DocumentService(
        document_repo=SupabaseDocumentRepository(client),
        team_service=get_team_service(),
    )


def get_chat_service() -> ChatService:
    """Provide ChatService with Supabase repositories (service-role DB client)."""
    from app.services.chat_service import SupabaseUserProfileProvider

    client = get_supabase_client()
    return ChatService(
        chat_repo=SupabaseChatRepository(client),
        team_service=get_team_service(),
        user_profiles=SupabaseUserProfileProvider(client),
    )


def get_auth_service() -> AuthService:
    """Provide AuthService with the anon auth client (not the service-role DB client)."""
    from app.db.supabase import get_supabase_auth_client

    return AuthService(get_supabase_auth_client())


def get_github_service() -> GitHubService:
    """
    Provide GitHubService with Supabase-backed event + installation stores.

    Falls back to in-memory stores only when the Supabase client cannot be
    created (local tests without env). Task completion on merged PRs is
    best-effort when a task repository is injected (tests).
    """
    try:
        client = get_supabase_client()
        event_repo = SupabaseGitHubEventRepository(client)
        installation_repo = SupabaseGitHubInstallationRepository(client)
    except Exception:
        event_repo = get_shared_github_event_store()
        installation_repo = get_shared_github_installation_store()

    return GitHubService(
        settings=get_settings(),
        event_repo=event_repo,
        installation_repo=installation_repo,
        task_repo=None,
    )


def get_recap_service() -> RecapService:
    """Provide RecapService with Supabase + OpenAI (env-configured)."""
    settings = get_settings()
    client = get_supabase_client()
    return RecapService(
        recap_repo=SupabaseRecapRepository(client),
        team_service=get_team_service(),
        chat_service=get_chat_service(),
        openai=OpenAIRecapClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        ),
    )


def get_meeting_service() -> MeetingService:
    """Provide MeetingService with Jitsi URL builder + Whisper."""
    settings = get_settings()
    client = get_supabase_client()
    return MeetingService(
        meeting_repo=SupabaseMeetingRepository(client),
        team_service=get_team_service(),
        whisper=OpenAIWhisperClient(
            api_key=settings.openai_api_key,
            model=settings.openai_whisper_model,
        ),
        recap_service=get_recap_service(),
        jitsi_base_url=settings.jitsi_base_url,
    )
