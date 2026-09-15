"""Team routes."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_team_service
from app.models.team import TeamCreate, TeamResponse
from app.services.team_service import TeamService

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("/org/{org_id}", response_model=TeamResponse, status_code=201)
async def create_team(
    org_id: UUID,
    payload: TeamCreate,
    user: CurrentUser,
    team_service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """Create a team within an organization (PM+ required)."""
    return await team_service.create_team(org_id, payload, user)


@router.get("/org/{org_id}", response_model=list[TeamResponse])
async def list_teams(
    org_id: UUID,
    user: CurrentUser,
    team_service: TeamService = Depends(get_team_service),
) -> list[TeamResponse]:
    """List all teams in an organization."""
    return await team_service.list_org_teams(org_id, user)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    user: CurrentUser,
    team_service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """Get team details (requires membership)."""
    from app.models.enums import Role

    await team_service.require_team_role(team_id, user, Role.GUEST)
    return await team_service.get_team(team_id)
