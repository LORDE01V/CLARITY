"""Minimal GitHub REST client authenticated as a GitHub App installation."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings
from app.core.exceptions import ValidationError
from app.services.github_auth import create_app_jwt

_API_BASE = "https://api.github.com"
_API_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


class GitHubAppClient:
    """httpx-backed helper for App JWT → installation token → REST calls."""

    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings
        self._client = client
        self._owns_client = client is None
        self._installation_token: str | None = None

    async def __aenter__(self) -> GitHubAppClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
            self._owns_client = True
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _require_client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise ValidationError("GitHub HTTP client is not initialized")
        return self._client

    async def get_installation_token(
        self, installation_id: str | None = None
    ) -> str:
        """Exchange an App JWT for an installation access token."""
        install_id = (installation_id or self._settings.github_installation_id).strip()
        if not install_id:
            raise ValidationError("GITHUB_INSTALLATION_ID is not configured")

        app_jwt = create_app_jwt(self._settings)
        client = self._require_client()
        response = await client.post(
            f"{_API_BASE}/app/installations/{install_id}/access_tokens",
            headers={**_API_HEADERS, "Authorization": f"Bearer {app_jwt}"},
        )
        if response.status_code >= 400:
            raise ValidationError(
                f"Failed to create installation token ({response.status_code})"
            )
        data = response.json()
        token = data.get("token")
        if not token:
            raise ValidationError("GitHub installation token response missing token")
        self._installation_token = token
        return token

    async def get_installation(
        self, installation_id: str | None = None
    ) -> dict[str, Any]:
        """Fetch installation metadata (proves App JWT + install id work)."""
        install_id = (installation_id or self._settings.github_installation_id).strip()
        if not install_id:
            raise ValidationError("GITHUB_INSTALLATION_ID is not configured")

        app_jwt = create_app_jwt(self._settings)
        client = self._require_client()
        response = await client.get(
            f"{_API_BASE}/app/installations/{install_id}",
            headers={**_API_HEADERS, "Authorization": f"Bearer {app_jwt}"},
        )
        if response.status_code >= 400:
            raise ValidationError(
                f"Installation not reachable ({response.status_code})"
            )
        return response.json()

    async def request(
        self,
        method: str,
        path: str,
        *,
        installation_id: str | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Authenticated installation request to the GitHub REST API."""
        token = self._installation_token or await self.get_installation_token(
            installation_id
        )
        client = self._require_client()
        url = path if path.startswith("http") else f"{_API_BASE}{path}"
        response = await client.request(
            method,
            url,
            headers={
                **_API_HEADERS,
                "Authorization": f"Bearer {token}",
                **(kwargs.pop("headers", {}) or {}),
            },
            **kwargs,
        )
        if response.status_code == 401:
            self._installation_token = None
            token = await self.get_installation_token(installation_id)
            response = await client.request(
                method,
                url,
                headers={
                    **_API_HEADERS,
                    "Authorization": f"Bearer {token}",
                    **(kwargs.get("headers") or {}),
                },
                **{k: v for k, v in kwargs.items() if k != "headers"},
            )
        return response
