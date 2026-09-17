"""Unit tests for Jitsi meeting room creation."""

from uuid import uuid4

import pytest

from app.db.repositories.meeting_repository import InMemoryMeetingRepository
from app.models.meeting import MeetingCreate, MeetingStatus
from app.models.org import OrganizationCreate
from app.services.meeting_service import MeetingService, build_jitsi_room
from app.services.openai_whisper import OpenAIWhisperClient


def test_build_jitsi_room_unique():
    team_id = uuid4()
    room_a, url_a = build_jitsi_room(
        team_id=team_id, title="Sprint Sync", base_url="https://meet.jit.si"
    )
    room_b, url_b = build_jitsi_room(
        team_id=team_id, title="Sprint Sync", base_url="https://meet.jit.si"
    )
    assert room_a != room_b
    assert url_a.startswith("https://meet.jit.si/clarity-")
    assert url_b.startswith("https://meet.jit.si/clarity-")


@pytest.mark.asyncio
async def test_create_and_end_meeting(org_service, team_service, owner_user):
    org = await org_service.create_organization(
        OrganizationCreate(name="Meet Co", slug=f"meet-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]

    class _NoRecaps:
        async def generate(self, *args, **kwargs):
            raise AssertionError("not used")

    service = MeetingService(
        meeting_repo=InMemoryMeetingRepository(),
        team_service=team_service,
        whisper=OpenAIWhisperClient(api_key=""),
        recap_service=_NoRecaps(),  # type: ignore[arg-type]
        jitsi_base_url="https://meet.jit.si",
    )

    created = await service.create_meeting(
        team.id, MeetingCreate(title="Design review"), owner_user
    )
    assert created.status == MeetingStatus.LIVE
    assert "meet.jit.si" in created.meeting_url

    listed = await service.list_meetings(team.id, owner_user)
    assert len(listed) == 1

    ended = await service.end_meeting(team.id, created.id, owner_user)
    assert ended.status == MeetingStatus.ENDED
    assert ended.ended_at is not None
