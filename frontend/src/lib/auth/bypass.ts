import type { AuthUser } from "@/types";

const DEV_LOGOUT_KEY = "clarity_dev_logged_out";

/** Demo user shown in the dashboard when auth is bypassed. */
export const DEMO_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "jordan@example.com",
  full_name: "Jordan Davis",
};

/**
 * Whether the app should skip Supabase/backend auth.
 *
 * Enabled by default in local dev so you can explore the UI without
 * infrastructure. Set VITE_AUTH_BYPASS=false to test real auth.
 */
export function isAuthBypassEnabled(): boolean {
  const flag = import.meta.env.VITE_AUTH_BYPASS;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return import.meta.env.DEV;
}

export function hasDevLogoutFlag(): boolean {
  return sessionStorage.getItem(DEV_LOGOUT_KEY) === "1";
}

export function clearDevLogoutFlag(): void {
  sessionStorage.removeItem(DEV_LOGOUT_KEY);
}

export function setDevLogoutFlag(): void {
  sessionStorage.setItem(DEV_LOGOUT_KEY, "1");
}

export function createDemoUser(overrides?: Partial<AuthUser>): AuthUser {
  return { ...DEMO_USER, ...overrides };
}
