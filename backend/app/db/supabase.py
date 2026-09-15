"""
Supabase client factory.

Keep the service-role client free of Auth sessions. Calling sign_in / sign_up
on that client replaces its JWT with the end-user token, so subsequent table
operations run as `authenticated` and hit RLS (often as a bare 500 / browser
\"Failed to fetch\").

Use:
- get_supabase_client()      — service role for DB / privileged ops
- get_supabase_auth_client() — anon key for login / register only
"""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import Settings, get_settings


@lru_cache
def get_supabase_client() -> Client:
    """
    Return a cached Supabase client using the service role key.

    The service role key bypasses Row Level Security and must only be
    used on the backend, never exposed to the frontend. Do not call
    auth.sign_in / auth.sign_up on this client.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache
def get_supabase_auth_client() -> Client:
    """
    Return a cached anon-key client for Auth sign-in / sign-up only.

    Isolated from the service-role client so user sessions never pollute
    privileged database calls.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def create_supabase_client(settings: Settings) -> Client:
    """Create a new service-role client from explicit settings (useful in tests)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
