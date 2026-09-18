"""Team documents with revision history."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_document_service
from app.dependencies.rbac import require_team_role
from app.models.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentRevisionResponse,
    DocumentSummary,
    DocumentUpdate,
)
from app.models.enums import Role
from app.services.document_service import DocumentService

router = APIRouter(prefix="/teams/{team_id}/docs", tags=["docs"])


@router.get("", response_model=list[DocumentSummary])
async def list_documents(
    team_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    document_service: DocumentService = Depends(get_document_service),
) -> list[DocumentSummary]:
    return await document_service.list_documents(team_id, user)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    team_id: UUID,
    payload: DocumentCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    return await document_service.create_document(team_id, payload, user)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    team_id: UUID,
    document_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    return await document_service.get_document(team_id, document_id, user)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    team_id: UUID,
    document_id: UUID,
    payload: DocumentUpdate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    return await document_service.update_document(
        team_id, document_id, payload, user
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    team_id: UUID,
    document_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    document_service: DocumentService = Depends(get_document_service),
) -> None:
    await document_service.delete_document(team_id, document_id, user)


@router.get(
    "/{document_id}/history",
    response_model=list[DocumentRevisionResponse],
)
async def list_document_history(
    team_id: UUID,
    document_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    document_service: DocumentService = Depends(get_document_service),
) -> list[DocumentRevisionResponse]:
    return await document_service.list_history(team_id, document_id, user)


@router.get(
    "/{document_id}/history/{revision_id}",
    response_model=DocumentRevisionResponse,
)
async def get_document_revision(
    team_id: UUID,
    document_id: UUID,
    revision_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentRevisionResponse:
    return await document_service.get_revision(
        team_id, document_id, revision_id, user
    )


@router.post(
    "/{document_id}/restore/{revision_id}",
    response_model=DocumentResponse,
)
async def restore_document_revision(
    team_id: UUID,
    document_id: UUID,
    revision_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    return await document_service.restore_revision(
        team_id, document_id, revision_id, user
    )
