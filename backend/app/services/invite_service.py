"""
Team invite business logic.

Handles invite creation (PM+ only), validation, and acceptance flow.
Invites are scoped to a specific team and carry a role assignment.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.core.config import Settings, get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.repositories.invite_repository import (
    InviteRepository,
    compute_invite_expiry,
)
from app.db.repositories.team_repository import MemberRepository, TeamRepository
from app.models.auth import AuthUser
from app.models.enums import Role, role_at_least
from app.models.invite import (
    InviteAcceptResponse,
    InviteCreate,
    InviteResponse,
)
from app.services.team_service import TeamService


class InviteService:
    """Manages the team invite lifecycle: create, validate, accept."""

    def __init__(
        self,
        invite_repo: InviteRepository,
        member_repo: MemberRepository,
        team_repo: TeamRepository,
        team_service: TeamService,
        settings: Settings | None = None,
    ) -> None:
        self._invite_repo = invite_repo
        self._member_repo = member_repo
        self._team_repo = team_repo
        self._team_service = team_service
        self._settings = settings or get_settings()

    async def create_invite(
        self, team_id: UUID, payload: InviteCreate, actor: AuthUser
    ) -> InviteResponse:
        """
        Create a team-scoped invite with role assignment.

        Only Project Managers and above may invite. Inviters cannot assign
        a role higher than their own within the team.
        """
        actor_role = await self._team_service.require_team_role(
            team_id, actor, Role.PROJECT_MANAGER
        )
        self._validate_assignable_role(actor_role, payload.role)

        team = await self._team_repo.get_by_id(team_id)
        if team is None:
            raise NotFoundError("Team not found")

        expires_at = compute_invite_expiry(self._settings)

        invite = await self._invite_repo.create(
            team_id=team_id,
            payload=payload,
            invited_by=actor.id,
            expires_at=expires_at,
        )
        return invite

    async def get_invite_by_token(self, token: str) -> InviteResponse:
        """Look up an invite by its token for preview or acceptance."""
        invite = await self._invite_repo.get_by_token(token)
        if invite is None:
            raise NotFoundError("Invite not found")
        return invite

    async def accept_invite(
        self, token: str, user: AuthUser
    ) -> InviteAcceptResponse:
        """
        Accept a pending invite and create team membership.

        Validates token expiry, email match, and pending status.
        """
        invite = await self.get_invite_by_token(token)
        self._validate_invite(invite, user)

        existing = await self._member_repo.get_membership(invite.team_id, user.id)
        if existing is not None:
            raise ConflictError("You are already a member of this team")

        membership = await self._member_repo.add_member(
            invite.team_id, user.id, invite.role
        )
        await self._invite_repo.mark_accepted(invite.id)

        return InviteAcceptResponse(
            team_id=invite.team_id,
            role=invite.role,
            membership_id=membership.id,
        )

    def _validate_invite(self, invite: InviteResponse, user: AuthUser) -> None:
        """Ensure the invite is valid for acceptance by the given user."""
        if invite.accepted_at is not None:
            raise ValidationError("This invite has already been accepted")

        now = datetime.now(timezone.utc)
        expires = invite.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if now > expires:
            raise ValidationError("This invite has expired")

        if user.email.lower() != invite.email.lower():
            raise ValidationError("This invite was sent to a different email address")

    @staticmethod
    def _validate_assignable_role(actor_role: Role, assigned_role: Role) -> None:
        """Prevent inviting users to a role above the inviter's level."""
        if assigned_role == Role.OWNER:
            raise ValidationError("Owner role cannot be assigned via invite")
        if not role_at_least(actor_role, assigned_role):
            raise ValidationError(
                f"Cannot assign role '{assigned_role.value}' "
                f"with your role '{actor_role.value}'"
            )
