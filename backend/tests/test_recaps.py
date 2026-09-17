"""Unit tests for AI meeting recap generation and send-to-chat."""

from uuid import uuid4

import pytest

from app.db.repositories.recap_repository import InMemoryRecapRepository
from app.models.recap import (
    RecapActionItem,
    RecapGenerateRequest,
    RecapSendRequest,
    RecapStatus,
    RecapUpdateRequest,
)
from app.models.org import OrganizationCreate
from app.services.openai_recap import OpenAIRecapClient
from app.services.recap_service import RecapService


class FakeOpenAI(OpenAIRecapClient):
    def __init__(self) -> None:
        super().__init__(api_key="test-key", model="gpt-4o-mini")
        self.calls = 0

    async def generate(self, *, title: str, transcript: str):
        self.calls += 1
        return (
            f"Summary for {title}",
            [RecapActionItem(text="Ship the recap flow", done=False)],
        )


@pytest.fixture
def fake_openai():
    return FakeOpenAI()


@pytest.fixture
async def recap_service(org_service, team_service, chat_service, fake_openai):
    return RecapService(
        recap_repo=InMemoryRecapRepository(),
        team_service=team_service,
        chat_service=chat_service,
        openai=fake_openai,
    )


@pytest.mark.asyncio
async def test_generate_list_update_send_recap(
    org_service, team_service, chat_service, recap_service, fake_openai, owner_user
):
    org = await org_service.create_organization(
        OrganizationCreate(name="Recap Co", slug=f"recap-{uuid4().hex[:6]}"),
        owner_user,
    )
    team = (await team_service.list_org_teams(org.id, owner_user))[0]
    await chat_service.list_channels(team.id, owner_user)

    created = await recap_service.generate(
        team.id,
        RecapGenerateRequest(
            title="Sprint sync",
            transcript="We decided to ship the AI recap this week. Jordan owns QA.",
        ),
        owner_user,
    )
    assert fake_openai.calls == 1
    assert created.status == RecapStatus.DRAFT
    assert "Sprint sync" in created.summary
    assert created.action_items[0].text == "Ship the recap flow"

    listed = await recap_service.list_recaps(team.id, owner_user)
    assert len(listed) == 1

    updated = await recap_service.update_recap(
        team.id,
        created.id,
        RecapUpdateRequest(summary="Edited summary for the team."),
        owner_user,
    )
    assert updated.status == RecapStatus.REVIEWED
    assert updated.summary.startswith("Edited")

    sent = await recap_service.send_recap(
        team.id, created.id, RecapSendRequest(), owner_user
    )
    assert sent.status == RecapStatus.SENT
    assert sent.sent_channel_id is not None

    channels = await chat_service.list_channels(team.id, owner_user)
    general = next(c for c in channels if c.name == "general")
    page = await chat_service.list_messages(team.id, general.id, owner_user)
    assert any("Meeting recap: Sprint sync" in m.body for m in page.messages)
