"""Authentication-related Pydantic models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class AuthUser(BaseModel):
    """Authenticated user extracted from a Supabase JWT."""

    id: UUID
    email: EmailStr
    full_name: str | None = None


class AuthSessionResponse(BaseModel):
    """Response returned after successful login or session refresh."""

    access_token: str
    refresh_token: str
    expires_at: datetime
    user: AuthUser


class LoginRequest(BaseModel):
    """Credentials for email/password login via Supabase Auth."""

    email: EmailStr
    password: str = Field(min_length=8)


class RegisterRequest(BaseModel):
    """Registration payload for new users."""

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=120)


class TokenPayload(BaseModel):
    """Decoded JWT claims from Supabase."""

    sub: UUID
    email: EmailStr
    role: str = "authenticated"
    exp: int
