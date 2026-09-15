"""Team invite Pydantic models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Role


class InviteCreate(BaseModel):
    """Payload for creating a team-scoped invite."""

    email: EmailStr
    role: Role = Field(
        default=Role.MEMBER,
        description="Role assigned when the invite is accepted.",
    )


class InviteResponse(BaseModel):
    """Invite record returned after creation or lookup."""

    id: UUID
    team_id: UUID
    email: EmailStr
    role: Role
    token: str
    invited_by: UUID
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime


class InviteAcceptRequest(BaseModel):
    """Optional body when accepting an invite (user may already be logged in)."""

    full_name: str | None = Field(default=None, max_length=120)


class InviteAcceptResponse(BaseModel):
    """Result of a successful invite acceptance."""

    team_id: UUID
    role: Role
    membership_id: UUID
