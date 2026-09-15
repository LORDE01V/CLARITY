"""GitHub App authentication: private key load, App JWT, installation tokens."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import jwt

from app.core.config import Settings
from app.core.exceptions import ValidationError

_GITHUB_JWT_TTL = timedelta(minutes=9)


def load_github_private_key(settings: Settings) -> str:
    """
    Load the GitHub App private key from inline env or a PEM file path.

    Prefer `GITHUB_PRIVATE_KEY` (PEM text, use \\n for newlines in .env).
    Otherwise read `GITHUB_PRIVATE_KEY_PATH` as a filesystem path.
    """
    inline = settings.github_private_key.strip()
    if inline:
        return _normalize_pem(inline.replace("\\n", "\n"))

    raw_path = settings.github_private_key_path.strip()
    if not raw_path:
        raise ValidationError("GitHub App private key is not configured")

    path = Path(raw_path)
    if path.is_file():
        return _normalize_pem(path.read_text(encoding="utf-8"))

    # Misconfigured .env sometimes pastes key material into *_PATH.
    if raw_path.startswith("-----BEGIN") or raw_path.startswith("MII"):
        return _normalize_pem(raw_path)

    raise ValidationError(
        "GitHub private key path does not exist; set GITHUB_PRIVATE_KEY_PATH "
        "to a .pem file or provide GITHUB_PRIVATE_KEY"
    )


def _normalize_pem(material: str) -> str:
    text = material.strip().replace("\r\n", "\n")
    if "BEGIN" in text and "PRIVATE KEY" in text:
        return text if text.endswith("\n") else text + "\n"

    # Base64 body only — wrap as PKCS#1 RSA private key PEM.
    body = "".join(text.split())
    lines = [body[i : i + 64] for i in range(0, len(body), 64)]
    return (
        "-----BEGIN RSA PRIVATE KEY-----\n"
        + "\n".join(lines)
        + "\n-----END RSA PRIVATE KEY-----\n"
    )


def create_app_jwt(settings: Settings) -> str:
    """Create a short-lived RS256 JWT for GitHub App authentication."""
    if not settings.github_app_id.strip():
        raise ValidationError("GITHUB_APP_ID is not configured")

    private_key = load_github_private_key(settings)
    now = datetime.now(timezone.utc)
    payload = {
        "iat": int((now - timedelta(seconds=60)).timestamp()),
        "exp": int((now + _GITHUB_JWT_TTL).timestamp()),
        "iss": settings.github_app_id.strip(),
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def private_key_is_loadable(settings: Settings) -> bool:
    """Return True when a PEM private key can be parsed."""
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key

        pem = load_github_private_key(settings).encode("utf-8")
        load_pem_private_key(pem, password=None)
        return True
    except Exception:
        return False
