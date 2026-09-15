"""Team invite routes."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_invite_service
from app.dependencies.rbac import require_team_role
from app.models.enums import Role
from app.models.invite import (
    InviteAcceptRequest,
    InviteAcceptResponse,
    InviteCreate,
    InviteResponse,
)
from app.services.invite_service import InviteService

router = APIRouter(tags=["invites"])


@router.post(
    "/teams/{team_id}/invites",
    response_model=InviteResponse,
    status_code=201,
)
async def create_invite(
    team_id: UUID,
    payload: InviteCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.PROJECT_MANAGER)),
    invite_service: InviteService = Depends(get_invite_service),
) -> InviteResponse:
    """
    Create a team-scoped invite with role assignment.

    Requires Project Manager role or above within the team.
    """
    return await invite_service.create_invite(team_id, payload, user)


@router.get("/invites/{token}", response_model=InviteResponse)
async def get_invite(
    token: str,
    invite_service: InviteService = Depends(get_invite_service),
) -> InviteResponse:
    """Preview an invite by token (public, no auth required)."""
    return await invite_service.get_invite_by_token(token)


@router.post("/invites/{token}/accept", response_model=InviteAcceptResponse)
async def accept_invite(
    token: str,
    user: CurrentUser,
    _body: InviteAcceptRequest | None = None,
    invite_service: InviteService = Depends(get_invite_service),
) -> InviteAcceptResponse:
    """Accept a pending team invite."""
    return await invite_service.accept_invite(token, user)
