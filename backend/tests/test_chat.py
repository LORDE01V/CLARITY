"""
Tests for the team Chat API.

Covers default #general channel creation, messaging, pagination,
DMs/groups, RBAC, and HTTP endpoints using in-memory repositories.
"""

from uuid import uuid4

import pytest

from app.core.exceptions import PermissionDeniedError, ValidationError
from app.dependencies.auth import get_current_user
from app.models.chat import (
    ChannelCreate,
    ChannelType,
    DirectMessageCreate,
    GroupCreate,
    MessageCreate,
)
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
    assert channels[0].channel_type == ChannelType.CHANNEL


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
    assert channel.channel_type == ChannelType.CHANNEL

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
async def test_start_dm_find_or_create_unique(
    repos, org_service, team_service, chat_service, owner_user, member_user
):
    """DM is find-or-create and unique per pair within a team."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    first = await chat_service.start_dm(
        team.id, DirectMessageCreate(user_id=member_user.id), owner_user
    )
    second = await chat_service.start_dm(
        team.id, DirectMessageCreate(user_id=member_user.id), owner_user
    )
    reverse = await chat_service.start_dm(
        team.id, DirectMessageCreate(user_id=owner_user.id), member_user
    )

    assert first.id == second.id == reverse.id
    assert first.channel_type == ChannelType.DM
    assert {m.user_id for m in first.members} == {owner_user.id, member_user.id}

    listed = await chat_service.list_channels(team.id, owner_user)
    dm_ids = [c.id for c in listed if c.channel_type == ChannelType.DM]
    assert dm_ids == [first.id]


@pytest.mark.asyncio
async def test_dm_rejects_non_member_and_self(
    repos, org_service, team_service, chat_service, owner_user, member_user
):
    """Cannot DM yourself or someone outside the team."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]

    with pytest.raises(ValidationError):
        await chat_service.start_dm(
            team.id, DirectMessageCreate(user_id=owner_user.id), owner_user
        )

    with pytest.raises(ValidationError):
        await chat_service.start_dm(
            team.id, DirectMessageCreate(user_id=member_user.id), owner_user
        )


@pytest.mark.asyncio
async def test_create_group_and_private_access(
    repos, org_service, team_service, chat_service, owner_user, member_user, pm_user
):
    """Groups are explicit-member only; outsiders cannot read messages."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    teams = await team_service.list_org_teams(org.id, owner_user)
    team = teams[0]
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    group = await chat_service.create_group(
        team.id,
        GroupCreate(name="Launch crew", member_ids=[member_user.id]),
        owner_user,
    )
    assert group.channel_type == ChannelType.GROUP
    assert group.name == "Launch crew"
    assert {m.user_id for m in group.members} == {owner_user.id, member_user.id}

    await chat_service.send_message(
        team.id, group.id, MessageCreate(body="Private note"), owner_user
    )

    member_list = await chat_service.list_channels(team.id, member_user)
    assert any(c.id == group.id for c in member_list)

    pm_list = await chat_service.list_channels(team.id, pm_user)
    assert not any(c.id == group.id for c in pm_list)

    with pytest.raises(PermissionDeniedError):
        await chat_service.list_messages(team.id, group.id, pm_user)


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
    assert created.json()["channel_type"] == "channel"

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
async def test_http_dm_and_group_flow(
    client, repos, seeded_org, member_user, user_profiles
):
    """HTTP: members list, start DM, create group, exchange messages."""
    team_id = seeded_org["team"].id
    await repos["member"].add_member(team_id, member_user.id, Role.MEMBER)
    user_profiles.put(member_user)

    members = client.get(f"/api/v1/teams/{team_id}/members")
    assert members.status_code == 200
    member_ids = {row["user_id"] for row in members.json()}
    assert str(member_user.id) in member_ids

    dm = client.post(
        f"/api/v1/teams/{team_id}/dms",
        json={"user_id": str(member_user.id)},
    )
    assert dm.status_code == 201
    assert dm.json()["channel_type"] == "dm"
    dm_id = dm.json()["id"]

    again = client.post(
        f"/api/v1/teams/{team_id}/dms",
        json={"user_id": str(member_user.id)},
    )
    assert again.status_code == 201
    assert again.json()["id"] == dm_id

    group = client.post(
        f"/api/v1/teams/{team_id}/groups",
        json={"name": "War room", "member_ids": [str(member_user.id)]},
    )
    assert group.status_code == 201
    assert group.json()["channel_type"] == "group"

    sent = client.post(
        f"/api/v1/teams/{team_id}/channels/{dm_id}/messages",
        json={"body": "Hey there"},
    )
    assert sent.status_code == 201

    listed = client.get(f"/api/v1/teams/{team_id}/channels")
    assert listed.status_code == 200
    types = {c["channel_type"] for c in listed.json()}
    assert {"channel", "dm", "group"}.issubset(types)


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
