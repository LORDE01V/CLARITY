"""Team business logic."""

from typing import Protocol
from uuid import UUID

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.repositories.org_repository import OrganizationRepository
from app.db.repositories.team_repository import MemberRepository, TeamRepository
from app.models.auth import AuthUser
from app.models.enums import Role, role_at_least
from app.models.team import TeamCreate, TeamMemberWithUser, TeamResponse


class UserProfileProvider(Protocol):
    async def get_profile(self, user_id: UUID) -> tuple[str, str | None]: ...


class TeamService:
    """Manages teams and membership within organizations."""

    def __init__(
        self,
        team_repo: TeamRepository,
        member_repo: MemberRepository,
        org_repo: OrganizationRepository,
        user_profiles: UserProfileProvider | None = None,
    ) -> None:
        self._team_repo = team_repo
        self._member_repo = member_repo
        self._org_repo = org_repo
        self._user_profiles = user_profiles

    async def create_team(
        self, org_id: UUID, payload: TeamCreate, actor: AuthUser
    ) -> TeamResponse:
        """
        Create a team within an organization.

        Requires the actor to be org owner or PM+ in any team of the org.
        """
        await self._require_org_role(org_id, actor, Role.PROJECT_MANAGER)
        team = await self._team_repo.create(org_id, payload)

        actor_role = await self._resolve_org_role(org_id, actor)
        await self._member_repo.add_member(team.id, actor.id, actor_role)
        return team

    async def get_team(self, team_id: UUID) -> TeamResponse:
        """Fetch a team by ID."""
        team = await self._team_repo.get_by_id(team_id)
        if team is None:
            raise NotFoundError("Team not found")
        return team

    async def list_org_teams(self, org_id: UUID, actor: AuthUser) -> list[TeamResponse]:
        """List teams in an organization (requires membership)."""
        await self._require_org_role(org_id, actor, Role.GUEST)
        return await self._team_repo.list_by_org(org_id)

    async def get_members(
        self, team_id: UUID, actor: AuthUser
    ) -> list[TeamMemberWithUser]:
        """List team members with profile fields when a provider is configured."""
        await self.require_team_role(team_id, actor, Role.GUEST)
        rows = await self._member_repo.list_by_team(team_id)
        enriched: list[TeamMemberWithUser] = []
        for row in rows:
            email = f"{row.user_id}@users.local"
            full_name: str | None = None
            if self._user_profiles is not None:
                email, full_name = await self._user_profiles.get_profile(row.user_id)
            enriched.append(
                TeamMemberWithUser(
                    id=row.id,
                    team_id=row.team_id,
                    user_id=row.user_id,
                    role=row.role,
                    joined_at=row.joined_at,
                    email=email,
                    full_name=full_name,
                )
            )
        return enriched

    async def user_belongs_to_team(self, team_id: UUID, user_id: UUID) -> bool:
        """True if user is an explicit member or the organization owner."""
        if await self._member_repo.get_membership(team_id, user_id) is not None:
            return True
        team = await self.get_team(team_id)
        org = await self._org_repo.get_by_id(team.org_id)
        return bool(org and org.owner_id == user_id)

    async def require_team_role(
        self, team_id: UUID, actor: AuthUser, min_role: Role
    ) -> Role:
        """
        Verify the actor has at least min_role in the given team.

        Returns the actor's actual role for downstream use.
        """
        team = await self.get_team(team_id)
        org = await self._org_repo.get_by_id(team.org_id)
        if org and org.owner_id == actor.id:
            return Role.OWNER

        role = await self._member_repo.get_user_role_in_team(team_id, actor.id)
        if role is None or not role_at_least(role, min_role):
            raise PermissionDeniedError("Insufficient permissions for this team")
        return role

    async def _require_org_role(
        self, org_id: UUID, actor: AuthUser, min_role: Role
    ) -> None:
        role = await self._resolve_org_role(org_id, actor)
        if not role_at_least(role, min_role):
            raise PermissionDeniedError("Insufficient permissions for this organization")

    async def _resolve_org_role(self, org_id: UUID, actor: AuthUser) -> Role:
        """Determine the actor's highest role within an organization."""
        org = await self._org_repo.get_by_id(org_id)
        if org is None:
            raise NotFoundError("Organization not found")
        if org.owner_id == actor.id:
            return Role.OWNER

        teams = await self._team_repo.list_by_org(org_id)
        highest = Role.GUEST
        for team in teams:
            role = await self._member_repo.get_user_role_in_team(team.id, actor.id)
            if role is not None and role.level > highest.level:
                highest = role
        has_membership = False
        for team in teams:
            if await self._member_repo.get_membership(team.id, actor.id):
                has_membership = True
                break

        if not has_membership:
            raise PermissionDeniedError("Not a member of this organization")
        return highest
