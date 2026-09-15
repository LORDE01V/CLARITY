"""Organization Pydantic models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    """Payload for creating a new organization."""

    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9-]+$")


class OrganizationResponse(BaseModel):
    """Organization returned to clients."""

    id: UUID
    name: str
    slug: str
    owner_id: UUID
    created_at: datetime


class OrganizationSummary(BaseModel):
    """Lightweight org reference for nested responses."""

    id: UUID
    name: str
    slug: str
