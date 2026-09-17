"""OpenAI Whisper transcription client (same API key as recaps)."""

from __future__ import annotations

import httpx

from app.core.exceptions import ValidationError


class OpenAIWhisperClient:
    """Transcribe audio via OpenAI Whisper — works locally and on deploy."""

    def __init__(
        self,
        api_key: str,
        model: str = "whisper-1",
        timeout: float = 120.0,
    ) -> None:
        self._api_key = api_key.strip()
        self._model = model.strip() or "whisper-1"
        self._timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def transcribe(
        self,
        *,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ) -> str:
        if not self.configured:
            raise ValidationError(
                "OpenAI is not configured. Set OPENAI_API_KEY on the API host."
            )
        if not content:
            raise ValidationError("Audio file is empty")
        if len(content) > 25 * 1024 * 1024:
            raise ValidationError("Audio file must be under 25MB")

        headers = {"Authorization": f"Bearer {self._api_key}"}
        mime = content_type or "application/octet-stream"
        files = {
            "file": (filename or "audio.webm", content, mime),
            "model": (None, self._model),
            "response_format": (None, "text"),
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
            )

        if response.status_code >= 400:
            detail = response.text[:300] or f"HTTP {response.status_code}"
            raise ValidationError(f"Whisper request failed: {detail}")

        text = response.text.strip()
        if not text:
            raise ValidationError("Whisper returned an empty transcript")
        return text
