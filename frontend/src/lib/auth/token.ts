/**
 * In-memory access token for API calls.
 *
 * Supabase getSession() can lag or return null right after setSession /
 * onAuthStateChange; keeping the JWT here ensures org create and other
 * authenticated calls always send Authorization: Bearer …
 */

let memoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export function peekAccessToken(): string | null {
  return memoryAccessToken;
}
