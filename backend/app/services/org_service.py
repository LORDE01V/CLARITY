"""Organization business logic."""

from uuid import UUID

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.repositories.org_repository import OrganizationRepository
from app.db.repositories.team_repository import MemberRepository
from app.models.auth import AuthUser
from app.models.enums import Role
from app.models.org import OrganizationCreate, OrganizationResponse
from app.models.team import TeamCreate, TeamResponse


class OrganizationService:
    """Manages organization lifecycle and ownership rules."""

    def __init__(
        self,
        org_repo: OrganizationRepository,
        team_repo,
        member_repo: MemberRepository,
    ) -> None:
        self._org_repo = org_repo
        self._team_repo = team_repo
        self._member_repo = member_repo

    async def create_organization(
        self, payload: OrganizationCreate, owner: AuthUser
    ) -> OrganizationResponse:
        """
        Create an organization and assign the creator as owner.

        Also creates a default 'General' team with the owner as a member.
        """
        org = await self._org_repo.create(payload, owner_id=owner.id)

        default_team = await self._team_repo.create(
            org.id, TeamCreate(name="General")
        )
        await self._member_repo.add_member(
            default_team.id, owner.id, Role.OWNER
        )
        return org

    async def get_organization(self, org_id: UUID) -> OrganizationResponse:
        """Fetch an organization by ID."""
        org = await self._org_repo.get_by_id(org_id)
        if org is None:
            raise NotFoundError("Organization not found")
        return org

    async def require_org_access(
        self, org_id: UUID, user: AuthUser, min_role: Role = Role.MEMBER
    ) -> None:
        """
        Verify the user has at least min_role in any team within the org.

        Org owners are identified via the organizations.owner_id field.
        """
        org = await self.get_organization(org_id)
        if org.owner_id == user.id:
            return

        teams = await self._team_repo.list_by_org(org_id)
        for team in teams:
            role = await self._member_repo.get_user_role_in_team(team.id, user.id)
            if role is not None and role.level >= min_role.level:
                return

        raise PermissionDeniedError("Insufficient permissions for this organization")
