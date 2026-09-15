"""
Tests for the team Chat API.

Covers default #general channel creation, messaging, pagination,
RBAC, and HTTP endpoints using in-memory repositories.
"""

from uuid import uuid4

import pytest

from app.core.exceptions import PermissionDeniedError, ValidationError
from app.dependencies.auth import get_current_user
from app.models.chat import ChannelCreate, MessageCreate
from app.models.enums import Role
from app.models.org import OrganizationCreate
from app.models.team import TeamCreate


@pytest.mark.asyncio
async def test_list_channels_creates_general(
    org_service, team_service, chat_service, owner_user
):
    """First channel list auto-creates a default #general channel."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]

    channels = await chat_service.list_channels(team.id, owner_user)

    assert len(channels) == 1
    assert channels[0].name == "general"
    assert channels[0].is_default is True


@pytest.mark.asyncio
async def test_member_can_create_channel_and_send_message(
    repos, org_service, team_service, chat_service, owner_user, member_user
):
    """Members can create channels and send messages."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    channel = await chat_service.create_channel(
        team.id,
        ChannelCreate(name="Product Updates", description="Ship notes"),
        member_user,
    )
    assert channel.name == "product-updates"
    assert channel.description == "Ship notes"

    message = await chat_service.send_message(
        team.id,
        channel.id,
        MessageCreate(body="Kickoff complete."),
        member_user,
    )
    assert message.body == "Kickoff complete."
    assert message.author_id == member_user.id
    assert message.author_email == member_user.email


@pytest.mark.asyncio
async def test_guest_cannot_send_message(
    repos, org_service, team_service, chat_service, owner_user
):
    """Guests can read channels but cannot send messages."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]
    guest = type(owner_user)(
        id=uuid4(), email="guest@example.com", full_name="Guest User"
    )
    await repos["member"].add_member(team.id, guest.id, Role.GUEST)

    channels = await chat_service.list_channels(team.id, guest)
    assert channels[0].name == "general"

    with pytest.raises(PermissionDeniedError):
        await chat_service.send_message(
            team.id,
            channels[0].id,
            MessageCreate(body="Should fail"),
            guest,
        )


@pytest.mark.asyncio
async def test_messages_return_chronological_with_has_more(
    org_service, team_service, chat_service, owner_user
):
    """Latest page is chronological and reports older history via has_more."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]
    channels = await chat_service.list_channels(team.id, owner_user)
    channel_id = channels[0].id

    for i in range(5):
        await chat_service.send_message(
            team.id,
            channel_id,
            MessageCreate(body=f"msg-{i}"),
            owner_user,
        )

    page = await chat_service.list_messages(
        team.id, channel_id, owner_user, limit=3
    )
    assert [m.body for m in page.messages] == ["msg-2", "msg-3", "msg-4"]
    assert page.has_more is True

    older = await chat_service.list_messages(
        team.id,
        channel_id,
        owner_user,
        limit=3,
        before=page.messages[0].created_at,
    )
    assert [m.body for m in older.messages] == ["msg-0", "msg-1"]
    assert older.has_more is False


@pytest.mark.asyncio
async def test_poll_after_returns_only_newer(
    org_service, team_service, chat_service, owner_user
):
    """Polling with after returns only messages newer than the cursor."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]
    channels = await chat_service.list_channels(team.id, owner_user)
    channel_id = channels[0].id

    first = await chat_service.send_message(
        team.id, channel_id, MessageCreate(body="first"), owner_user
    )
    await chat_service.send_message(
        team.id, channel_id, MessageCreate(body="second"), owner_user
    )

    page = await chat_service.list_messages(
        team.id, channel_id, owner_user, after=first.created_at
    )
    assert [m.body for m in page.messages] == ["second"]


@pytest.mark.asyncio
async def test_invalid_channel_name_rejected(
    org_service, team_service, chat_service, owner_user
):
    """Channel names must be slug-like and cannot reserve general."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]

    with pytest.raises(ValidationError):
        await chat_service.create_channel(
            team.id, ChannelCreate(name="@@@"), owner_user
        )

    with pytest.raises(ValidationError):
        await chat_service.create_channel(
            team.id, ChannelCreate(name="general"), owner_user
        )


@pytest.mark.asyncio
async def test_http_create_channel_and_send_message(client, seeded_org):
    """HTTP: list channels, create one, send and list messages."""
    team_id = seeded_org["team"].id

    listed = client.get(f"/api/v1/teams/{team_id}/channels")
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "general"
    general_id = listed.json()[0]["id"]

    created = client.post(
        f"/api/v1/teams/{team_id}/channels",
        json={"name": "design", "description": "Critique notes"},
    )
    assert created.status_code == 201
    assert created.json()["name"] == "design"

    sent = client.post(
        f"/api/v1/teams/{team_id}/channels/{general_id}/messages",
        json={"body": "Hello team"},
    )
    assert sent.status_code == 201
    assert sent.json()["body"] == "Hello team"

    messages = client.get(
        f"/api/v1/teams/{team_id}/channels/{general_id}/messages"
    )
    assert messages.status_code == 200
    body = messages.json()
    assert body["has_more"] is False
    assert body["messages"][0]["body"] == "Hello team"


@pytest.mark.asyncio
async def test_http_outsider_cannot_list_channels(
    client, seeded_org, member_user
):
    """Non-members receive 403 when listing channels."""
    team_id = seeded_org["team"].id
    app = client.app

    async def outsider():
        return member_user

    app.dependency_overrides[get_current_user] = outsider
    response = client.get(f"/api/v1/teams/{team_id}/channels")
    assert response.status_code == 403
