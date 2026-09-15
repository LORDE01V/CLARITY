/**
 * Frontend auth/env readiness checks for the real Supabase path.
 */

export function isAuthBypassFlagFalse(): boolean {
  return import.meta.env.VITE_AUTH_BYPASS === "false";
}

export function hasSupabaseEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("your-project") &&
      key !== "your-anon-key"
  );
}

export function hasApiBaseUrl(): boolean {
  const base = import.meta.env.VITE_API_BASE_URL;
  return Boolean(base && base.length > 0);
}

/**
 * True when the app is configured for real auth (bypass off + env present).
 * Used for banners; AuthProvider still respects VITE_AUTH_BYPASS alone.
 */
export function isRealAuthPathReady(): boolean {
  return isAuthBypassFlagFalse() && hasSupabaseEnv() && hasApiBaseUrl();
}
