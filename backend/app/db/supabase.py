"""
Supabase client factory.

The service-role client is used server-side for privileged operations.
The anon client can be used for auth token verification when needed.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import Settings, get_settings


@lru_cache
def get_supabase_client() -> Client:
    """
    Return a cached Supabase client using the service role key.

    The service role key bypasses Row Level Security and must only be
    used on the backend, never exposed to the frontend.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_supabase_client(settings: Settings) -> Client:
    """Create a new Supabase client from explicit settings (useful in tests)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
