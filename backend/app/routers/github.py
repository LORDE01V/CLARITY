"""GitHub App webhook ingest, Connect flow, activity feed, and status routes."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.dependencies.auth import GitHubReader
from app.dependencies.providers import get_github_service
from app.models.github import (
    GitHubActivityItem,
    GitHubCallbackResponse,
    GitHubConnectResponse,
    GitHubStatusResponse,
)
from app.services.github_service import GitHubService

router = APIRouter(prefix="/github", tags=["github"])


@router.post("/webhooks")
async def github_webhooks(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
    x_github_delivery: str | None = Header(default=None, alias="X-GitHub-Delivery"),
    github_service: GitHubService = Depends(get_github_service),
) -> dict[str, Any]:
    """
    Ingest GitHub App webhooks (raw body + HMAC signature verification).

    Handles ping, issues, issue_comment, pull_request, installation, and
    installation_repositories. Other events are acknowledged and ignored.
    """
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        payload = {}

    if not isinstance(payload, dict):
        payload = {}

    return await github_service.handle_webhook(
        event_name=x_github_event or "",
        payload=payload,
        delivery_id=x_github_delivery,
        raw_body=raw_body,
        signature=x_hub_signature_256,
        verify=True,
    )


@router.get("/connect", response_model=GitHubConnectResponse)
async def github_connect(
    user: GitHubReader,
    team_id: UUID | None = Query(default=None),
    github_service: GitHubService = Depends(get_github_service),
) -> GitHubConnectResponse:
    """
    Return the GitHub App install URL for the Connect GitHub flow.

    Opens in a new tab from the frontend. After install, GitHub sends an
    `installation` webhook and (if configured) redirects to /callback.
    """
    requires_session = user is None
    return await github_service.build_connect_url(
        user_id=user.id if user else None,
        team_id=team_id,
        requires_session=requires_session,
    )


@router.get("/callback", response_model=None)
async def github_callback(
    installation_id: str | None = Query(default=None),
    setup_action: str | None = Query(default=None),
    state: str | None = Query(default=None),
    redirect: bool = Query(
        default=True,
        description="When true, redirect to the frontend Code view after linking.",
    ),
    github_service: GitHubService = Depends(get_github_service),
) -> RedirectResponse | GitHubCallbackResponse:
    """
    GitHub App setup URL target.

    Configure the App's Setup URL to this path. Links installation_id to the
    pending Connect state (team/user) when present.
    """
    result = await github_service.handle_setup_callback(
        installation_id=installation_id,
        setup_action=setup_action,
        state=state,
    )
    if not redirect:
        return result

    settings = get_settings()
    origin = settings.frontend_origin.strip().rstrip("/") or "http://localhost:5173"
    params = {
        "github": "connected" if result.ok else "error",
        "installation_id": result.installation_id or "",
    }
    if result.detail:
        params["detail"] = result.detail
    query = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return RedirectResponse(url=f"{origin}/?nav=Code&{query}", status_code=302)


@router.get("/activity", response_model=list[GitHubActivityItem])
async def list_github_activity(
    user: GitHubReader,
    limit: int = Query(default=50, ge=1, le=200),
    team_id: UUID | None = Query(default=None),
    github_service: GitHubService = Depends(get_github_service),
) -> list[GitHubActivityItem]:
    """
    List recent ingested GitHub events.

    JWT required in production; unauthenticated when APP_ENV is local/dev.
    Prefers a linked installation over GITHUB_INSTALLATION_ID.
    """
    return await github_service.list_activity(
        limit=limit,
        team_id=team_id,
        user_id=user.id if user else None,
    )


@router.get("/status", response_model=GitHubStatusResponse)
async def github_status(
    user: GitHubReader,
    probe: bool = Query(default=True),
    team_id: UUID | None = Query(default=None),
    github_service: GitHubService = Depends(get_github_service),
) -> GitHubStatusResponse:
    """
    Report whether the GitHub App is configured and the installation is reachable.

    JWT required in production; unauthenticated when APP_ENV is local/dev.
    """
    return await github_service.get_status(
        probe_installation=probe,
        team_id=team_id,
        user_id=user.id if user else None,
    )
