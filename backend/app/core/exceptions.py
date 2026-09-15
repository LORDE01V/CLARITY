"""
Domain-specific exceptions for the CLARITY API.

Keeping exceptions in a dedicated module lets services raise meaningful
errors without importing FastAPI, while routers map them to HTTP responses.
"""

from typing import Any


class ClarityError(Exception):
    """Base exception for all CLARITY domain errors."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(ClarityError):
    """Raised when a requested resource does not exist."""


class PermissionDeniedError(ClarityError):
    """Raised when the caller lacks required permissions."""


class ConflictError(ClarityError):
    """Raised when an operation conflicts with existing state."""


class ValidationError(ClarityError):
    """Raised when business-rule validation fails."""


class AuthenticationError(ClarityError):
    """Raised when authentication credentials are invalid or missing."""
