"""GitHub App installation store — Protocol, in-memory, and Supabase."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

from app.models.github import GitHubInstallationRecord


class GitHubInstallationRepository(Protocol):
    """Contract for persisting GitHub App installations."""

    async def upsert(self, record: GitHubInstallationRecord) -> GitHubInstallationRecord: ...

    async def get(self, installation_id: str) -> GitHubInstallationRecord | None: ...

    async def delete(self, installation_id: str) -> None: ...

    async def list_all(self) -> list[GitHubInstallationRecord]: ...

    async def find_for_team(self, team_id: UUID) -> GitHubInstallationRecord | None: ...

    async def find_for_user(self, user_id: UUID) -> GitHubInstallationRecord | None: ...

    async def clear(self) -> None: ...


class InMemoryGitHubInstallationRepository:
    """Process-local map of GitHub App installations (dev/tests)."""

    def __init__(self) -> None:
        self._by_id: dict[str, GitHubInstallationRecord] = {}

    async def upsert(self, record: GitHubInstallationRecord) -> GitHubInstallationRecord:
        self._by_id[record.installation_id] = record
        return record

    async def get(self, installation_id: str) -> GitHubInstallationRecord | None:
        return self._by_id.get(installation_id)

    async def delete(self, installation_id: str) -> None:
        self._by_id.pop(installation_id, None)

    async def list_all(self) -> list[GitHubInstallationRecord]:
        return sorted(
            self._by_id.values(),
            key=lambda item: item.updated_at,
            reverse=True,
        )

    async def find_for_team(self, team_id: UUID) -> GitHubInstallationRecord | None:
        matches = [
            item
            for item in self._by_id.values()
            if item.team_id == team_id and not item.suspended
        ]
        if not matches:
            return None
        return sorted(matches, key=lambda item: item.updated_at, reverse=True)[0]

    async def find_for_user(self, user_id: UUID) -> GitHubInstallationRecord | None:
        matches = [
            item
            for item in self._by_id.values()
            if item.user_id == user_id and not item.suspended
        ]
        if not matches:
            return None
        return sorted(matches, key=lambda item: item.updated_at, reverse=True)[0]

    async def clear(self) -> None:
        self._by_id.clear()


class SupabaseGitHubInstallationRepository:
    """Supabase-backed installation store (survives Render restarts)."""

    def __init__(self, client) -> None:
        self._client = client
        self._table = "github_installations"
        self._states = "github_connect_states"

    def _to_row(self, record: GitHubInstallationRecord) -> dict:
        return {
            "installation_id": record.installation_id,
            "account_login": record.account_login,
            "account_type": record.account_type,
            "repository_selection": record.repository_selection,
            "repositories": list(record.repositories),
            "suspended": record.suspended,
            "team_id": str(record.team_id) if record.team_id else None,
            "user_id": str(record.user_id) if record.user_id else None,
            "connected_at": record.connected_at.isoformat(),
            "updated_at": record.updated_at.isoformat(),
        }

    def _from_row(self, row: dict) -> GitHubInstallationRecord:
        return GitHubInstallationRecord(
            installation_id=str(row["installation_id"]),
            account_login=row.get("account_login"),
            account_type=row.get("account_type"),
            repository_selection=row.get("repository_selection"),
            repositories=list(row.get("repositories") or []),
            suspended=bool(row.get("suspended")),
            team_id=UUID(row["team_id"]) if row.get("team_id") else None,
            user_id=UUID(row["user_id"]) if row.get("user_id") else None,
            connected_at=row["connected_at"],
            updated_at=row["updated_at"],
        )

    async def upsert(self, record: GitHubInstallationRecord) -> GitHubInstallationRecord:
        self._client.table(self._table).upsert(self._to_row(record)).execute()
        return record

    async def get(self, installation_id: str) -> GitHubInstallationRecord | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("installation_id", installation_id)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return self._from_row(result.data)

    async def delete(self, installation_id: str) -> None:
        self._client.table(self._table).delete().eq(
            "installation_id", installation_id
        ).execute()

    async def list_all(self) -> list[GitHubInstallationRecord]:
        result = (
            self._client.table(self._table)
            .select("*")
            .order("updated_at", desc=True)
            .execute()
        )
        return [self._from_row(row) for row in (result.data or [])]

    async def find_for_team(self, team_id: UUID) -> GitHubInstallationRecord | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("team_id", str(team_id))
            .eq("suspended", False)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return self._from_row(rows[0]) if rows else None

    async def find_for_user(self, user_id: UUID) -> GitHubInstallationRecord | None:
        result = (
            self._client.table(self._table)
            .select("*")
            .eq("user_id", str(user_id))
            .eq("suspended", False)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return self._from_row(rows[0]) if rows else None

    async def clear(self) -> None:
        self._client.table(self._table).delete().neq("installation_id", "").execute()

    async def put_connect_state(
        self,
        state: str,
        *,
        user_id: str | None = None,
        team_id: str | None = None,
    ) -> None:
        self._client.table(self._states).upsert(
            {
                "state": state,
                "user_id": user_id,
                "team_id": team_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    async def pop_connect_state(self, state: str) -> dict[str, str | None] | None:
        result = (
            self._client.table(self._states)
            .select("*")
            .eq("state", state)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        row = result.data
        self._client.table(self._states).delete().eq("state", state).execute()
        # Drop stale states older than 2 hours.
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        try:
            self._client.table(self._states).delete().lt("created_at", cutoff).execute()
        except Exception:
            pass
        return {"user_id": row.get("user_id"), "team_id": row.get("team_id")}


_shared_installations: InMemoryGitHubInstallationRepository | None = None
_pending_states: dict[str, dict[str, str | None]] = {}


def get_shared_github_installation_store() -> InMemoryGitHubInstallationRepository:
    """Return the process-wide in-memory installation store."""
    global _shared_installations
    if _shared_installations is None:
        _shared_installations = InMemoryGitHubInstallationRepository()
    return _shared_installations


def put_pending_connect_state(
    state: str,
    *,
    user_id: str | None = None,
    team_id: str | None = None,
) -> None:
    """Remember Connect state so the setup callback can link team/user."""
    _pending_states[state] = {"user_id": user_id, "team_id": team_id}


def pop_pending_connect_state(state: str) -> dict[str, str | None] | None:
    """Consume a pending Connect state (one-time)."""
    return _pending_states.pop(state, None)


def clear_pending_connect_states() -> None:
    """Clear pending Connect states (tests)."""
    _pending_states.clear()
