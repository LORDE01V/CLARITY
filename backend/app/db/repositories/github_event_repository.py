"""GitHub activity event store — Protocol, in-memory, and Supabase."""

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
            filtered = [
                event
                for event in items
                if event.installation_id == installation_id
            ]
            # Avoid empty feed when env installation id does not match stored events.
            items = filtered if filtered else items
        return items[: max(1, min(limit, 200))]

    async def clear(self) -> None:
        self._events.clear()


class SupabaseGitHubEventRepository:
    """Supabase-backed GitHub event store (survives Render restarts)."""

    def __init__(self, client, *, max_events: int = 500) -> None:
        self._client = client
        self._table = "github_events"
        self._max_events = max_events

    async def add(self, event: GitHubActivityItem) -> GitHubActivityItem:
        row = {
            "id": event.id,
            "event_type": event.event_type,
            "action": event.action,
            "title": event.title,
            "body_preview": event.body_preview,
            "repo_full_name": event.repo_full_name,
            "actor_login": event.actor_login,
            "html_url": event.html_url,
            "task_keys": list(event.task_keys),
            "installation_id": event.installation_id,
            "delivery_id": event.delivery_id,
            "received_at": event.received_at.isoformat(),
        }
        self._client.table(self._table).upsert(row).execute()
        try:
            older = (
                self._client.table(self._table)
                .select("id")
                .order("received_at", desc=True)
                .range(self._max_events, self._max_events + 50)
                .execute()
            )
            ids = [item["id"] for item in (older.data or [])]
            if ids:
                self._client.table(self._table).delete().in_("id", ids).execute()
        except Exception:
            pass
        return event

    async def list_recent(
        self,
        *,
        limit: int = 50,
        installation_id: str | None = None,
    ) -> list[GitHubActivityItem]:
        capped = max(1, min(limit, 200))
        query = (
            self._client.table(self._table)
            .select("*")
            .order("received_at", desc=True)
            .limit(capped)
        )
        if installation_id:
            query = query.eq("installation_id", installation_id)
        result = query.execute()
        rows = result.data or []
        if installation_id and not rows:
            result = (
                self._client.table(self._table)
                .select("*")
                .order("received_at", desc=True)
                .limit(capped)
                .execute()
            )
            rows = result.data or []
        return [GitHubActivityItem(**row) for row in rows]

    async def clear(self) -> None:
        self._client.table(self._table).delete().neq("id", "").execute()


_shared_store: InMemoryGitHubEventRepository | None = None


def get_shared_github_event_store() -> InMemoryGitHubEventRepository:
    """Return the process-wide in-memory GitHub event store."""
    global _shared_store
    if _shared_store is None:
        _shared_store = InMemoryGitHubEventRepository()
    return _shared_store
