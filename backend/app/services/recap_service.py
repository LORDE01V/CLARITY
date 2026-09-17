"""Meeting recap business logic: generate, edit, send to chat."""

from datetime import datetime, timezone
from uuid import UUID

from app.core.exceptions import NotFoundError, ValidationError
from app.db.repositories.recap_repository import RecapRepository, new_recap_row
from app.models.auth import AuthUser
from app.models.chat import ChannelType, MessageCreate
from app.models.enums import Role
from app.models.recap import (
    RecapGenerateRequest,
    RecapResponse,
    RecapSendRequest,
    RecapStatus,
    RecapUpdateRequest,
)
from app.services.chat_service import ChatService, DEFAULT_CHANNEL_NAME
from app.services.openai_recap import OpenAIRecapClient
from app.services.team_service import TeamService


class RecapService:
    def __init__(
        self,
        *,
        recap_repo: RecapRepository,
        team_service: TeamService,
        chat_service: ChatService,
        openai: OpenAIRecapClient,
    ) -> None:
        self._recaps = recap_repo
        self._teams = team_service
        self._chat = chat_service
        self._openai = openai

    async def generate(
        self, team_id: UUID, payload: RecapGenerateRequest, user: AuthUser
    ) -> RecapResponse:
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        summary, action_items = await self._openai.generate(
            title=payload.title,
            transcript=payload.transcript,
        )
        row = new_recap_row(
            team_id=team_id,
            title=payload.title,
            transcript=payload.transcript,
            summary=summary,
            action_items=action_items,
            created_by=user.id,
            model=self._openai.model,
            meeting_url=payload.meeting_url,
        )
        return await self._recaps.create(row)

    async def list_recaps(self, team_id: UUID, user: AuthUser) -> list[RecapResponse]:
        await self._teams.require_team_role(team_id, user, Role.GUEST)
        return await self._recaps.list_by_team(team_id)

    async def get_recap(
        self, team_id: UUID, recap_id: UUID, user: AuthUser
    ) -> RecapResponse:
        await self._teams.require_team_role(team_id, user, Role.GUEST)
        recap = await self._recaps.get_by_id(recap_id)
        if not recap or recap.team_id != team_id:
            raise NotFoundError("Recap not found")
        return recap

    async def update_recap(
        self,
        team_id: UUID,
        recap_id: UUID,
        payload: RecapUpdateRequest,
        user: AuthUser,
    ) -> RecapResponse:
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        recap = await self.get_recap(team_id, recap_id, user)
        if recap.status == RecapStatus.SENT:
            raise ValidationError("Sent recaps cannot be edited")

        fields: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
        data = payload.model_dump(exclude_unset=True)
        if "title" in data and data["title"] is not None:
            fields["title"] = data["title"].strip()
        if "summary" in data and data["summary"] is not None:
            fields["summary"] = data["summary"].strip()
        if "action_items" in data and data["action_items"] is not None:
            fields["action_items"] = [
                item.model_dump() if hasattr(item, "model_dump") else item
                for item in data["action_items"]
            ]
        if "meeting_url" in data:
            fields["meeting_url"] = data["meeting_url"]
        fields["status"] = RecapStatus.REVIEWED.value
        fields["reviewed_by"] = str(user.id)
        return await self._recaps.update(recap_id, fields)

    async def send_recap(
        self,
        team_id: UUID,
        recap_id: UUID,
        payload: RecapSendRequest,
        user: AuthUser,
    ) -> RecapResponse:
        await self._teams.require_team_role(team_id, user, Role.MEMBER)
        recap = await self.get_recap(team_id, recap_id, user)
        if not recap.summary.strip():
            raise ValidationError("Recap summary is empty")

        channel_id = payload.channel_id
        if channel_id is None:
            channels = await self._chat.list_channels(team_id, user)
            general = next(
                (
                    c
                    for c in channels
                    if c.name == DEFAULT_CHANNEL_NAME
                    and c.channel_type == ChannelType.CHANNEL
                ),
                None,
            )
            if general is None and channels:
                general = next(
                    (c for c in channels if c.channel_type == ChannelType.CHANNEL),
                    channels[0],
                )
            if general is None:
                raise ValidationError("No chat channel available to send the recap")
            channel_id = general.id

        body = _format_chat_message(recap)
        await self._chat.send_message(
            team_id, channel_id, MessageCreate(body=body), user
        )

        now = datetime.now(timezone.utc).isoformat()
        return await self._recaps.update(
            recap_id,
            {
                "status": RecapStatus.SENT.value,
                "reviewed_by": str(user.id),
                "sent_channel_id": str(channel_id),
                "sent_at": now,
                "updated_at": now,
            },
        )


def _format_chat_message(recap: RecapResponse) -> str:
    lines = [f"**Meeting recap: {recap.title}**", "", recap.summary.strip()]
    if recap.action_items:
        lines.append("")
        lines.append("Action items:")
        for item in recap.action_items:
            mark = "[x]" if item.done else "[ ]"
            lines.append(f"- {mark} {item.text}")
    if recap.meeting_url:
        lines.append("")
        lines.append(f"Meeting link: {recap.meeting_url}")
    lines.append("")
    lines.append("_Drafted with Clarity AI · reviewed before send_")
    return "\n".join(lines)
