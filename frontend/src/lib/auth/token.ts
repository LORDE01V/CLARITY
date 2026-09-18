/**
 * In-memory + sessionStorage access token for API calls.
 *
 * Memory is fastest within a tab; sessionStorage keeps JWT available when the
 * user opens another Clarity window/tab so the app does not flash a full reload.
 */

const STORAGE_KEY = "clarity_access_token";

let memoryAccessToken: string | null = null;

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function setAccessToken(token: string | null): void {
  memoryAccessToken = token;
  writeStoredToken(token);
}

export function peekAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  const stored = readStoredToken();
  if (stored) memoryAccessToken = stored;
  return memoryAccessToken;
}
