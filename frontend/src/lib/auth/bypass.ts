import type { AuthUser } from "@/types";

const DEV_LOGOUT_KEY = "clarity_dev_logged_out";

/**
 * Auth bypass is opt-in only (`VITE_AUTH_BYPASS=true`).
 * Never enabled by default — production and local always use real auth unless
 * you explicitly flip the flag.
 */
export function isAuthBypassEnabled(): boolean {
  return import.meta.env.VITE_AUTH_BYPASS === "true";
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

/** Minimal local user when bypass is explicitly enabled — no fictional persona. */
export function createDemoUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "local@clarity.dev",
    full_name: "Local user",
    ...overrides,
  };
}
