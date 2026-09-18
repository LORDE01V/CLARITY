"""Team document models — shared docs with revision history."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DocumentCreate(BaseModel):
    """Create a team document."""

    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=200_000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DocumentUpdate(BaseModel):
    """Partial update — each save that changes content creates a revision."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=200_000)
    summary: str | None = Field(default=None, max_length=500)

    @field_validator("title", "summary", mode="before")
    @classmethod
    def empty_as_none_or_strip(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DocumentSummary(BaseModel):
    """List row without full body."""

    id: UUID
    team_id: UUID
    title: str
    preview: str
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime


class DocumentResponse(BaseModel):
    """Full document returned to clients."""

    id: UUID
    team_id: UUID
    title: str
    body: str
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime


class DocumentRevisionResponse(BaseModel):
    """A historical snapshot of a document."""

    id: UUID
    document_id: UUID
    team_id: UUID
    title: str
    body: str
    edited_by: UUID
    summary: str | None = None
    edited_at: datetime
