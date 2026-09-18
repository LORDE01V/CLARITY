"""Unit tests for team documents + revision history."""

from uuid import uuid4

import pytest

from app.db.repositories.document_repository import InMemoryDocumentRepository
from app.models.document import DocumentCreate, DocumentUpdate
from app.models.org import OrganizationCreate
from app.services.document_service import DocumentService


@pytest.mark.asyncio
async def test_create_update_and_history(org_service, team_service, owner_user):
    org = await org_service.create_organization(
        OrganizationCreate(name="Docs Co", slug=f"docs-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    service = DocumentService(
        document_repo=InMemoryDocumentRepository(),
        team_service=team_service,
    )

    created = await service.create_document(
        team.id,
        DocumentCreate(title="Lab protocol", body="Step 1"),
        owner_user,
    )
    assert created.title == "Lab protocol"
    assert created.created_by == owner_user.id

    updated = await service.update_document(
        team.id,
        created.id,
        DocumentUpdate(body="Step 1\nStep 2", summary="Added step 2"),
        owner_user,
    )
    assert "Step 2" in updated.body
    assert updated.updated_by == owner_user.id

    history = await service.list_history(team.id, created.id, owner_user)
    assert len(history) == 2
    assert history[0].summary == "Added step 2"
    assert history[1].summary == "Created"

    older = history[1]
    restored = await service.restore_revision(
        team.id, created.id, older.id, owner_user
    )
    assert restored.body == "Step 1"
    history2 = await service.list_history(team.id, created.id, owner_user)
    assert len(history2) == 3
    assert history2[0].summary.startswith("Restored")
