"""Video meeting routes (placeholder for future module)."""

from fastapi import APIRouter

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/health")
async def meetings_health() -> dict[str, str]:
    """Placeholder health check for the meetings module."""
    return {"status": "not_implemented"}
