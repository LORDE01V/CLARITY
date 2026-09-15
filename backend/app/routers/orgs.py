"""Organization routes."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_org_service
from app.models.org import OrganizationCreate, OrganizationResponse
from app.services.org_service import OrganizationService

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    user: CurrentUser,
    org_service: OrganizationService = Depends(get_org_service),
) -> OrganizationResponse:
    """Create a new organization. The creator becomes the owner."""
    return await org_service.create_organization(payload, user)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    user: CurrentUser,
    org_service: OrganizationService = Depends(get_org_service),
) -> OrganizationResponse:
    """Get organization details (requires membership)."""
    await org_service.require_org_access(org_id, user)
    return await org_service.get_organization(org_id)
