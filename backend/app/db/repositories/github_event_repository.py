"""GitHub activity event store — Protocol + in-memory implementation."""

from __future__ import annotations

from typing import Protocol

from app.models.github import GitHubActivityItem


class GitHubEventRepository(Protocol):
    """Contract for persisting ingested GitHub webhook events."""

    async def add(self, event: GitHubActivityItem) -> GitHubActivityItem: ...

    async def list_recent(
        self,
        *,
        limit: int = 50,
        installation_id: str | None = None,
    ) -> list[GitHubActivityItem]: ...

    async def clear(self) -> None: ...


class InMemoryGitHubEventRepository:
    """Process-local ring buffer of recent GitHub events (dev/tests)."""

    def __init__(self, max_events: int = 500) -> None:
        self._events: list[GitHubActivityItem] = []
        self._max_events = max_events

    async def add(self, event: GitHubActivityItem) -> GitHubActivityItem:
        self._events.insert(0, event)
        if len(self._events) > self._max_events:
            self._events = self._events[: self._max_events]
        return event

    async def list_recent(
        self,
        *,
        limit: int = 50,
        installation_id: str | None = None,
    ) -> list[GitHubActivityItem]:
        items = self._events
        if installation_id:
            items = [
                event
                for event in items
                if event.installation_id == installation_id
            ]
        return items[: max(1, min(limit, 200))]

    async def clear(self) -> None:
        self._events.clear()


# Shared store for the running API process (webhooks + activity share state).
_shared_store: InMemoryGitHubEventRepository | None = None


def get_shared_github_event_store() -> InMemoryGitHubEventRepository:
    """Return the process-wide in-memory GitHub event store."""
    global _shared_store
    if _shared_store is None:
        _shared_store = InMemoryGitHubEventRepository()
    return _shared_store
