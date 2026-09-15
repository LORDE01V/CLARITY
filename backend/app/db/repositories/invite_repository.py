"""Team invite repository protocol and implementations."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID, uuid4

from app.core.config import Settings, get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.enums import Role
from app.models.invite import InviteCreate, InviteResponse


class InviteRepository(Protocol):
    """Contract for team invite persistence."""

    async def create(
        self,
        team_id: UUID,
        payload: InviteCreate,
        invited_by: UUID,
        expires_at: datetime,
    ) -> InviteResponse: ...

    async def get_by_token(self, token: str) -> InviteResponse | None: ...

    async def get_pending_by_email_and_team(
        self, team_id: UUID, email: str
    ) -> InviteResponse | None: ...

    async def mark_accepted(self, invite_id: UUID) -> InviteResponse: ...


def _generate_invite_token() -> str:
    """Generate a cryptographically secure invite token."""
    return secrets.token_urlsafe(32)


class SupabaseInviteRepository:
    """Supabase-backed invite repository."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "team_invites"

    async def create(
        self,
        team_id: UUID,
        payload: InviteCreate,
        invited_by: UUID,
        expires_at: datetime,
    ) -> InviteResponse:
        pending = await self.get_pending_by_email_and_team(team_id, payload.email)
        if pending:
            raise ConflictError("A pending invite already exists for this email and team")

        row = {
            "id": str(uuid4()),
            "team_id": str(team_id),
            "email": payload.email.lower(),
            "role": payload.role.value,
            "token": _generate_invite_token(),
            "invited_by": str(invited_by),
            "expires_at": expires_at.isoformat(),
            "accepted_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self._client.table(self._table).insert(row).execute()
        return InviteResponse(**result.data[0])

    async def get_by_token(self, token: str) -> InviteResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("token", token)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return InviteResponse(**result.data)

    async def get_pending_by_email_and_team(
        self, team_id: UUID, email: str
    ) -> InviteResponse | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("email", email.lower())
            .is_("accepted_at", "null")
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return InviteResponse(**result.data)

    async def mark_accepted(self, invite_id: UUID) -> InviteResponse:
        now = datetime.now(timezone.utc).isoformat()
        result = (
            self._client.table(self._table)
            .update({"accepted_at": now})
            .eq("id", str(invite_id))
            .execute()
        )
        if not result.data:
            raise NotFoundError("Invite not found")
        return InviteResponse(**result.data[0])


class InMemoryInviteRepository:
    """In-memory invite store for unit tests."""

    def __init__(self) -> None:
        self._invites: dict[UUID, InviteResponse] = {}
        self._by_token: dict[str, UUID] = {}

    async def create(
        self,
        team_id: UUID,
        payload: InviteCreate,
        invited_by: UUID,
        expires_at: datetime,
    ) -> InviteResponse:
        pending = await self.get_pending_by_email_and_team(team_id, payload.email)
        if pending:
            raise ConflictError("A pending invite already exists for this email and team")

        token = _generate_invite_token()
        invite = InviteResponse(
            id=uuid4(),
            team_id=team_id,
            email=payload.email.lower(),
            role=payload.role,
            token=token,
            invited_by=invited_by,
            expires_at=expires_at,
            accepted_at=None,
            created_at=datetime.now(timezone.utc),
        )
        self._invites[invite.id] = invite
        self._by_token[token] = invite.id
        return invite

    async def get_by_token(self, token: str) -> InviteResponse | None:
        invite_id = self._by_token.get(token)
        if invite_id is None:
            return None
        return self._invites.get(invite_id)

    async def get_pending_by_email_and_team(
        self, team_id: UUID, email: str
    ) -> InviteResponse | None:
        for invite in self._invites.values():
            if (
                invite.team_id == team_id
                and invite.email == email.lower()
                and invite.accepted_at is None
            ):
                return invite
        return None

    async def mark_accepted(self, invite_id: UUID) -> InviteResponse:
        invite = self._invites.get(invite_id)
        if invite is None:
            raise NotFoundError("Invite not found")

        updated = invite.model_copy(
            update={"accepted_at": datetime.now(timezone.utc)}
        )
        self._invites[invite_id] = updated
        return updated


def compute_invite_expiry(settings: Settings | None = None) -> datetime:
    """Calculate invite expiration timestamp from settings."""
    cfg = settings or get_settings()
    return datetime.now(timezone.utc) + timedelta(hours=cfg.invite_token_expire_hours)
