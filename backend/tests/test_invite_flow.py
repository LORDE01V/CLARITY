"""
Tests for the team invite flow.

Covers invite creation (RBAC), token lookup, acceptance, and
validation of expired or mismatched-email invites.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.exceptions import PermissionDeniedError, ValidationError
from app.models.auth import AuthUser
from app.models.enums import Role
from app.models.invite import InviteCreate
from app.models.org import OrganizationCreate
from app.models.team import TeamCreate


@pytest.mark.asyncio
async def test_pm_can_create_invite(
    repos, org_service, team_service, invite_service, owner_user, pm_user, invitee_user
):
    """A Project Manager can invite a user to a team with a specific role."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    invite = await invite_service.create_invite(
        team.id,
        InviteCreate(email=invitee_user.email, role=Role.MEMBER),
        pm_user,
    )

    assert invite.team_id == team.id
    assert invite.email == invitee_user.email
    assert invite.role == Role.MEMBER
    assert invite.token
    assert invite.accepted_at is None


@pytest.mark.asyncio
async def test_member_cannot_create_invite(
    repos, org_service, team_service, invite_service, owner_user, member_user, invitee_user
):
    """Regular members lack permission to create invites."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, member_user.id, Role.MEMBER)

    with pytest.raises(PermissionDeniedError):
        await invite_service.create_invite(
            team.id,
            InviteCreate(email=invitee_user.email, role=Role.MEMBER),
            member_user,
        )


@pytest.mark.asyncio
async def test_pm_cannot_assign_owner_role(
    repos, org_service, team_service, invite_service, owner_user, pm_user, invitee_user
):
    """Inviters cannot assign a role above their own level."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    with pytest.raises(ValidationError, match="Owner role cannot be assigned"):
        await invite_service.create_invite(
            team.id,
            InviteCreate(email=invitee_user.email, role=Role.OWNER),
            pm_user,
        )


@pytest.mark.asyncio
async def test_accept_invite_creates_membership(
    repos, org_service, team_service, invite_service, owner_user, pm_user, invitee_user
):
    """Accepting a valid invite adds the user to the team with the assigned role."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    invite = await invite_service.create_invite(
        team.id,
        InviteCreate(email=invitee_user.email, role=Role.MEMBER),
        pm_user,
    )

    result = await invite_service.accept_invite(invite.token, invitee_user)

    assert result.team_id == team.id
    assert result.role == Role.MEMBER

    membership = await repos["member"].get_membership(team.id, invitee_user.id)
    assert membership is not None
    assert membership.role == Role.MEMBER

    updated_invite = await repos["invite"].get_by_token(invite.token)
    assert updated_invite.accepted_at is not None


@pytest.mark.asyncio
async def test_accept_expired_invite_fails(
    repos, org_service, team_service, invite_service, owner_user, pm_user, invitee_user
):
    """Expired invites cannot be accepted."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    expired_at = datetime.now(timezone.utc) - timedelta(hours=1)
    invite = await repos["invite"].create(
        team_id=team.id,
        payload=InviteCreate(email=invitee_user.email, role=Role.MEMBER),
        invited_by=pm_user.id,
        expires_at=expired_at,
    )

    with pytest.raises(ValidationError, match="expired"):
        await invite_service.accept_invite(invite.token, invitee_user)


@pytest.mark.asyncio
async def test_accept_invite_wrong_email_fails(
    repos, org_service, team_service, invite_service, owner_user, pm_user
):
    """Users cannot accept invites sent to a different email address."""
    org = await org_service.create_organization(
        OrganizationCreate(name="Acme Corp", slug="acme-corp"),
        owner_user,
    )
    team = await team_service.create_team(
        org.id, TeamCreate(name="Engineering"), owner_user
    )
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    invite = await invite_service.create_invite(
        team.id,
        InviteCreate(email="someone-else@example.com", role=Role.MEMBER),
        pm_user,
    )

    wrong_user = AuthUser(id=uuid4(), email="wrong@example.com")
    with pytest.raises(ValidationError, match="different email"):
        await invite_service.accept_invite(invite.token, wrong_user)


@pytest.mark.asyncio
async def test_create_invite_api_endpoint(client, seeded_org, repos, pm_user, invitee_user):
    """POST /teams/{id}/invites returns 201 with invite details."""
    team = seeded_org["team"]
    await repos["member"].add_member(team.id, pm_user.id, Role.PROJECT_MANAGER)

    from app.dependencies.auth import get_current_user

    client.app.dependency_overrides[get_current_user] = lambda: pm_user

    response = client.post(
        f"/api/v1/teams/{team.id}/invites",
        json={"email": invitee_user.email, "role": "member"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == invitee_user.email
    assert data["role"] == "member"
    assert "token" in data
