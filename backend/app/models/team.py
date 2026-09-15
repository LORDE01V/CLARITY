"""Team and membership Pydantic models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import Role
from app.models.org import OrganizationSummary


class TeamCreate(BaseModel):
    """Payload for creating a team within an organization."""

    name: str = Field(min_length=1, max_length=120)


class TeamResponse(BaseModel):
    """Team returned to clients."""

    id: UUID
    org_id: UUID
    name: str
    created_at: datetime


class TeamDetailResponse(TeamResponse):
    """Team with nested organization context."""

    organization: OrganizationSummary


class TeamMemberResponse(BaseModel):
    """A user's membership record within a team."""

    id: UUID
    team_id: UUID
    user_id: UUID
    role: Role
    joined_at: datetime


class TeamMemberWithUser(TeamMemberResponse):
    """Membership enriched with user profile fields."""

    email: str
    full_name: str | None = None
