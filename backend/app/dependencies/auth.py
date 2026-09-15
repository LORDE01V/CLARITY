"""
Authentication dependencies.

Extracts the current user from the Authorization header by validating
the Supabase JWT. Routers depend on get_current_user; RBAC builds on top.
"""

from typing import Annotated

from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError
from app.models.auth import AuthUser
from app.services.auth_service import AuthService


def get_auth_service() -> AuthService:
    """Provide AuthService with the default Supabase client."""
    from app.db.supabase import get_supabase_client

    return AuthService(get_supabase_client())


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthUser:
    """
    FastAPI dependency that resolves the authenticated user from JWT.

    Expects: Authorization: Bearer <access_token>
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    return auth_service.verify_access_token(token)


async def require_github_reader(
    authorization: Annotated[str | None, Header()] = None,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthUser | None:
    """
    Require a JWT for GitHub read routes, unless local/dev unauthenticated
    reads are enabled (APP_ENV=development|local|dev).
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        return auth_service.verify_access_token(token)

    if get_settings().allow_local_github_reads:
        return None

    raise AuthenticationError("Missing or invalid Authorization header")


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
GitHubReader = Annotated[AuthUser | None, Depends(require_github_reader)]
