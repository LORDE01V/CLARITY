"""Team video meetings via Jitsi (public meet.jit.si by default)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.config import Settings
from app.dependencies.auth import CurrentUser
from app.dependencies.providers import get_meeting_service, get_settings_dep
from app.dependencies.rbac import require_team_role
from app.models.enums import Role
from app.models.meeting import (
    MeetingCreate,
    MeetingRecapFromMeetingRequest,
    MeetingResponse,
)
from app.models.recap import RecapResponse
from app.services.meeting_service import MeetingService

router = APIRouter(tags=["meetings"])


@router.get("/meetings/health")
async def meetings_health(
    settings: Settings = Depends(get_settings_dep),
) -> dict[str, str | bool]:
    """Deploy-safe health for meetings + AI stack."""
    return {
        "status": "ok",
        "jitsi_base_url": settings.jitsi_base_url,
        "openai_configured": settings.openai_configured,
        "whisper_model": settings.openai_whisper_model,
        "recap_model": settings.openai_model,
    }


@router.post(
    "/teams/{team_id}/meetings",
    response_model=MeetingResponse,
    status_code=201,
)
async def create_meeting(
    team_id: UUID,
    payload: MeetingCreate,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    """Create a unique Jitsi room and return an embeddable meeting URL."""
    return await meeting_service.create_meeting(team_id, payload, user)


@router.get("/teams/{team_id}/meetings", response_model=list[MeetingResponse])
async def list_meetings(
    team_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> list[MeetingResponse]:
    """List team meetings (newest first)."""
    return await meeting_service.list_meetings(team_id, user)


@router.get(
    "/teams/{team_id}/meetings/{meeting_id}",
    response_model=MeetingResponse,
)
async def get_meeting(
    team_id: UUID,
    meeting_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.GUEST)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    return await meeting_service.get_meeting(team_id, meeting_id, user)


@router.post(
    "/teams/{team_id}/meetings/{meeting_id}/end",
    response_model=MeetingResponse,
)
async def end_meeting(
    team_id: UUID,
    meeting_id: UUID,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    """Mark the meeting ended (call can still be left open in Jitsi)."""
    return await meeting_service.end_meeting(team_id, meeting_id, user)


@router.post("/teams/{team_id}/meetings/{meeting_id}/transcribe")
async def transcribe_meeting_audio(
    team_id: UUID,
    meeting_id: UUID,
    user: CurrentUser,
    file: UploadFile = File(...),
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> dict[str, str]:
    """Upload audio/video and transcribe with OpenAI Whisper."""
    content = await file.read()
    return await meeting_service.transcribe_audio(
        team_id,
        meeting_id,
        user,
        filename=file.filename or "audio.webm",
        content=content,
        content_type=file.content_type,
    )


@router.post(
    "/teams/{team_id}/meetings/{meeting_id}/recap",
    response_model=RecapResponse,
    status_code=201,
)
async def recap_from_meeting(
    team_id: UUID,
    meeting_id: UUID,
    payload: MeetingRecapFromMeetingRequest,
    user: CurrentUser,
    _role: Role = Depends(require_team_role(Role.MEMBER)),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> RecapResponse:
    """Create an AI recap for this meeting from a transcript."""
    return await meeting_service.generate_recap_for_meeting(
        team_id, meeting_id, payload.transcript, user
    )
