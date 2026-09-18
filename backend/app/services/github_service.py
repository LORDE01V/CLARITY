"""GitHub webhook signature verification, connect flow, and event ingestion."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from uuid import UUID, uuid4

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, ValidationError
from app.db.repositories.github_event_repository import GitHubEventRepository
from app.db.repositories.github_installation_repository import (
    GitHubInstallationRepository,
    pop_pending_connect_state,
    put_pending_connect_state,
)
from app.db.repositories.task_repository import TaskRepository
from app.models.enums import TaskStatus
from app.models.github import (
    GitHubActivityItem,
    GitHubCallbackResponse,
    GitHubConnectResponse,
    GitHubInstallationRecord,
    GitHubStatusResponse,
)
from app.services.github_auth import private_key_is_loadable
from app.services.github_client import GitHubAppClient
from app.services.github_task_keys import display_task_key, parse_task_keys

logger = logging.getLogger(__name__)

_HANDLED_EVENTS = frozenset(
    {
        "ping",
        "push",
        "issues",
        "issue_comment",
        "pull_request",
        "installation",
        "installation_repositories",
    }
)


class GitHubService:
    """Ingest webhooks, manage installations, list activity, and probe status."""

    def __init__(
        self,
        settings: Settings,
        event_repo: GitHubEventRepository,
        *,
        installation_repo: GitHubInstallationRepository | None = None,
        task_repo: TaskRepository | None = None,
        github_client: GitHubAppClient | None = None,
    ) -> None:
        self._settings = settings
        self._event_repo = event_repo
        self._installation_repo = installation_repo
        self._task_repo = task_repo
        self._github_client = github_client

    def verify_signature(self, body: bytes, signature_header: str | None) -> None:
        """Validate X-Hub-Signature-256 using the webhook secret."""
        secret = self._settings.github_webhook_secret.strip()
        if not secret:
            raise ValidationError("GITHUB_WEBHOOK_SECRET is not configured")
        if not signature_header:
            raise AuthenticationError("Missing X-Hub-Signature-256 header")

        digest = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        expected = f"sha256={digest}"
        if not hmac.compare_digest(expected, signature_header.strip()):
            raise AuthenticationError("Invalid GitHub webhook signature")

    def build_connect_url(
        self,
        *,
        user_id: UUID | None = None,
        team_id: UUID | None = None,
        requires_session: bool = False,
    ) -> GitHubConnectResponse:
        """
        Build the GitHub App installation URL.

        Prefer GITHUB_APP_SLUG → https://github.com/apps/{slug}/installations/new.
        Falls back to client_id-based authorize URL when slug is unset.
        """
        slug = self._settings.github_app_slug.strip()
        client_id = self._settings.github_client_id.strip()
        state = secrets.token_urlsafe(24)

        put_pending_connect_state(
            state,
            user_id=str(user_id) if user_id else None,
            team_id=str(team_id) if team_id else None,
        )

        if slug:
            query = urlencode({"state": state})
            url = f"https://github.com/apps/{slug}/installations/new?{query}"
            return GitHubConnectResponse(
                url=url,
                state=state,
                app_slug=slug,
                requires_session=requires_session,
                detail=None
                if not requires_session
                else "Install still works; linking team/user needs a real session.",
            )

        if client_id:
            # Legacy-ish fallback; prefer setting GITHUB_APP_SLUG.
            query = urlencode({"client_id": client_id, "state": state})
            url = f"https://github.com/login/oauth/authorize?{query}"
            return GitHubConnectResponse(
                url=url,
                state=state,
                app_slug=None,
                requires_session=requires_session,
                detail=(
                    "GITHUB_APP_SLUG unset; using OAuth authorize URL. "
                    "Set GITHUB_APP_SLUG for the Install App flow."
                ),
            )

        raise ValidationError(
            "GitHub App slug or client id required; set GITHUB_APP_SLUG "
            "(preferred) or GITHUB_CLIENT_ID"
        )

    async def handle_setup_callback(
        self,
        *,
        installation_id: str | None,
        setup_action: str | None = None,
        state: str | None = None,
    ) -> GitHubCallbackResponse:
        """
        Link an installation after GitHub redirects to the App setup URL.

        Configure the App Setup URL to:
        {API}/api/v1/github/callback
        """
        install_id = (installation_id or "").strip()
        if not install_id:
            return GitHubCallbackResponse(
                ok=False,
                detail="Missing installation_id on callback",
            )

        pending = pop_pending_connect_state(state.strip()) if state else None
        user_id = None
        team_id = None
        if pending:
            if pending.get("user_id"):
                try:
                    user_id = UUID(pending["user_id"])
                except (TypeError, ValueError):
                    user_id = None
            if pending.get("team_id"):
                try:
                    team_id = UUID(pending["team_id"])
                except (TypeError, ValueError):
                    team_id = None

        now = datetime.now(timezone.utc)
        existing = (
            await self._installation_repo.get(install_id)
            if self._installation_repo
            else None
        )

        record = GitHubInstallationRecord(
            installation_id=install_id,
            account_login=existing.account_login if existing else None,
            account_type=existing.account_type if existing else None,
            repository_selection=existing.repository_selection if existing else None,
            repositories=list(existing.repositories) if existing else [],
            suspended=False,
            team_id=team_id or (existing.team_id if existing else None),
            user_id=user_id or (existing.user_id if existing else None),
            connected_at=existing.connected_at if existing else now,
            updated_at=now,
        )
        if self._installation_repo:
            await self._installation_repo.upsert(record)

        linked = bool(record.team_id or record.user_id)
        action = (setup_action or "install").strip() or "install"
        return GitHubCallbackResponse(
            ok=True,
            installation_id=install_id,
            linked=linked,
            account_login=record.account_login,
            detail=f"Setup action '{action}' recorded"
            + (" and linked" if linked else " (unlinked until state matches)"),
        )

    async def handle_webhook(
        self,
        *,
        event_name: str,
        payload: dict[str, Any],
        delivery_id: str | None = None,
        raw_body: bytes | None = None,
        signature: str | None = None,
        verify: bool = True,
    ) -> dict[str, Any]:
        """
        Verify (optional), normalize, store, and optionally complete linked tasks.

        Returns a small acknowledgement dict suitable for HTTP 200 responses.
        """
        if verify:
            if raw_body is None:
                raise ValidationError("Raw webhook body required for signature verify")
            self.verify_signature(raw_body, signature)

        event_type = (event_name or "").strip().lower()
        if event_type not in _HANDLED_EVENTS:
            return {"ok": True, "ignored": True, "event": event_type or None}

        if event_type in {"installation", "installation_repositories"}:
            install_result = await self._ingest_installation_event(event_type, payload)
            item = self._normalize_event(event_type, payload, delivery_id)
            await self._event_repo.add(item)
            return {
                "ok": True,
                "event": event_type,
                "id": item.id,
                "installation": install_result,
            }

        item = self._normalize_event(event_type, payload, delivery_id)
        await self._event_repo.add(item)

        completed = 0
        if (
            event_type == "pull_request"
            and (item.action or "") in {"closed", "merged"}
            and item.task_keys
        ):
            merged = bool((payload.get("pull_request") or {}).get("merged"))
            if item.action == "merged" or merged:
                completed = await self._best_effort_complete_tasks(item.task_keys)

        return {
            "ok": True,
            "event": event_type,
            "id": item.id,
            "task_keys": item.task_keys,
            "tasks_completed": completed,
        }

    async def resolve_installation(
        self,
        *,
        team_id: UUID | None = None,
        user_id: UUID | None = None,
        installation_id: str | None = None,
    ) -> tuple[GitHubInstallationRecord | None, str | None, str]:
        """
        Prefer a linked in-memory installation, then explicit id, then env fallback.

        Returns (record_or_none, installation_id_or_none, source).
        """
        if installation_id and installation_id.strip():
            iid = installation_id.strip()
            if self._installation_repo:
                record = await self._installation_repo.get(iid)
                if record and not record.suspended:
                    return record, record.installation_id, "store"
            return None, iid, "explicit"

        if self._installation_repo:
            if team_id:
                record = await self._installation_repo.find_for_team(team_id)
                if record:
                    return record, record.installation_id, "linked_team"
            if user_id:
                record = await self._installation_repo.find_for_user(user_id)
                if record:
                    return record, record.installation_id, "linked_user"
            # Any recent non-suspended installation (multi-user local solo).
            for record in await self._installation_repo.list_all():
                if not record.suspended:
                    return record, record.installation_id, "store"

        env_id = self._settings.github_installation_id.strip() or None
        if env_id:
            return None, env_id, "env"
        return None, None, "none"

    async def list_activity(
        self,
        *,
        limit: int = 50,
        installation_id: str | None = None,
        team_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> list[GitHubActivityItem]:
        """Return recent ingested events (installation-scoped when possible)."""
        if installation_id:
            scoped = installation_id.strip() or None
        else:
            _, scoped, _ = await self.resolve_installation(
                team_id=team_id,
                user_id=user_id,
            )
        return await self._event_repo.list_recent(
            limit=limit,
            installation_id=scoped,
        )

    async def get_status(
        self,
        *,
        probe_installation: bool = True,
        team_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> GitHubStatusResponse:
        """Report configuration completeness and optional installation reachability."""
        app_id_set = bool(self._settings.github_app_id.strip())
        webhook_set = bool(self._settings.github_webhook_secret.strip())
        key_ok = private_key_is_loadable(self._settings)
        configured = self._settings.github_app_configured and key_ok

        record, install_id, source = await self.resolve_installation(
            team_id=team_id,
            user_id=user_id,
        )
        install_set = bool(install_id)
        connected = bool(record and not record.suspended) or (
            source == "env" and install_set
        )

        reachable: bool | None = None
        detail: str | None = None

        if not configured:
            detail = "GitHub App env vars incomplete or private key not loadable"
        elif probe_installation and install_set:
            try:
                client = self._github_client or GitHubAppClient(self._settings)
                if self._github_client is None:
                    async with client as owned:
                        await owned.get_installation(install_id)
                else:
                    await client.get_installation(install_id)
                reachable = True
            except Exception as exc:  # noqa: BLE001 — status probes must not raise
                reachable = False
                detail = str(exc)
        elif not install_set:
            detail = (
                "No installation linked yet. Use Connect GitHub, or set "
                "GITHUB_INSTALLATION_ID for solo local testing."
            )

        return GitHubStatusResponse(
            configured=configured,
            app_id_set=app_id_set,
            webhook_secret_set=webhook_set,
            private_key_loaded=key_ok,
            installation_id_set=install_set,
            installation_reachable=reachable,
            connected=connected,
            installation_id=install_id,
            account_login=record.account_login if record else None,
            account_type=record.account_type if record else None,
            repositories=list(record.repositories) if record else [],
            repository_selection=record.repository_selection if record else None,
            team_id=record.team_id if record else None,
            user_id=record.user_id if record else None,
            source=source if install_set else None,
            detail=detail,
        )

    async def _ingest_installation_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Upsert or delete installation records from webhook payloads."""
        if not self._installation_repo:
            return {"stored": False, "reason": "no_installation_repo"}

        installation = payload.get("installation") or {}
        if not isinstance(installation, dict) or installation.get("id") is None:
            return {"stored": False, "reason": "missing_installation"}

        install_id = str(installation["id"])
        action = payload.get("action")
        if isinstance(action, str):
            action = action.strip().lower()
        else:
            action = None

        if event_type == "installation" and action in {"deleted", "suspend"}:
            if action == "deleted":
                await self._installation_repo.delete(install_id)
                return {"stored": True, "action": action, "installation_id": install_id}
            existing = await self._installation_repo.get(install_id)
            now = datetime.now(timezone.utc)
            if existing:
                existing.suspended = True
                existing.updated_at = now
                await self._installation_repo.upsert(existing)
            return {"stored": True, "action": action, "installation_id": install_id}

        if event_type == "installation" and action == "unsuspend":
            existing = await self._installation_repo.get(install_id)
            if existing:
                existing.suspended = False
                existing.updated_at = datetime.now(timezone.utc)
                await self._installation_repo.upsert(existing)
                return {"stored": True, "action": action, "installation_id": install_id}

        account = installation.get("account") or {}
        account_login = account.get("login") if isinstance(account, dict) else None
        account_type = account.get("type") if isinstance(account, dict) else None
        selection = installation.get("repository_selection")
        if not isinstance(selection, str):
            selection = None

        repos: list[str] = []
        # installation.created may include repositories; *_repositories events too.
        for key in ("repositories", "repositories_added"):
            raw_repos = payload.get(key)
            if isinstance(raw_repos, list):
                for repo in raw_repos:
                    if isinstance(repo, dict) and repo.get("full_name"):
                        repos.append(str(repo["full_name"]))

        now = datetime.now(timezone.utc)
        existing = await self._installation_repo.get(install_id)

        if event_type == "installation_repositories" and existing:
            current = set(existing.repositories)
            if action == "removed":
                removed = payload.get("repositories_removed") or []
                if isinstance(removed, list):
                    for repo in removed:
                        if isinstance(repo, dict) and repo.get("full_name"):
                            current.discard(str(repo["full_name"]))
                repos = sorted(current)
            else:
                current.update(repos)
                repos = sorted(current)
            selection = selection or existing.repository_selection
            account_login = account_login or existing.account_login
            account_type = account_type or existing.account_type

        if existing and not repos and event_type == "installation":
            repos = list(existing.repositories)

        record = GitHubInstallationRecord(
            installation_id=install_id,
            account_login=account_login or (existing.account_login if existing else None),
            account_type=account_type or (existing.account_type if existing else None),
            repository_selection=selection
            or (existing.repository_selection if existing else None),
            repositories=repos if repos else (list(existing.repositories) if existing else []),
            suspended=False,
            team_id=existing.team_id if existing else None,
            user_id=existing.user_id if existing else None,
            connected_at=existing.connected_at if existing else now,
            updated_at=now,
        )
        await self._installation_repo.upsert(record)
        return {
            "stored": True,
            "action": action,
            "installation_id": install_id,
            "account_login": record.account_login,
            "repositories": record.repositories,
        }

    def _normalize_event(
        self,
        event_type: str,
        payload: dict[str, Any],
        delivery_id: str | None,
    ) -> GitHubActivityItem:
        action = payload.get("action")
        if isinstance(action, str):
            action = action.strip() or None
        else:
            action = None

        installation = payload.get("installation") or {}
        installation_id = None
        if isinstance(installation, dict) and installation.get("id") is not None:
            installation_id = str(installation["id"])
        elif self._settings.github_installation_id.strip():
            installation_id = self._settings.github_installation_id.strip()

        repo = payload.get("repository") or {}
        repo_full_name = repo.get("full_name") if isinstance(repo, dict) else None

        sender = payload.get("sender") or {}
        actor = sender.get("login") if isinstance(sender, dict) else None

        title = "GitHub event"
        body = ""
        html_url = None

        if event_type == "ping":
            title = "Webhook ping"
            body = str(payload.get("zen") or "pong")
            html_url = (payload.get("hook") or {}).get("url") if isinstance(
                payload.get("hook"), dict
            ) else None
        elif event_type == "issues":
            issue = payload.get("issue") or {}
            title = f"Issue #{issue.get('number')}: {issue.get('title') or action or 'update'}"
            body = str(issue.get("body") or "")
            html_url = issue.get("html_url")
            actor = (issue.get("user") or {}).get("login") or actor
        elif event_type == "issue_comment":
            issue = payload.get("issue") or {}
            comment = payload.get("comment") or {}
            title = f"Comment on issue #{issue.get('number')}"
            body = str(comment.get("body") or "")
            html_url = comment.get("html_url") or issue.get("html_url")
            actor = (comment.get("user") or {}).get("login") or actor
        elif event_type == "pull_request":
            pr = payload.get("pull_request") or {}
            number = pr.get("number")
            pr_title = pr.get("title") or action or "update"
            title = f"PR #{number}: {pr_title}"
            body = str(pr.get("body") or "")
            html_url = pr.get("html_url")
            actor = (pr.get("user") or {}).get("login") or actor
            if action == "closed" and pr.get("merged"):
                action = "merged"
        elif event_type == "push":
            commits = payload.get("commits") if isinstance(payload.get("commits"), list) else []
            ref = str(payload.get("ref") or "")
            branch = ref.split("/")[-1] if ref else "branch"
            count = len(commits)
            head = ""
            if commits and isinstance(commits[-1], dict):
                head = str(commits[-1].get("message") or "").split("\n")[0]
            title = f"Pushed {count} commit{'s' if count != 1 else ''} to {branch}"
            body = head or f"{repo_full_name or 'repo'}@{branch}"
            compare = payload.get("compare")
            head_commit = payload.get("head_commit")
            if isinstance(compare, str) and compare:
                html_url = compare
            elif isinstance(head_commit, dict):
                html_url = head_commit.get("url")
            pusher = payload.get("pusher") or {}
            if isinstance(pusher, dict) and pusher.get("name"):
                actor = str(pusher["name"])
        elif event_type == "installation":
            account = (installation.get("account") or {}) if isinstance(
                installation, dict
            ) else {}
            login = account.get("login") if isinstance(account, dict) else None
            title = f"App installation {action or 'updated'}"
            body = f"Account: {login or 'unknown'}"
            html_url = account.get("html_url") if isinstance(account, dict) else None
        elif event_type == "installation_repositories":
            title = f"Installation repositories {action or 'updated'}"
            added = payload.get("repositories_added") or []
            removed = payload.get("repositories_removed") or []
            names: list[str] = []
            if isinstance(added, list):
                names.extend(
                    str(r.get("full_name"))
                    for r in added
                    if isinstance(r, dict) and r.get("full_name")
                )
            if isinstance(removed, list):
                names.extend(
                    f"-{r.get('full_name')}"
                    for r in removed
                    if isinstance(r, dict) and r.get("full_name")
                )
            body = ", ".join(names) if names else "Repository selection changed"

        task_keys = parse_task_keys(title, body)
        preview = body.strip().replace("\n", " ")
        if len(preview) > 160:
            preview = preview[:157] + "..."

        return GitHubActivityItem(
            id=str(uuid4()),
            event_type=event_type,
            action=action,
            title=title,
            body_preview=preview or None,
            repo_full_name=repo_full_name,
            actor_login=actor,
            html_url=html_url,
            task_keys=task_keys,
            installation_id=installation_id,
            delivery_id=delivery_id,
            received_at=datetime.now(timezone.utc),
        )

    async def _best_effort_complete_tasks(self, task_keys: list[str]) -> int:
        """Move matching tasks to done; never raise into the webhook path."""
        if not self._task_repo or not task_keys:
            return 0

        wanted = {key.upper() for key in task_keys}
        completed = 0
        try:
            tasks = getattr(self._task_repo, "_tasks", None)
            if not isinstance(tasks, dict):
                return 0

            for task in list(tasks.values()):
                if task.status == TaskStatus.DONE:
                    continue
                derived = display_task_key(task.id).upper()
                title_keys = {k.upper() for k in parse_task_keys(task.title, task.description)}
                if derived not in wanted and not (title_keys & wanted):
                    continue
                await self._task_repo.update_status(task.id, TaskStatus.DONE)
                completed += 1
        except Exception:  # noqa: BLE001
            logger.exception("Best-effort task completion from GitHub webhook failed")
            return completed
        return completed
