"""Pydantic models for GitHub App webhook activity and status."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GitHubActivityItem(BaseModel):
    """Normalized GitHub webhook event stored for activity feeds."""

    id: str
    event_type: str
    action: str | None = None
    title: str
    body_preview: str | None = None
    repo_full_name: str | None = None
    actor_login: str | None = None
    html_url: str | None = None
    task_keys: list[str] = Field(default_factory=list)
    installation_id: str | None = None
    delivery_id: str | None = None
    received_at: datetime


class GitHubInstallationRecord(BaseModel):
    """Persisted (in-memory) GitHub App installation linked to Clarity."""

    installation_id: str
    account_login: str | None = None
    account_type: str | None = None
    repository_selection: str | None = None
    repositories: list[str] = Field(default_factory=list)
    suspended: bool = False
    team_id: UUID | None = None
    user_id: UUID | None = None
    connected_at: datetime
    updated_at: datetime


class GitHubConnectResponse(BaseModel):
    """Install URL for the Connect GitHub flow."""

    url: str
    state: str
    app_slug: str | None = None
    requires_session: bool = False
    detail: str | None = None


class GitHubCallbackResponse(BaseModel):
    """Result of the GitHub App setup redirect callback."""

    ok: bool
    installation_id: str | None = None
    linked: bool = False
    account_login: str | None = None
    detail: str | None = None


class GitHubStatusResponse(BaseModel):
    """Whether the GitHub App integration is configured and reachable."""

    configured: bool
    app_id_set: bool
    webhook_secret_set: bool
    private_key_loaded: bool
    installation_id_set: bool
    installation_reachable: bool | None = None
    connected: bool = False
    installation_id: str | None = None
    account_login: str | None = None
    account_type: str | None = None
    repositories: list[str] = Field(default_factory=list)
    repository_selection: str | None = None
    team_id: UUID | None = None
    user_id: UUID | None = None
    source: str | None = None
    detail: str | None = None
