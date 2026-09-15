"""
Authentication service wrapping Supabase Auth.

Validates JWTs issued by Supabase (ES256 via JWKS, with HS256 legacy fallback)
and exposes login/register helpers.
"""

from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID

import jwt
from jwt import PyJWKClient

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError
from app.models.auth import AuthSessionResponse, AuthUser, LoginRequest, RegisterRequest


@lru_cache
def _jwks_client_for(supabase_url: str) -> PyJWKClient:
    """Cached JWKS client for Supabase Auth signing keys."""
    base = supabase_url.rstrip("/")
    return PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


class AuthService:
    """Handles user authentication via Supabase Auth and JWT validation."""

    def __init__(self, supabase_client, settings: Settings | None = None) -> None:
        self._client = supabase_client
        self._settings = settings or get_settings()

    def verify_access_token(self, token: str) -> AuthUser:
        """
        Decode and validate a Supabase JWT access token.

        New Supabase projects sign with ES256 (JWKS). Older projects may still
        use HS256 with the legacy JWT secret.
        """
        try:
            header = jwt.get_unverified_header(token)
            alg = header.get("alg", "HS256")
            options = {
                "require": ["exp", "sub"],
                # Supabase access tokens always carry aud=authenticated.
                "verify_aud": True,
            }

            if alg in {"ES256", "RS256"}:
                jwks = _jwks_client_for(self._settings.supabase_url)
                key = jwks.get_signing_key_from_jwt(token).key
                payload = jwt.decode(
                    token,
                    key,
                    algorithms=[alg],
                    audience="authenticated",
                    options=options,
                )
            else:
                secret = self._settings.supabase_jwt_secret
                if not secret:
                    raise AuthenticationError("JWT secret not configured")
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options=options,
                )

            user_id = UUID(str(payload["sub"]))
            metadata = payload.get("user_metadata", {}) or {}
            email = (
                payload.get("email")
                or metadata.get("email")
                or f"{user_id}@users.supabase.local"
            )
            full_name = metadata.get("full_name")
            if isinstance(full_name, str):
                full_name = full_name or None
            else:
                full_name = None

            return AuthUser(
                id=user_id,
                email=email,
                full_name=full_name,
            )
        except AuthenticationError:
            raise
        except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
            raise AuthenticationError("Invalid or expired access token") from exc

    async def login(self, payload: LoginRequest) -> AuthSessionResponse:
        """Authenticate a user with email and password."""
        try:
            response = self._client.auth.sign_in_with_password(
                {"email": payload.email, "password": payload.password}
            )
        except Exception as exc:
            raise AuthenticationError("Invalid email or password") from exc

        session = response.session
        user = response.user
        if session is None or user is None:
            raise AuthenticationError("Invalid email or password")

        return AuthSessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_at=datetime.fromtimestamp(session.expires_at, tz=timezone.utc),
            user=AuthUser(
                id=UUID(user.id),
                email=user.email,
                full_name=(user.user_metadata or {}).get("full_name"),
            ),
        )

    async def register(self, payload: RegisterRequest) -> AuthSessionResponse:
        """Register a new user account."""
        try:
            response = self._client.auth.sign_up(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "options": {"data": {"full_name": payload.full_name}},
                }
            )
        except Exception as exc:
            detail = str(exc).strip() or "Registration failed"
            raise AuthenticationError(detail) from exc

        session = response.session
        user = response.user
        if user is None:
            raise AuthenticationError("Registration failed")
        if session is None:
            raise AuthenticationError(
                "Registration created the user but returned no session. "
                "In Supabase Auth, turn Confirm email OFF for local development."
            )

        return AuthSessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_at=datetime.fromtimestamp(session.expires_at, tz=timezone.utc),
            user=AuthUser(
                id=UUID(user.id),
                email=user.email,
                full_name=payload.full_name,
            ),
        )
