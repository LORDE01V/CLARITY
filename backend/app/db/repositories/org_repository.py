"""
Organization repository protocol and Supabase implementation.

Repositories isolate SQL/Supabase details from business logic so services
remain testable with in-memory fakes.
"""

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import ConflictError, NotFoundError
from app.models.org import OrganizationCreate, OrganizationResponse


class OrganizationRepository(Protocol):
    """Contract for organization persistence."""

    async def create(
        self, payload: OrganizationCreate, owner_id: UUID
    ) -> OrganizationResponse: ...

    async def get_by_id(self, org_id: UUID) -> OrganizationResponse | None: ...

    async def get_by_slug(self, slug: str) -> OrganizationResponse | None: ...


class SupabaseOrganizationRepository:
    """Supabase-backed organization repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "organizations"

    async def create(
        self, payload: OrganizationCreate, owner_id: UUID
    ) -> OrganizationResponse:
        existing = await self.get_by_slug(payload.slug)
        if existing:
            raise ConflictError(f"Organization slug '{payload.slug}' already exists")

        row = {
            "id": str(uuid4()),
            "name": payload.name,
            "slug": payload.slug,
            "owner_id": str(owner_id),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self._client.table(self._table).insert(row).execute()
        return OrganizationResponse(**result.data[0])

    async def get_by_id(self, org_id: UUID) -> OrganizationResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("id", str(org_id))
            .maybe_single()
            .execute()
        )
        # postgrest-py may return None (not an empty response) when no row matches
        if result is None or not result.data:
            return None
        return OrganizationResponse(**result.data)

    async def get_by_slug(self, slug: str) -> OrganizationResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("slug", slug)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return OrganizationResponse(**result.data)


class InMemoryOrganizationRepository:
    """In-memory organization store for unit tests."""

    def __init__(self) -> None:
        self._orgs: dict[UUID, OrganizationResponse] = {}
        self._slugs: dict[str, UUID] = {}

    async def create(
        self, payload: OrganizationCreate, owner_id: UUID
    ) -> OrganizationResponse:
        if payload.slug in self._slugs:
            raise ConflictError(f"Organization slug '{payload.slug}' already exists")

        org = OrganizationResponse(
            id=uuid4(),
            name=payload.name,
            slug=payload.slug,
            owner_id=owner_id,
            created_at=datetime.now(timezone.utc),
        )
        self._orgs[org.id] = org
        self._slugs[org.slug] = org.id
        return org

    async def get_by_id(self, org_id: UUID) -> OrganizationResponse | None:
        return self._orgs.get(org_id)

    async def get_by_slug(self, slug: str) -> OrganizationResponse | None:
        org_id = self._slugs.get(slug)
        if org_id is None:
            return None
        return self._orgs.get(org_id)
