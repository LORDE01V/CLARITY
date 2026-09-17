"""Team meeting recap routes (OpenAI GPT-4o draft → review → chat)."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_recap_service, get_settings_dep
from app.dependencies.rbac import require_team_role
from app.models.enums import Role
from app.models.recap import (
    RecapGenerateRequest,
    RecapResponse,
    RecapSendRequest,
    RecapUpdateRequest,
)
from app.core.config import Settings
from app.services.recap_service import RecapService

router = APIRouter(tags=["recaps"])


@router.get("/meetings/health")
async def meetings_health(
    settings: Settings = Depends(get_settings_dep),
) -> dict[str, str | bool]:
    """Deploy-safe health: reports whether OpenAI recap generation is configured."""
    configured = bool(settings.openai_api_key.strip())
    return {
        "status": "ok" if configured else "openai_not_configured",
        "openai_configured": configured,
        "model": settings.openai_model,
    }


@router.post(
    "/teams/{team_id}/recaps/generate",
    response_model=RecapResponse,
    status_code=201,
)
async def generate_recap(
    team_id: UUID,
    payload: RecapGenerateRequest,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    recap_service: RecapService = Depends(get_recap_service),
) -> RecapResponse:
    """Generate an AI draft recap from a transcript or notes (GPT-4o)."""
    return await recap_service.generate(team_id, payload, user)


@router.get("/teams/{team_id}/recaps", response_model=list[RecapResponse])
async def list_recaps(
    team_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    recap_service: RecapService = Depends(get_recap_service),
) -> list[RecapResponse]:
    """List meeting recaps for the team (newest first)."""
    return await recap_service.list_recaps(team_id, user)


@router.get("/teams/{team_id}/recaps/{recap_id}", response_model=RecapResponse)
async def get_recap(
    team_id: UUID,
    recap_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    recap_service: RecapService = Depends(get_recap_service),
) -> RecapResponse:
    """Fetch a single recap."""
    return await recap_service.get_recap(team_id, recap_id, user)


@router.patch("/teams/{team_id}/recaps/{recap_id}", response_model=RecapResponse)
async def update_recap(
    team_id: UUID,
    recap_id: UUID,
    payload: RecapUpdateRequest,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    recap_service: RecapService = Depends(get_recap_service),
) -> RecapResponse:
    """Human review: edit summary / action items before send."""
    return await recap_service.update_recap(team_id, recap_id, payload, user)


@router.post(
    "/teams/{team_id}/recaps/{recap_id}/send",
    response_model=RecapResponse,
)
async def send_recap(
    team_id: UUID,
    recap_id: UUID,
    payload: RecapSendRequest,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    recap_service: RecapService = Depends(get_recap_service),
) -> RecapResponse:
    """Send the recap into team chat (#general by default)."""
    return await recap_service.send_recap(team_id, recap_id, payload, user)
