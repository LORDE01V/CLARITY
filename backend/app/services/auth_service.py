"""
Authentication service wrapping Supabase Auth.

Validates JWTs issued by Supabase and exposes login/register helpers.
For tests, token verification can be bypassed via dependency overrides.
"""

from datetime import datetime, timezone
from uuid import UUID

from jose import JWTError, jwt

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError
from app.models.auth import AuthSessionResponse, AuthUser, LoginRequest, RegisterRequest


class AuthService:
    """Handles user authentication via Supabase Auth and JWT validation."""

    def __init__(self, supabase_client, settings: Settings | None = None) -> None:
        self._client = supabase_client
        self._settings = settings or get_settings()

    def verify_access_token(self, token: str) -> AuthUser:
        """
        Decode and validate a Supabase JWT access token.

        Raises AuthenticationError if the token is invalid or expired.
        """
        try:
            payload = jwt.decode(
                token,
                self._settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            user_id = UUID(payload["sub"])
            email = payload.get("email", "")
            metadata = payload.get("user_metadata", {})
            return AuthUser(
                id=user_id,
                email=email,
                full_name=metadata.get("full_name"),
            )
        except (JWTError, KeyError, ValueError) as exc:
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
                full_name=user.user_metadata.get("full_name"),
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
            raise AuthenticationError("Registration failed") from exc

        session = response.session
        user = response.user
        if session is None or user is None:
            raise AuthenticationError("Registration failed")

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
