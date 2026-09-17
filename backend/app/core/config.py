"""
Application configuration loaded from environment variables.

Uses pydantic-settings so configuration is validated at startup and
easy to override in tests via dependency injection.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the CLARITY API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "CLARITY"
    cors_origins: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    invite_token_expire_hours: int = 72

    # GitHub App (local/dev + webhook ingest)
    github_app_id: str = ""
    github_app_slug: str = ""
    github_client_id: str = ""
    github_webhook_secret: str = ""
    github_private_key_path: str = ""
    github_private_key: str = ""
    github_installation_id: str = ""
    # Public frontend origin used when building post-install redirect hints
    frontend_origin: str = "http://localhost:5173"

    # OpenAI (meeting recaps) — same key locally and on deploy
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def github_app_configured(self) -> bool:
        """True when App ID, webhook secret, and a private key source are set."""
        has_key = bool(self.github_private_key.strip() or self.github_private_key_path.strip())
        return bool(
            self.github_app_id.strip()
            and self.github_webhook_secret.strip()
            and has_key
        )

    @property
    def allow_local_github_reads(self) -> bool:
        """
        Allow unauthenticated GET /github/activity and /github/status.

        Enabled only for local/dev so webhook ingest can be verified without
        Supabase JWT. Never treat production as local.
        """
        return self.app_env.strip().lower() in {"development", "local", "dev"}


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance (singleton per process)."""
    return Settings()
