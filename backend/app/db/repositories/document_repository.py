"""Team document repository protocol and implementations."""

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.models.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentRevisionResponse,
    DocumentSummary,
)


def _preview(body: str, limit: int = 160) -> str:
    text = " ".join((body or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _doc_row(row: dict) -> DocumentResponse:
    return DocumentResponse(**row)


def _summary_row(row: dict) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        team_id=row["team_id"],
        title=row["title"],
        preview=_preview(row.get("body") or ""),
        created_by=row["created_by"],
        updated_by=row["updated_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _rev_row(row: dict) -> DocumentRevisionResponse:
    return DocumentRevisionResponse(**row)


class DocumentRepository(Protocol):
    async def create(
        self, team_id: UUID, user_id: UUID, payload: DocumentCreate
    ) -> DocumentResponse: ...

    async def get_by_id(self, document_id: UUID) -> DocumentResponse | None: ...

    async def list_by_team(self, team_id: UUID) -> list[DocumentSummary]: ...

    async def update(
        self,
        document_id: UUID,
        *,
        title: str,
        body: str,
        updated_by: UUID,
    ) -> DocumentResponse: ...

    async def delete(self, document_id: UUID) -> None: ...

    async def add_revision(
        self,
        *,
        document_id: UUID,
        team_id: UUID,
        title: str,
        body: str,
        edited_by: UUID,
        summary: str | None,
    ) -> DocumentRevisionResponse: ...

    async def list_revisions(
        self, document_id: UUID
    ) -> list[DocumentRevisionResponse]: ...

    async def get_revision(
        self, revision_id: UUID
    ) -> DocumentRevisionResponse | None: ...


class SupabaseDocumentRepository:
    def __init__(self, client) -> None:
        self._client = client
        self._docs = "team_documents"
        self._revs = "team_document_revisions"

    async def create(
        self, team_id: UUID, user_id: UUID, payload: DocumentCreate
    ) -> DocumentResponse:
        now = datetime.now(timezone.utc).isoformat()
        doc_id = str(uuid4())
        row = {
            "id": doc_id,
            "team_id": str(team_id),
            "title": payload.title,
            "body": payload.body,
            "created_by": str(user_id),
            "updated_by": str(user_id),
            "created_at": now,
            "updated_at": now,
        }
        result = self._client.table(self._docs).insert(row).execute()
        self._client.table(self._revs).insert(
            {
                "id": str(uuid4()),
                "document_id": doc_id,
                "team_id": str(team_id),
                "title": payload.title,
                "body": payload.body,
                "edited_by": str(user_id),
                "summary": "Created",
                "edited_at": now,
            }
        ).execute()
        return _doc_row(result.data[0])

    async def get_by_id(self, document_id: UUID) -> DocumentResponse | None:
        result = (
            self._client.table(self._docs)
            .select("*")
            .eq("id", str(document_id))
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return _doc_row(result.data)

    async def list_by_team(self, team_id: UUID) -> list[DocumentSummary]:
        result = (
            self._client.table(self._docs)
            .select("*")
            .eq("team_id", str(team_id))
            .order("updated_at", desc=True)
            .execute()
        )
        return [_summary_row(row) for row in result.data]

    async def update(
        self,
        document_id: UUID,
        *,
        title: str,
        body: str,
        updated_by: UUID,
    ) -> DocumentResponse:
        result = (
            self._client.table(self._docs)
            .update(
                {
                    "title": title,
                    "body": body,
                    "updated_by": str(updated_by),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", str(document_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Document not found")
        return _doc_row(result.data[0])

    async def delete(self, document_id: UUID) -> None:
        self._client.table(self._docs).delete().eq("id", str(document_id)).execute()

    async def add_revision(
        self,
        *,
        document_id: UUID,
        team_id: UUID,
        title: str,
        body: str,
        edited_by: UUID,
        summary: str | None,
    ) -> DocumentRevisionResponse:
        row = {
            "id": str(uuid4()),
            "document_id": str(document_id),
            "team_id": str(team_id),
            "title": title,
            "body": body,
            "edited_by": str(edited_by),
            "summary": summary,
            "edited_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self._client.table(self._revs).insert(row).execute()
        return _rev_row(result.data[0])

    async def list_revisions(
        self, document_id: UUID
    ) -> list[DocumentRevisionResponse]:
        result = (
            self._client.table(self._revs)
            .select("*")
            .eq("document_id", str(document_id))
            .order("edited_at", desc=True)
            .execute()
        )
        return [_rev_row(row) for row in result.data]

    async def get_revision(
        self, revision_id: UUID
    ) -> DocumentRevisionResponse | None:
        result = (
            self._client.table(self._revs)
            .select("*")
            .eq("id", str(revision_id))
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return _rev_row(result.data)


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._docs: dict[UUID, dict] = {}
        self._revs: dict[UUID, dict] = {}

    async def create(
        self, team_id: UUID, user_id: UUID, payload: DocumentCreate
    ) -> DocumentResponse:
        now = datetime.now(timezone.utc)
        doc_id = uuid4()
        row = {
            "id": doc_id,
            "team_id": team_id,
            "title": payload.title,
            "body": payload.body,
            "created_by": user_id,
            "updated_by": user_id,
            "created_at": now,
            "updated_at": now,
        }
        self._docs[doc_id] = row
        rev_id = uuid4()
        self._revs[rev_id] = {
            "id": rev_id,
            "document_id": doc_id,
            "team_id": team_id,
            "title": payload.title,
            "body": payload.body,
            "edited_by": user_id,
            "summary": "Created",
            "edited_at": now,
        }
        return _doc_row(row)

    async def get_by_id(self, document_id: UUID) -> DocumentResponse | None:
        row = self._docs.get(document_id)
        return _doc_row(row) if row else None

    async def list_by_team(self, team_id: UUID) -> list[DocumentSummary]:
        rows = [r for r in self._docs.values() if r["team_id"] == team_id]
        rows.sort(key=lambda r: r["updated_at"], reverse=True)
        return [_summary_row(r) for r in rows]

    async def update(
        self,
        document_id: UUID,
        *,
        title: str,
        body: str,
        updated_by: UUID,
    ) -> DocumentResponse:
        row = self._docs.get(document_id)
        if row is None:
            raise NotFoundError("Document not found")
        row["title"] = title
        row["body"] = body
        row["updated_by"] = updated_by
        row["updated_at"] = datetime.now(timezone.utc)
        return _doc_row(row)

    async def delete(self, document_id: UUID) -> None:
        self._docs.pop(document_id, None)
        self._revs = {
            rid: r
            for rid, r in self._revs.items()
            if r["document_id"] != document_id
        }

    async def add_revision(
        self,
        *,
        document_id: UUID,
        team_id: UUID,
        title: str,
        body: str,
        edited_by: UUID,
        summary: str | None,
    ) -> DocumentRevisionResponse:
        rev_id = uuid4()
        row = {
            "id": rev_id,
            "document_id": document_id,
            "team_id": team_id,
            "title": title,
            "body": body,
            "edited_by": edited_by,
            "summary": summary,
            "edited_at": datetime.now(timezone.utc),
        }
        self._revs[rev_id] = row
        return _rev_row(row)

    async def list_revisions(
        self, document_id: UUID
    ) -> list[DocumentRevisionResponse]:
        rows = [r for r in self._revs.values() if r["document_id"] == document_id]
        rows.sort(key=lambda r: r["edited_at"], reverse=True)
        return [_rev_row(r) for r in rows]

    async def get_revision(
        self, revision_id: UUID
    ) -> DocumentRevisionResponse | None:
        row = self._revs.get(revision_id)
        return _rev_row(row) if row else None
