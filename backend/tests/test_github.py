"""
Tests for GitHub App webhook ingest, signature verify, and activity listing.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.repositories.github_event_repository import InMemoryGitHubEventRepository
from app.db.repositories.github_installation_repository import (
    InMemoryGitHubInstallationRepository,
    clear_pending_connect_states,
)
from app.db.repositories.task_repository import InMemoryTaskRepository
from app.dependencies.auth import get_current_user, require_github_reader
from app.dependencies.providers import (
    get_github_service,
    get_invite_service,
    get_org_service,
    get_task_service,
    get_team_service,
)
from app.main import create_app
from app.models.auth import AuthUser
from app.models.enums import TaskStatus
from app.models.task import TaskCreate
from app.services.github_service import GitHubService
from app.services.github_task_keys import display_task_key, parse_task_keys


WEBHOOK_SECRET = "test-webhook-secret"


def _sign(body: bytes, secret: str = WEBHOOK_SECRET) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@pytest.fixture
def github_settings() -> Settings:
    return Settings(
        supabase_url="http://localhost:54321",
        supabase_anon_key="test-anon-key",
        supabase_service_role_key="test-service-key",
        supabase_jwt_secret="test-jwt-secret",
        github_app_id="123456",
        github_app_slug="clarity-local",
        github_client_id="Iv1.test",
        github_webhook_secret=WEBHOOK_SECRET,
        github_private_key_path="",
        github_private_key="unused-in-webhook-tests",
        github_installation_id="999001",
        frontend_origin="http://localhost:5173",
    )


@pytest.fixture
def github_events() -> InMemoryGitHubEventRepository:
    return InMemoryGitHubEventRepository()


@pytest.fixture
def github_installations() -> InMemoryGitHubInstallationRepository:
    clear_pending_connect_states()
    return InMemoryGitHubInstallationRepository()


@pytest.fixture
def github_task_repo() -> InMemoryTaskRepository:
    return InMemoryTaskRepository()


@pytest.fixture
def github_service(
    github_settings, github_events, github_installations, github_task_repo
) -> GitHubService:
    return GitHubService(
        settings=github_settings,
        event_repo=github_events,
        installation_repo=github_installations,
        task_repo=github_task_repo,
    )


@pytest.fixture
def github_client(
    repos,
    org_service,
    team_service,
    invite_service,
    task_service,
    owner_user,
    github_service,
):
    """Test client with GitHub service override and auth bypass."""
    app = create_app()

    async def override_user():
        return owner_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[require_github_reader] = override_user
    app.dependency_overrides[get_org_service] = lambda: org_service
    app.dependency_overrides[get_team_service] = lambda: team_service
    app.dependency_overrides[get_invite_service] = lambda: invite_service
    app.dependency_overrides[get_task_service] = lambda: task_service
    app.dependency_overrides[get_github_service] = lambda: github_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_parse_task_keys_from_title_and_body():
    keys = parse_task_keys(
        "Fix CLR-101 and clr-202",
        "Also see CLR-101 again and CLR-303.",
    )
    assert keys == ["CLR-101", "CLR-202", "CLR-303"]


def test_display_task_key_matches_frontend_shape():
    task_id = uuid4()
    key = display_task_key(task_id)
    assert key.startswith("CLR-")
    n = int(key.split("-", 1)[1])
    assert 100 <= n <= 999


def test_webhook_rejects_invalid_signature(github_client):
    body = b'{"zen":"test"}'
    response = github_client.post(
        "/api/v1/github/webhooks",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": "sha256=deadbeef",
        },
    )
    assert response.status_code == 401


def test_webhook_ping_ingested(github_client, github_events):
    payload = {"zen": "Design is not just what it looks like.", "hook_id": 1}
    body = json.dumps(payload).encode("utf-8")
    response = github_client.post(
        "/api/v1/github/webhooks",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "ping",
            "X-GitHub-Delivery": "delivery-ping-1",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["event"] == "ping"

    listed = github_client.get("/api/v1/github/activity")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["event_type"] == "ping"
    assert "Design is not just" in (items[0]["body_preview"] or "")


def test_push_event_appears_in_activity(github_client):
    payload = {
        "ref": "refs/heads/main",
        "compare": "https://github.com/acme/clarity/compare/abc...def",
        "installation": {"id": 999001},
        "repository": {"full_name": "acme/clarity"},
        "sender": {"login": "lorde"},
        "pusher": {"name": "lorde"},
        "commits": [
            {"message": "Wire live GitHub push into Clarity\n\nMore detail", "id": "abc"},
            {"message": "Polish activity empty state", "id": "def"},
        ],
        "head_commit": {"url": "https://github.com/acme/clarity/commit/def"},
    }
    body = json.dumps(payload).encode("utf-8")
    response = github_client.post(
        "/api/v1/github/webhooks",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "delivery-push-1",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    assert response.status_code == 200
    assert response.json()["event"] == "push"

    listed = github_client.get("/api/v1/github/activity")
    assert listed.status_code == 200
    items = listed.json()
    assert items[0]["event_type"] == "push"
    assert "Pushed 2 commits to main" in items[0]["title"]
    assert "Polish activity empty state" in (items[0]["body_preview"] or "")


def test_pull_request_and_issues_appear_in_activity(github_client):
    pr_payload = {
        "action": "opened",
        "installation": {"id": 999001},
        "repository": {"full_name": "acme/clarity"},
        "sender": {"login": "maya"},
        "pull_request": {
            "number": 42,
            "title": "Ship CLR-101 webhook ingest",
            "body": "Closes CLR-101",
            "html_url": "https://github.com/acme/clarity/pull/42",
            "user": {"login": "maya"},
            "merged": False,
        },
    }
    pr_body = json.dumps(pr_payload).encode("utf-8")
    pr_resp = github_client.post(
        "/api/v1/github/webhooks",
        content=pr_body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": _sign(pr_body),
        },
    )
    assert pr_resp.status_code == 200
    assert pr_resp.json()["task_keys"] == ["CLR-101"]

    issue_payload = {
        "action": "opened",
        "installation": {"id": 999001},
        "repository": {"full_name": "acme/clarity"},
        "issue": {
            "number": 7,
            "title": "Bug in nav",
            "body": "Related to CLR-202",
            "html_url": "https://github.com/acme/clarity/issues/7",
            "user": {"login": "sam"},
        },
    }
    issue_body = json.dumps(issue_payload).encode("utf-8")
    issue_resp = github_client.post(
        "/api/v1/github/webhooks",
        content=issue_body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "issues",
            "X-Hub-Signature-256": _sign(issue_body),
        },
    )
    assert issue_resp.status_code == 200
    assert "CLR-202" in issue_resp.json()["task_keys"]

    activity = github_client.get("/api/v1/github/activity").json()
    assert len(activity) >= 2
    types = {item["event_type"] for item in activity}
    assert "pull_request" in types
    assert "issues" in types


@pytest.mark.asyncio
async def test_merged_pr_completes_linked_task(
    github_service, github_task_repo, github_events
):
    team_id = uuid4()
    task = await github_task_repo.create(
        team_id,
        TaskCreate(title="Implement CLR-555 ingest", status=TaskStatus.IN_PROGRESS),
    )
    key = display_task_key(task.id)

    payload = {
        "action": "closed",
        "installation": {"id": 999001},
        "pull_request": {
            "number": 9,
            "title": f"Done {key}",
            "body": f"Fixes {key}",
            "html_url": "https://github.com/acme/clarity/pull/9",
            "user": {"login": "dev"},
            "merged": True,
        },
    }
    result = await github_service.handle_webhook(
        event_name="pull_request",
        payload=payload,
        verify=False,
    )
    assert result["tasks_completed"] == 1
    updated = await github_task_repo.get_by_id(task.id)
    assert updated is not None
    assert updated.status == TaskStatus.DONE


def test_activity_requires_auth_outside_local(github_service, monkeypatch):
    """Production-like APP_ENV must reject unauthenticated activity reads."""
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    # Rebuild settings singleton used by require_github_reader.
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_github_service] = lambda: github_service
    with TestClient(app) as client:
        response = client.get("/api/v1/github/activity")
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    assert response.status_code == 401


def test_activity_allows_unauthenticated_in_development(github_service, monkeypatch):
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_github_service] = lambda: github_service
    with TestClient(app) as client:
        response = client.get("/api/v1/github/activity")
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    assert response.status_code == 200
    assert response.json() == []


def test_status_endpoint(github_client):
    response = github_client.get("/api/v1/github/status?probe=false")
    assert response.status_code == 200
    data = response.json()
    assert data["app_id_set"] is True
    assert data["webhook_secret_set"] is True
    assert data["installation_id_set"] is True
    assert data["connected"] is True
    assert data["source"] == "env"


def test_connect_url_uses_app_slug(github_client, github_service, owner_user):
    response = github_client.get("/api/v1/github/connect")
    assert response.status_code == 200
    data = response.json()
    assert data["app_slug"] == "clarity-local"
    assert data["url"].startswith(
        "https://github.com/apps/clarity-local/installations/new?"
    )
    assert "state=" in data["url"]
    assert data["state"]

    # Service-level: authenticated connect does not flag requires_session.
    linked = github_service.build_connect_url(
        user_id=owner_user.id,
        requires_session=False,
    )
    assert linked.requires_session is False
    assert linked.app_slug == "clarity-local"

def test_connect_url_requires_slug_or_client_id(github_events, github_installations):
    settings = Settings(
        supabase_url="http://localhost:54321",
        supabase_anon_key="test-anon-key",
        supabase_service_role_key="test-service-key",
        supabase_jwt_secret="test-jwt-secret",
        github_app_id="123456",
        github_app_slug="",
        github_client_id="",
        github_webhook_secret=WEBHOOK_SECRET,
    )
    service = GitHubService(
        settings=settings,
        event_repo=github_events,
        installation_repo=github_installations,
    )
    with pytest.raises(Exception) as exc:
        service.build_connect_url()
    assert "GITHUB_APP_SLUG" in str(exc.value)


def test_installation_webhook_stores_account_and_repos(
    github_client, github_installations
):
    payload = {
        "action": "created",
        "installation": {
            "id": 555777,
            "account": {"login": "acme-org", "type": "Organization"},
            "repository_selection": "selected",
        },
        "repositories": [
            {"full_name": "acme-org/clarity"},
            {"full_name": "acme-org/docs"},
        ],
        "sender": {"login": "maya"},
    }
    body = json.dumps(payload).encode("utf-8")
    response = github_client.post(
        "/api/v1/github/webhooks",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "installation",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["event"] == "installation"
    assert data["installation"]["stored"] is True
    assert data["installation"]["account_login"] == "acme-org"

    status = github_client.get("/api/v1/github/status?probe=false").json()
    assert status["connected"] is True
    assert status["installation_id"] == "555777"
    assert status["account_login"] == "acme-org"
    assert status["source"] == "store"
    assert "acme-org/clarity" in status["repositories"]


def test_installation_repositories_webhook_updates_list(
    github_client, github_installations
):
    created = {
        "action": "created",
        "installation": {
            "id": 555888,
            "account": {"login": "solo-dev", "type": "User"},
            "repository_selection": "selected",
        },
        "repositories": [{"full_name": "solo-dev/alpha"}],
    }
    created_body = json.dumps(created).encode("utf-8")
    github_client.post(
        "/api/v1/github/webhooks",
        content=created_body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "installation",
            "X-Hub-Signature-256": _sign(created_body),
        },
    )

    added = {
        "action": "added",
        "installation": {"id": 555888},
        "repositories_added": [{"full_name": "solo-dev/beta"}],
        "repositories_removed": [],
    }
    added_body = json.dumps(added).encode("utf-8")
    response = github_client.post(
        "/api/v1/github/webhooks",
        content=added_body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "installation_repositories",
            "X-Hub-Signature-256": _sign(added_body),
        },
    )
    assert response.status_code == 200
    status = github_client.get("/api/v1/github/status?probe=false").json()
    assert status["installation_id"] == "555888"
    assert set(status["repositories"]) == {"solo-dev/alpha", "solo-dev/beta"}


@pytest.mark.asyncio
async def test_callback_links_installation_to_team(
    github_service, github_installations
):
    team_id = uuid4()
    user_id = uuid4()
    connect = github_service.build_connect_url(user_id=user_id, team_id=team_id)
    result = await github_service.handle_setup_callback(
        installation_id="777001",
        setup_action="install",
        state=connect.state,
    )
    assert result.ok is True
    assert result.linked is True
    record = await github_installations.get("777001")
    assert record is not None
    assert record.team_id == team_id
    assert record.user_id == user_id


def test_callback_redirects_to_frontend(github_client):
    connect = github_client.get("/api/v1/github/connect").json()
    response = github_client.get(
        "/api/v1/github/callback",
        params={
            "installation_id": "888001",
            "setup_action": "install",
            "state": connect["state"],
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://localhost:5173/?nav=Code&")
    assert "github=connected" in location
    assert "installation_id=888001" in location


def test_activity_prefers_store_installation_over_env(
    github_client, github_installations
):
    # Env install is 999001; store a different one and ensure status prefers store.
    payload = {
        "action": "created",
        "installation": {
            "id": 424242,
            "account": {"login": "linked-user", "type": "User"},
            "repository_selection": "all",
        },
        "repositories": [{"full_name": "linked-user/app"}],
    }
    body = json.dumps(payload).encode("utf-8")
    github_client.post(
        "/api/v1/github/webhooks",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "installation",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    status = github_client.get("/api/v1/github/status?probe=false").json()
    assert status["installation_id"] == "424242"
    assert status["source"] == "store"