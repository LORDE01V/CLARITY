"""Jitsi meeting rooms + Whisper transcription orchestration."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from uuid import UUID

from app.core.exceptions import NotFoundError, ValidationError
from app.db.repositories.meeting_repository import MeetingRepository, new_meeting_row
from app.models.auth import AuthUser
from app.models.enums import Role
from app.models.meeting import MeetingCreate, MeetingResponse, MeetingStatus
from app.models.recap import RecapGenerateRequest, RecapResponse
from app.services.openai_whisper import OpenAIWhisperClient
from app.services.recap_service import RecapService
from app.services.team_service import TeamService

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def build_jitsi_room(*, team_id: UUID, title: str, base_url: str) -> tuple[str, str]:
    """Return (room_name, meeting_url) for public or self-hosted Jitsi."""
    base = base_url.rstrip("/")
    slug = _SLUG_RE.sub("-", title.strip().lower()).strip("-")[:40] or "sync"
    room = f"clarity-{str(team_id).split('-')[0]}-{slug}-{secrets.token_hex(3)}"
    return room, f"{base}/{room}"


class MeetingService:
    def __init__(
        self,
        *,
        meeting_repo: MeetingRepository,
        team_service: TeamService,
        whisper: OpenAIWhisperClient,
        recap_service: RecapService,
        jitsi_base_url: str = "https://meet.jit.si",
    ) -> None:
        self._meetings = meeting_repo
        self._teams = team_service
        self._whisper = whisper
        self._recaps = recap_service
        self._jitsi_base = jitsi_base_url.rstrip("/") or "https://meet.jit.si"

    async def create_meeting(
        self, team_id: UUID, payload: MeetingCreate, user: AuthUser
    ) -> MeetingResponse:
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        room_name, meeting_url = build_jitsi_room(
            team_id=team_id, title=payload.title, base_url=self._jitsi_base
        )
        row = new_meeting_row(
            team_id=team_id,
            title=payload.title,
            room_name=room_name,
            meeting_url=meeting_url,
            created_by=user.id,
            status=MeetingStatus.LIVE,
        )
        return await self._meetings.create(row)

    async def list_meetings(self, team_id: UUID, user: AuthUser) -> list[MeetingResponse]:
        await self._teams.require_team_role(team_id, user, Role.GUEST)
        return await self._meetings.list_by_team(team_id)

    async def get_meeting(
        self, team_id: UUID, meeting_id: UUID, user: AuthUser
    ) -> MeetingResponse:
        await self._teams.require_team_role(team_id, user, Role.GUEST)
        meeting = await self._meetings.get_by_id(meeting_id)
        if not meeting or meeting.team_id != team_id:
            raise NotFoundError("Meeting not found")
        return meeting

    async def end_meeting(
        self, team_id: UUID, meeting_id: UUID, user: AuthUser
    ) -> MeetingResponse:
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        meeting = await self.get_meeting(team_id, meeting_id, user)
        if meeting.status == MeetingStatus.ENDED:
            return meeting
        now = datetime.now(timezone.utc).isoformat()
        return await self._meetings.update(
            meeting_id,
            {"status": MeetingStatus.ENDED.value, "ended_at": now},
        )

    async def transcribe_audio(
        self,
        team_id: UUID,
        meeting_id: UUID,
        user: AuthUser,
        *,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> dict[str, str]:
        await self.get_meeting(team_id, meeting_id, user)
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        text = await self._whisper.transcribe(
            filename=filename,
            content=content,
            content_type=content_type,
        )
        return {"transcript": text}

    async def generate_recap_for_meeting(
        self,
        team_id: UUID,
        meeting_id: UUID,
        transcript: str,
        user: AuthUser,
    ) -> RecapResponse:
        meeting = await self.get_meeting(team_id, meeting_id, user)
        return await self._recaps.generate(
            team_id,
            RecapGenerateRequest(
                title=meeting.title,
                transcript=transcript,
                meeting_url=meeting.meeting_url,
            ),
            user,
        )
