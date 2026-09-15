"""
CLARITY API entry point.

Registers routers, exception handlers, and middleware. Run with:
    uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import (
    AuthenticationError,
    ClarityError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.routers import auth, github, invites, meetings, orgs, tasks, teams


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan hook for startup/shutdown tasks."""
    yield


def create_app() -> FastAPI:
    """Application factory for testability."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Unified corporate workspace API",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _register_exception_handlers(app)
    _register_routers(app)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name}

    return app


def _register_routers(app: FastAPI) -> None:
    """Mount all API route modules."""
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(orgs.router, prefix="/api/v1")
    app.include_router(teams.router, prefix="/api/v1")
    app.include_router(invites.router, prefix="/api/v1")
    app.include_router(tasks.router, prefix="/api/v1")
    app.include_router(meetings.router, prefix="/api/v1")
    app.include_router(github.router, prefix="/api/v1")


def _register_exception_handlers(app: FastAPI) -> None:
    """Map domain exceptions to HTTP status codes."""

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": exc.message})

    @app.exception_handler(PermissionDeniedError)
    async def forbidden_handler(
        _request: Request, exc: PermissionDeniedError
    ) -> JSONResponse:
        return JSONResponse(status_code=403, content={"detail": exc.message})

    @app.exception_handler(AuthenticationError)
    async def auth_handler(
        _request: Request, exc: AuthenticationError
    ) -> JSONResponse:
        return JSONResponse(status_code=401, content={"detail": exc.message})

    @app.exception_handler(ValidationError)
    async def validation_handler(
        _request: Request, exc: ValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.message})

    @app.exception_handler(ConflictError)
    async def conflict_handler(_request: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": exc.message})

    @app.exception_handler(ClarityError)
    async def clarity_handler(_request: Request, exc: ClarityError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": exc.message})


app = create_app()
