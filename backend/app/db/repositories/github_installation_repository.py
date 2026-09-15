"""GitHub App installation store — Protocol + in-memory implementation."""

from __future__ import annotations

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
