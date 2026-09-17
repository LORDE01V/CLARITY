"""OpenAI Chat Completions client for meeting recap generation."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.exceptions import ValidationError
from app.models.recap import RecapActionItem

SYSTEM_PROMPT = """You are Clarity's meeting recap assistant for corporate teams.
Given a meeting transcript or notes, produce a concise factual summary and clear action items.
Do not invent attendees, decisions, or deadlines that are not supported by the text.
Return JSON only with this shape:
{"summary": "string", "action_items": [{"text": "string", "done": false}]}
Keep the summary under ~200 words. Action items should be concrete and assignee-ready when possible.
"""


class OpenAIRecapClient:
    """Thin HTTP client — works the same locally and on Render/etc."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        timeout: float = 90.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key.strip()
        self._model = model.strip() or "gpt-4o-mini"
        self._timeout = timeout
        self._http = http_client

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    @property
    def model(self) -> str:
        return self._model

    async def generate(self, *, title: str, transcript: str) -> tuple[str, list[RecapActionItem]]:
        if not self.configured:
            raise ValidationError(
                "OpenAI is not configured. Set OPENAI_API_KEY on the API host."
            )

        payload = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Meeting title: {title}\n\nTranscript:\n{transcript}",
                },
            ],
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        if self._http is not None:
            response = await self._http.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
            )
        else:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

        if response.status_code >= 400:
            detail = _safe_error(response)
            raise ValidationError(f"OpenAI request failed: {detail}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValidationError("OpenAI returned an unexpected response") from exc

        return _parse_recap_json(content)


def _safe_error(response: httpx.Response) -> str:
    try:
        body = response.json()
        err = body.get("error") if isinstance(body, dict) else None
        if isinstance(err, dict) and err.get("message"):
            return str(err["message"])
        return response.text[:300]
    except Exception:
        return response.text[:300] or f"HTTP {response.status_code}"


def _parse_recap_json(content: str) -> tuple[str, list[RecapActionItem]]:
    try:
        parsed: Any = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValidationError("OpenAI returned non-JSON content") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("OpenAI JSON must be an object")

    summary = str(parsed.get("summary") or "").strip()
    if not summary:
        raise ValidationError("OpenAI did not return a summary")

    raw_items = parsed.get("action_items") or []
    if not isinstance(raw_items, list):
        raise ValidationError("OpenAI action_items must be a list")

    items: list[RecapActionItem] = []
    for entry in raw_items:
        if isinstance(entry, str) and entry.strip():
            items.append(RecapActionItem(text=entry.strip(), done=False))
            continue
        if isinstance(entry, dict):
            text = str(entry.get("text") or "").strip()
            if not text:
                continue
            items.append(
                RecapActionItem(text=text, done=bool(entry.get("done", False)))
            )

    return summary, items
