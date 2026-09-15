"""Authentication routes: login, register, and session info."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_auth_service
from app.models.auth import (
    AuthSessionResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthSessionResponse:
    """Authenticate with email and password via Supabase Auth."""
    return await auth_service.login(payload)


@router.post("/register", response_model=AuthSessionResponse)
async def register(
    payload: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthSessionResponse:
    """Register a new user account."""
    return await auth_service.register(payload)


@router.get("/me", response_model=AuthUser)
async def get_me(user: CurrentUser) -> AuthUser:
    """Return the currently authenticated user."""
    return user
