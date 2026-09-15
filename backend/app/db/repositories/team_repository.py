"""Team and membership repository protocol and implementations."""

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import Role
from app.models.team import TeamCreate, TeamMemberResponse, TeamResponse


class TeamRepository(Protocol):
    """Contract for team persistence."""

    async def create(self, org_id: UUID, payload: TeamCreate) -> TeamResponse: ...

    async def get_by_id(self, team_id: UUID) -> TeamResponse | None: ...

    async def list_by_org(self, org_id: UUID) -> list[TeamResponse]: ...


class MemberRepository(Protocol):
    """Contract for team membership persistence."""

    async def add_member(
        self, team_id: UUID, user_id: UUID, role: Role
    ) -> TeamMemberResponse: ...

    async def get_membership(
        self, team_id: UUID, user_id: UUID
    ) -> TeamMemberResponse | None: ...

    async def get_user_role_in_team(self, team_id: UUID, user_id: UUID) -> Role | None: ...


class SupabaseTeamRepository:
    """Supabase-backed team repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "teams"

    async def create(self, org_id: UUID, payload: TeamCreate) -> TeamResponse:
        row = {
            "id": str(uuid4()),
            "org_id": str(org_id),
            "name": payload.name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self._client.table(self._table).insert(row).execute()
        return TeamResponse(**result.data[0])

    async def get_by_id(self, team_id: UUID) -> TeamResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(team_id))
            .maybe_single()
            .execute()
        )
        # postgrest-py may return None (not an empty response) when no row matches
        if result is None or not result.data:
            return None
        return TeamResponse(**result.data)

    async def list_by_org(self, org_id: UUID) -> list[TeamResponse]:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("org_id", str(org_id))
            .execute()
        )
        return [TeamResponse(**row) for row in result.data]


class SupabaseMemberRepository:
    """Supabase-backed team membership repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "team_members"

    async def add_member(
        self, team_id: UUID, user_id: UUID, role: Role
    ) -> TeamMemberResponse:
        existing = await self.get_membership(team_id, user_id)
        if existing:
            raise ConflictError("User is already a member of this team")

        row = {
            "id": str(uuid4()),
            "team_id": str(team_id),
            "user_id": str(user_id),
            "role": role.value,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self._client.table(self._table).insert(row).execute()
        return TeamMemberResponse(**result.data[0])

    async def get_membership(
        self, team_id: UUID, user_id: UUID
    ) -> TeamMemberResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        # postgrest-py may return None (not an empty response) when no row matches
        if result is None or not result.data:
            return None
        return TeamMemberResponse(**result.data)

    async def get_user_role_in_team(self, team_id: UUID, user_id: UUID) -> Role | None:
        membership = await self.get_membership(team_id, user_id)
        if membership is None:
            return None
        return membership.role


class InMemoryTeamRepository:
    """In-memory team store for unit tests."""

    def __init__(self) -> None:
        self._teams: dict[UUID, TeamResponse] = {}

    async def create(self, org_id: UUID, payload: TeamCreate) -> TeamResponse:
        team = TeamResponse(
            id=uuid4(),
            org_id=org_id,
            name=payload.name,
            created_at=datetime.now(timezone.utc),
        )
        self._teams[team.id] = team
        return team

    async def get_by_id(self, team_id: UUID) -> TeamResponse | None:
        return self._teams.get(team_id)

    async def list_by_org(self, org_id: UUID) -> list[TeamResponse]:
        return [t for t in self._teams.values() if t.org_id == org_id]


class InMemoryMemberRepository:
    """In-memory membership store for unit tests."""

    def __init__(self) -> None:
        self._members: dict[tuple[UUID, UUID], TeamMemberResponse] = {}

    async def add_member(
        self, team_id: UUID, user_id: UUID, role: Role
    ) -> TeamMemberResponse:
        key = (team_id, user_id)
        if key in self._members:
            raise ConflictError("User is already a member of this team")

        member = TeamMemberResponse(
            id=uuid4(),
            team_id=team_id,
            user_id=user_id,
            role=role,
            joined_at=datetime.now(timezone.utc),
        )
        self._members[key] = member
        return member

    async def get_membership(
        self, team_id: UUID, user_id: UUID
    ) -> TeamMemberResponse | None:
        return self._members.get((team_id, user_id))

    async def get_user_role_in_team(self, team_id: UUID, user_id: UUID) -> Role | None:
        membership = await self.get_membership(team_id, user_id)
        if membership is None:
            return None
        return membership.role
