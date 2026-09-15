"""
Role-based access control dependencies.

Composable FastAPI dependencies that enforce minimum role requirements
on team-scoped endpoints. Built on top of get_current_user.
"""

from typing import Annotated, Callable
from uuid import UUID

from fastapi import Depends, Path

from app.dependencies.auth import CurrentUser
from app.models.enums import Role
from app.dependencies.providers import get_team_service
from app.services.team_service import TeamService


def require_team_role(min_role: Role) -> Callable:
    """
    Factory that returns a dependency requiring min_role in a team.

    Usage:
        @router.post("/teams/{team_id}/invites")
        async def create_invite(
            team_id: UUID,
            role: Role = Depends(require_team_role(Role.PROJECT_MANAGER)),
            ...
        )
    """

    async def _check(
        team_id: Annotated[UUID, Path()],
        user: CurrentUser,
        team_service: TeamService = Depends(get_team_service),
    ) -> Role:
        return await team_service.require_team_role(team_id, user, min_role)

    return _check
