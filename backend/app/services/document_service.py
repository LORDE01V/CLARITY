"""Team documents — shared notes with history and attribution."""

from uuid import UUID

from app.core.exceptions import NotFoundError, ValidationError
from app.db.repositories.document_repository import DocumentRepository
from app.models.auth import AuthUser
from app.models.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentRevisionResponse,
    DocumentSummary,
    DocumentUpdate,
)
from app.models.enums import Role
from app.services.team_service import TeamService


class DocumentService:
    """CRUD + revision history for team documents."""

    def __init__(
        self,
        document_repo: DocumentRepository,
        team_service: TeamService,
    ) -> None:
        self._docs = document_repo
        self._team_service = team_service

    async def create_document(
        self, team_id: UUID, payload: DocumentCreate, actor: AuthUser
    ) -> DocumentResponse:
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        return await self._docs.create(team_id, actor.id, payload)

    async def list_documents(
        self, team_id: UUID, actor: AuthUser
    ) -> list[DocumentSummary]:
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        return await self._docs.list_by_team(team_id)

    async def get_document(
        self, team_id: UUID, document_id: UUID, actor: AuthUser
    ) -> DocumentResponse:
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        return await self._get_team_doc(team_id, document_id)

    async def update_document(
        self,
        team_id: UUID,
        document_id: UUID,
        payload: DocumentUpdate,
        actor: AuthUser,
    ) -> DocumentResponse:
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        doc = await self._get_team_doc(team_id, document_id)
        data = payload.model_dump(exclude_unset=True)
        if not data or set(data.keys()) == {"summary"}:
            raise ValidationError("No fields to update")

        next_title = payload.title if "title" in data and payload.title else doc.title
        next_body = payload.body if "body" in data else doc.body
        if next_title == doc.title and next_body == doc.body:
            raise ValidationError("No changes to save")

        updated = await self._docs.update(
            document_id,
            title=next_title,
            body=next_body,
            updated_by=actor.id,
        )
        await self._docs.add_revision(
            document_id=document_id,
            team_id=team_id,
            title=next_title,
            body=next_body,
            edited_by=actor.id,
            summary=payload.summary or "Edited",
        )
        return updated

    async def delete_document(
        self, team_id: UUID, document_id: UUID, actor: AuthUser
    ) -> None:
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_doc(team_id, document_id)
        await self._docs.delete(document_id)

    async def list_history(
        self, team_id: UUID, document_id: UUID, actor: AuthUser
    ) -> list[DocumentRevisionResponse]:
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._get_team_doc(team_id, document_id)
        return await self._docs.list_revisions(document_id)

    async def get_revision(
        self,
        team_id: UUID,
        document_id: UUID,
        revision_id: UUID,
        actor: AuthUser,
    ) -> DocumentRevisionResponse:
        await self._team_service.require_team_role(team_id, actor, Role.GUEST)
        await self._get_team_doc(team_id, document_id)
        revision = await self._docs.get_revision(revision_id)
        if (
            revision is None
            or revision.document_id != document_id
            or revision.team_id != team_id
        ):
            raise NotFoundError("Revision not found")
        return revision

    async def restore_revision(
        self,
        team_id: UUID,
        document_id: UUID,
        revision_id: UUID,
        actor: AuthUser,
    ) -> DocumentResponse:
        await self._team_service.require_team_role(team_id, actor, Role.MEMBER)
        await self._get_team_doc(team_id, document_id)
        revision = await self._docs.get_revision(revision_id)
        if (
            revision is None
            or revision.document_id != document_id
            or revision.team_id != team_id
        ):
            raise NotFoundError("Revision not found")

        updated = await self._docs.update(
            document_id,
            title=revision.title,
            body=revision.body,
            updated_by=actor.id,
        )
        await self._docs.add_revision(
            document_id=document_id,
            team_id=team_id,
            title=revision.title,
            body=revision.body,
            edited_by=actor.id,
            summary=f"Restored revision from {revision.edited_at.isoformat()}",
        )
        return updated

    async def _get_team_doc(
        self, team_id: UUID, document_id: UUID
    ) -> DocumentResponse:
        doc = await self._docs.get_by_id(document_id)
        if doc is None or doc.team_id != team_id:
            raise NotFoundError("Document not found")
        return doc
